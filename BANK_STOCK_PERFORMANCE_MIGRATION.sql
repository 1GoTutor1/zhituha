-- Track average purchase cost and realized profit for existing and future stock trades.
-- Apply in Supabase SQL Editor after BANK_MIGRATION.sql.

alter table public.bank_stock_holdings
  add column if not exists cost_basis numeric(30,6) not null default 0 check (cost_basis >= 0),
  add column if not exists realized_profit numeric(30,6) not null default 0;

-- Rebuild each player's average-cost position from the complete trade ledger.
do $$
declare
  h record; t record; held numeric; basis numeric(30,6); realized numeric(30,6);
  trade_shares bigint; sold_shares bigint; sold_cost numeric(30,6); trade_price numeric;
begin
  for h in select player_id,symbol,shares from public.bank_stock_holdings loop
    held := 0; basis := 0; realized := 0;
    for t in select operation,amount,details from public.bank_transactions
      where player_id=h.player_id and operation in ('stock_buy','stock_sell')
        and details->>'symbol'=h.symbol order by id loop
      trade_shares := greatest(0,coalesce((t.details->>'shares')::bigint,0));
      if t.operation='stock_buy' then
        trade_price := coalesce((t.details->>'price')::numeric,0);
        basis := basis + trade_shares*trade_price;
        held := held + trade_shares;
      elsif held>0 and trade_shares>0 then
        sold_shares := least(trade_shares,held)::bigint;
        sold_cost := basis*sold_shares/held;
        realized := realized+t.amount-sold_cost;
        basis := greatest(0,basis-sold_cost);
        held := held-sold_shares;
      end if;
    end loop;
    if held<>h.shares then
      select h.shares*q.price into basis from public.bank_stock_quotes q where q.symbol=h.symbol;
    end if;
    update public.bank_stock_holdings set cost_basis=greatest(0,basis),realized_profit=realized
      where player_id=h.player_id and symbol=h.symbol;
  end loop;
end $$;

create or replace function public.bank_get_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare result jsonb;
begin
  if not exists (select 1 from public.players where id = p_player_id) then
    return jsonb_build_object('error','player not found');
  end if;
  insert into public.bank_accounts(player_id) values (p_player_id) on conflict (player_id) do nothing;
  result := jsonb_build_object(
    'wallet', (select money from public.players where id = p_player_id),
    'balance', (select balance from public.bank_accounts where player_id = p_player_id),
    'deposits', coalesce((select jsonb_agg(jsonb_build_object(
      'id',d.id,'principal',d.principal,'rate_bps',d.rate_bps,'term_hours',d.term_hours,
      'maturity_at',d.maturity_at,'status',d.status,'created_at',d.created_at
    ) order by d.created_at desc) from public.bank_deposits d where d.player_id=p_player_id and d.status='active'),'[]'::jsonb),
    'loan', (select to_jsonb(l) from public.bank_loans l where l.player_id=p_player_id and l.status in ('active','foreclosed') and l.amount_due > 0 order by l.created_at desc limit 1),
    'holdings', coalesce((select jsonb_agg(jsonb_build_object(
      'symbol',h.symbol,'shares',h.shares,'price',q.price,'value',h.shares*q.price,
      'cost_basis',h.cost_basis,'realized_profit',h.realized_profit,
      'liquidation_value',floor(h.shares*q.price*0.95)
    ) order by h.symbol) from public.bank_stock_holdings h join public.bank_stock_quotes q using(symbol)
      where h.player_id=p_player_id and (h.shares>0 or h.realized_profit<>0)),'[]'::jsonb),
    'stocks', coalesce((select jsonb_agg(jsonb_build_object(
      'symbol',q.symbol,'title',q.title,'price',q.price,'previous_price',q.previous_price,
      'updated_at',q.updated_at,'history',coalesce((select jsonb_agg(jsonb_build_object('price',t.price,'at',t.created_at) order by t.created_at)
        from (select price,created_at from public.bank_stock_ticks where symbol=q.symbol order by created_at desc limit 60) t),'[]'::jsonb)
    ) order by q.symbol) from public.bank_stock_quotes q),'[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(jsonb_build_object(
      'id',t.id,'operation',t.operation,'amount',t.amount,'details',t.details,'created_at',t.created_at
    ) order by t.created_at desc) from (select * from public.bank_transactions where player_id=p_player_id order by created_at desc limit 30) t),'[]'::jsonb),
    'server_now', clock_timestamp()
  );
  return result;
end $$;

create or replace function public.bank_buy_stock_rpc(p_player_id uuid, p_symbol text, p_shares int)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare q public.bank_stock_quotes; a public.bank_accounts; total bigint;
begin
  if p_shares is null or p_shares<1 or p_shares>10000 then return jsonb_build_object('error','Можно купить от 1 до 10 000 акций'); end if;
  select * into q from public.bank_stock_quotes where symbol=p_symbol for update;
  if not found then return jsonb_build_object('error','Акция не найдена'); end if;
  total := q.price*p_shares;
  select * into a from public.bank_accounts where player_id=p_player_id for update;
  if not found or a.balance<total then return jsonb_build_object('error','Недостаточно денег на банковском счёте'); end if;
  update public.bank_accounts set balance=balance-total,updated_at=now() where player_id=p_player_id;
  insert into public.bank_stock_holdings(player_id,symbol,shares,cost_basis) values(p_player_id,p_symbol,p_shares,total)
    on conflict(player_id,symbol) do update set shares=bank_stock_holdings.shares+excluded.shares,
      cost_basis=bank_stock_holdings.cost_basis+excluded.cost_basis,updated_at=now();
  insert into public.bank_transactions(player_id,operation,amount,details)
    values(p_player_id,'stock_buy',-total,jsonb_build_object('symbol',p_symbol,'shares',p_shares,'price',q.price));
  return jsonb_build_object('success',true,'balance',a.balance-total,'price',q.price,'total',total);
end $$;

create or replace function public.bank_sell_stock_rpc(p_player_id uuid, p_symbol text, p_shares int)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare q public.bank_stock_quotes; h public.bank_stock_holdings; proceeds bigint; sold_cost numeric(30,6);
begin
  if p_shares is null or p_shares<1 or p_shares>10000 then return jsonb_build_object('error','Некорректное количество акций'); end if;
  select * into q from public.bank_stock_quotes where symbol=p_symbol for update;
  if not found then return jsonb_build_object('error','Акция не найдена'); end if;
  select * into h from public.bank_stock_holdings where player_id=p_player_id and symbol=p_symbol for update;
  if not found or h.shares<p_shares then return jsonb_build_object('error','Недостаточно акций'); end if;
  proceeds := floor(q.price*p_shares*0.95)::bigint;
  sold_cost := h.cost_basis*p_shares/h.shares;
  update public.bank_stock_holdings set shares=shares-p_shares,cost_basis=greatest(0,cost_basis-sold_cost),
    realized_profit=realized_profit+proceeds-sold_cost,updated_at=now() where player_id=p_player_id and symbol=p_symbol;
  update public.bank_accounts set balance=balance+proceeds,updated_at=now() where player_id=p_player_id;
  insert into public.bank_transactions(player_id,operation,amount,details)
    values(p_player_id,'stock_sell',proceeds,jsonb_build_object('symbol',p_symbol,'shares',p_shares,'price',q.price,'payout_percent',95));
  return jsonb_build_object('success',true,'proceeds',proceeds,'price',q.price);
end $$;
