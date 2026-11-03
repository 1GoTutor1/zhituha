-- Rebalance future deposits without changing rates already stored on open deposits.
-- Apply after BANK_MIGRATION.sql and all existing bank/deposit migrations.

create or replace function public.bank_open_deposit_rpc(
  p_player_id uuid,
  p_amount bigint,
  p_term_hours int
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  rate int;
  account public.bank_accounts;
  deposit_id uuid;
  maturity timestamptz;
  active_principal bigint;
begin
  -- Rates are stored in basis points: 5 bps = 0.05%, 500 bps = 5%.
  rate := case p_term_hours
    when 1 then 5
    when 6 then 25
    when 12 then 50
    when 24 then 100
    when 72 then 250
    when 168 then 500
    else null
  end;
  if rate is null then
    return jsonb_build_object('error', 'Выбери срок вклада: 1, 6, 12, 24, 72 или 168 часов');
  end if;
  if p_amount is null or p_amount < 1000 or p_amount > 1000000 then
    return jsonb_build_object('error', 'Сумма вклада должна быть от 1 000 до 1 000 000 ₽');
  end if;

  insert into public.bank_accounts(player_id)
  values (p_player_id)
  on conflict (player_id) do nothing;

  select * into account
  from public.bank_accounts
  where player_id = p_player_id
  for update;
  if not found or account.balance < p_amount then
    return jsonb_build_object('error', 'Недостаточно денег на банковском счёте');
  end if;

  select coalesce(sum(principal), 0)
  into active_principal
  from public.bank_deposits
  where player_id = p_player_id and status = 'active';
  if active_principal + p_amount > 1000000 then
    return jsonb_build_object('error', 'Общая сумма активных вкладов не может превышать 1 000 000 ₽');
  end if;

  maturity := clock_timestamp() + make_interval(hours => p_term_hours);
  update public.bank_accounts
  set balance = balance - p_amount, updated_at = clock_timestamp()
  where player_id = p_player_id;

  insert into public.bank_deposits(player_id, principal, rate_bps, term_hours, maturity_at)
  values (p_player_id, p_amount, rate, p_term_hours, maturity)
  returning id into deposit_id;

  insert into public.bank_transactions(player_id, operation, amount, details)
  values (
    p_player_id,
    'deposit_open',
    -p_amount,
    jsonb_build_object('deposit_id', deposit_id, 'term_hours', p_term_hours, 'rate_bps', rate)
  );

  return jsonb_build_object('success', true, 'deposit_id', deposit_id, 'maturity_at', maturity);
end;
$$;

revoke all on function public.bank_open_deposit_rpc(uuid, bigint, int)
  from public, anon, authenticated, service_role;
grant execute on function public.bank_open_deposit_rpc(uuid, bigint, int)
  to service_role;

notify pgrst, 'reload schema';
