-- Restore daily stock dividends without replacing the active market/foreclosure tick.
-- Integer rubles are allocated proportionally, including the rounding remainder.

do $$
begin
  if to_regprocedure('public.bank_market_tick_rpc_before_dividends()') is null then
    alter function public.bank_market_tick_rpc() rename to bank_market_tick_rpc_before_dividends;
  end if;
end
$$;

create or replace function public.bank_market_tick_rpc()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  tick_result jsonb;
  q public.bank_stock_quotes;
  utc_day timestamptz;
  eligible_shares bigint;
  pool_balance bigint;
  dividend_budget bigint;
  total_paid bigint;
  per_share bigint;
  holder record;
begin
  -- Preserve the current quote movement, loan foreclosure, and cleanup behavior.
  tick_result := public.bank_market_tick_rpc_before_dividends();
  if tick_result is null or tick_result ? 'error' then
    return tick_result;
  end if;

  utc_day := date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC';

  for q in
    select * from public.bank_stock_quotes order by symbol for update
  loop
    if q.last_dividend_at is null or q.last_dividend_at < utc_day then
      select coalesce(sum(h.shares), 0)
        into eligible_shares
        from public.bank_stock_holdings h
       where h.symbol = q.symbol
         and h.shares > 0
         and h.updated_at <= clock_timestamp() - interval '6 hours';

      select coalesce(p.balance, 0)
        into pool_balance
        from public.bank_stock_dividend_pools p
       where p.symbol = q.symbol
       for update;

      dividend_budget := greatest(0, coalesce(pool_balance, 0));
      total_paid := 0;

      if eligible_shares > 0 and dividend_budget > 0 then
        for holder in
          with eligible as (
            select h.player_id, h.shares::bigint as shares,
                   (dividend_budget::numeric * h.shares::numeric / eligible_shares::numeric) as exact_payout
              from public.bank_stock_holdings h
             where h.symbol = q.symbol
               and h.shares > 0
               and h.updated_at <= clock_timestamp() - interval '6 hours'
          ), allocated as (
            select e.player_id, e.shares,
                   floor(e.exact_payout)::bigint as base_payout,
                   e.exact_payout - floor(e.exact_payout) as fractional_remainder
              from eligible e
          ), ranked as (
            select a.*, row_number() over (
              order by a.fractional_remainder desc, a.shares desc, a.player_id
            ) as remainder_rank,
            greatest(0, dividend_budget - sum(a.base_payout) over ()) as leftover
              from allocated a
          ), final_payouts as (
            select r.player_id, r.shares,
                   r.base_payout + case when r.remainder_rank <= r.leftover then 1 else 0 end as payout
              from ranked r
          )
          select f.player_id, f.shares, f.payout
            from final_payouts f
           where f.payout > 0
        loop
          insert into public.bank_accounts(player_id)
          values (holder.player_id)
          on conflict (player_id) do nothing;

          update public.bank_accounts
             set balance = balance + holder.payout,
                 updated_at = clock_timestamp()
           where player_id = holder.player_id;

          insert into public.bank_transactions(player_id, operation, amount, details)
          values (
            holder.player_id,
            'stock_dividend',
            holder.payout,
            jsonb_build_object(
              'symbol', q.symbol,
              'shares', holder.shares,
              'per_share', floor(dividend_budget::numeric / eligible_shares)::bigint,
              'allocation', 'proportional_largest_remainder'
            )
          );
          total_paid := total_paid + holder.payout;
        end loop;
      end if;

      per_share := case when eligible_shares > 0
        then floor(total_paid::numeric / eligible_shares)::bigint
        else 0 end;

      update public.bank_stock_dividend_pools
         set balance = greatest(0, balance - total_paid),
             updated_at = clock_timestamp()
       where symbol = q.symbol;

      update public.bank_stock_quotes
         set last_dividend_per_share = per_share,
             last_dividend_at = clock_timestamp()
       where symbol = q.symbol;
    end if;
  end loop;

  return tick_result;
end
$$;

revoke all on function public.bank_market_tick_rpc() from public, anon, authenticated;
grant execute on function public.bank_market_tick_rpc() to service_role;
revoke all on function public.bank_market_tick_rpc_before_dividends() from public, anon, authenticated;
grant execute on function public.bank_market_tick_rpc_before_dividends() to service_role;

-- Restore dividend totals and the daily yield fields consumed by the bank UI.
create or replace function public.bank_get_state_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.players where id = p_player_id) then
    return jsonb_build_object('error', 'player not found');
  end if;

  insert into public.bank_accounts(player_id)
  values (p_player_id)
  on conflict (player_id) do nothing;

  result := jsonb_build_object(
    'wallet', (select money from public.players where id = p_player_id),
    'balance', (select balance from public.bank_accounts where player_id = p_player_id),
    'deposits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'principal', d.principal, 'rate_bps', d.rate_bps,
        'term_hours', d.term_hours, 'maturity_at', d.maturity_at,
        'status', d.status, 'created_at', d.created_at
      ) order by d.created_at desc)
      from public.bank_deposits d
      where d.player_id = p_player_id and d.status = 'active'
    ), '[]'::jsonb),
    'loan', (
      select to_jsonb(l)
      from public.bank_loans l
      where l.player_id = p_player_id
        and l.status in ('active', 'foreclosed')
        and l.amount_due > 0
      order by l.created_at desc
      limit 1
    ),
    'holdings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'symbol', h.symbol,
        'shares', h.shares,
        'price', q.price,
        'value', h.shares * q.price,
        'cost_basis', h.cost_basis,
        'realized_profit', h.realized_profit,
        'liquidation_value', floor(h.shares * q.price * 0.95),
        'dividends_received', coalesce((
          select sum(t.amount)
          from public.bank_transactions t
          where t.player_id = p_player_id
            and t.operation = 'stock_dividend'
            and t.details ->> 'symbol' = h.symbol
        ), 0)
      ) order by h.symbol)
      from public.bank_stock_holdings h
      join public.bank_stock_quotes q using (symbol)
      where h.player_id = p_player_id
        and (h.shares > 0 or h.realized_profit <> 0)
    ), '[]'::jsonb),
    'stocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'symbol', q.symbol,
        'title', q.title,
        'price', q.price,
        'previous_price', q.previous_price,
        'updated_at', q.updated_at,
        'last_dividend_per_share', q.last_dividend_per_share,
        'last_dividend_at', q.last_dividend_at,
        'history', coalesce((
          select jsonb_agg(jsonb_build_object('price', t.price, 'at', t.created_at) order by t.created_at)
          from (
            select price, created_at
            from public.bank_stock_ticks
            where symbol = q.symbol
            order by created_at desc
            limit 60
          ) t
        ), '[]'::jsonb)
      ) order by q.symbol)
      from public.bank_stock_quotes q
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'operation', t.operation, 'amount', t.amount,
        'details', t.details, 'created_at', t.created_at
      ) order by t.created_at desc)
      from (
        select * from public.bank_transactions
        where player_id = p_player_id
        order by created_at desc
        limit 30
      ) t
    ), '[]'::jsonb),
    'server_now', clock_timestamp()
  );

  return result;
end
$$;

revoke all on function public.bank_get_state_rpc(uuid) from public, anon, authenticated;
grant execute on function public.bank_get_state_rpc(uuid) to service_role;

notify pgrst, 'reload schema';
