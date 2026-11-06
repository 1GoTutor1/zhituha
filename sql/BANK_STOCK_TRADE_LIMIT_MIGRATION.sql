-- Raise per-operation stock trading limit without changing the current
-- purchase spread, sale payout, ledger entries, or row-locking behavior.
-- Apply after BANK_STOCK_RISK_MIGRATION.sql.

begin;

create or replace function public.bank_buy_stock_rpc(p_player_id uuid, p_symbol text, p_shares int)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare q public.bank_stock_quotes; a public.bank_accounts; unit_cost bigint; total bigint;
begin
  if p_shares is null or p_shares < 1 or p_shares > 1000000 then
    return jsonb_build_object('error', 'Можно купить от 1 до 1 000 000 акций за операцию');
  end if;
  select * into q from public.bank_stock_quotes where symbol = p_symbol for update;
  if not found then return jsonb_build_object('error', 'Акция не найдена'); end if;

  unit_cost := ceil(q.price * 1.05)::bigint;
  total := unit_cost * p_shares;
  select * into a from public.bank_accounts where player_id = p_player_id for update;
  if not found or a.balance < total then
    return jsonb_build_object('error', 'Недостаточно денег на банковском счёте');
  end if;

  update public.bank_accounts set balance = balance - total, updated_at = now()
    where player_id = p_player_id;
  insert into public.bank_stock_holdings(player_id, symbol, shares, cost_basis)
    values (p_player_id, p_symbol, p_shares, total)
    on conflict (player_id, symbol) do update
      set shares = bank_stock_holdings.shares + excluded.shares,
          cost_basis = bank_stock_holdings.cost_basis + excluded.cost_basis,
          updated_at = now();
  insert into public.bank_transactions(player_id, operation, amount, details)
    values (p_player_id, 'stock_buy', -total,
      jsonb_build_object('symbol', p_symbol, 'shares', p_shares, 'price', unit_cost,
        'quote_price', q.price, 'buy_spread_percent', 5));
  return jsonb_build_object('success', true, 'balance', a.balance - total,
    'price', q.price, 'unit_cost', unit_cost, 'total', total);
end;
$$;

create or replace function public.bank_sell_stock_rpc(p_player_id uuid, p_symbol text, p_shares int)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare q public.bank_stock_quotes; h public.bank_stock_holdings; proceeds bigint; sold_cost numeric(30,6);
begin
  if p_shares is null or p_shares < 1 or p_shares > 1000000 then
    return jsonb_build_object('error', 'Некорректное количество акций (максимум 1 000 000 за операцию)');
  end if;
  select * into q from public.bank_stock_quotes where symbol = p_symbol for update;
  if not found then return jsonb_build_object('error', 'Акция не найдена'); end if;
  select * into h from public.bank_stock_holdings where player_id = p_player_id and symbol = p_symbol for update;
  if not found or h.shares < p_shares then return jsonb_build_object('error', 'Недостаточно акций'); end if;

  proceeds := floor(q.price * p_shares * 0.95)::bigint;
  sold_cost := h.cost_basis * p_shares / h.shares;
  update public.bank_stock_holdings set shares = shares - p_shares,
    cost_basis = greatest(0, cost_basis - sold_cost),
    realized_profit = realized_profit + proceeds - sold_cost, updated_at = now()
    where player_id = p_player_id and symbol = p_symbol;
  update public.bank_accounts set balance = balance + proceeds, updated_at = now()
    where player_id = p_player_id;
  insert into public.bank_transactions(player_id, operation, amount, details)
    values (p_player_id, 'stock_sell', proceeds,
      jsonb_build_object('symbol', p_symbol, 'shares', p_shares, 'price', q.price, 'payout_percent', 95));
  return jsonb_build_object('success', true, 'proceeds', proceeds, 'price', q.price);
end;
$$;

revoke all on function public.bank_buy_stock_rpc(uuid, text, int) from public, anon, authenticated;
grant execute on function public.bank_buy_stock_rpc(uuid, text, int) to service_role;
revoke all on function public.bank_sell_stock_rpc(uuid, text, int) from public, anon, authenticated;
grant execute on function public.bank_sell_stock_rpc(uuid, text, int) to service_role;

commit;
