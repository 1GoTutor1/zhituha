-- Keep the daily free transfer allowance, but allow transfers above it for a fee.
-- Run after BANK_TRANSFER_DAILY_LIMIT_MIGRATION.sql.
-- Transfers above the sender's daily allowance pay a fee on the full transfer:
-- 20% without active premium, 10% with active premium. Recipient gets p_amount;
-- the fee is debited separately and removed from circulation.

do $$
begin
  if to_regprocedure('public.bank_transfer_rpc_before_daily_limit(uuid,text,bigint)') is null then
    raise exception 'Run BANK_TRANSFER_DAILY_LIMIT_MIGRATION.sql before BANK_TRANSFER_OVER_LIMIT_FEE_MIGRATION.sql';
  end if;
end;
$$;

create or replace function public.bank_transfer_rpc(
  p_player_id uuid,
  p_recipient_nickname text,
  p_amount bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_transfer_date date := (v_now at time zone 'Europe/Moscow')::date;
  v_recipient_id uuid;
  v_sender_balance bigint;
  v_limit bigint;
  v_used bigint;
  v_premium_until timestamptz;
  v_fee_percent integer := 0;
  v_fee bigint := 0;
  v_result jsonb;
  v_new_balance bigint;
begin
  if p_player_id is null then
    return jsonb_build_object('error', 'Не удалось определить отправителя перевода');
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 10000000 then
    return jsonb_build_object('error', 'Сумма перевода должна быть от 1 до 10 000 000 ₽');
  end if;

  select id into v_recipient_id
    from public.players
   where lower(nickname) = lower(trim(p_recipient_nickname))
   limit 1;
  if v_recipient_id is null then
    return jsonb_build_object('error', 'Игрок с таким ником не найден');
  end if;
  if v_recipient_id = p_player_id then
    return jsonb_build_object('error', 'Нельзя перевести деньги самому себе');
  end if;

  select premium_until into v_premium_until
    from public.players
   where id = p_player_id;
  if not found then
    return jsonb_build_object('error', 'Игрок не найден');
  end if;

  v_limit := case when v_premium_until > v_now then 250000 else 100000 end;
  v_fee_percent := case when v_premium_until > v_now then 10 else 20 end;

  -- Lock both accounts in a stable order before the daily counter. This keeps
  -- concurrent transfers in opposite directions from deadlocking and ensures
  -- the sender can cover both the transfer and any fee.
  insert into public.bank_accounts(player_id)
  select ids.player_id
    from unnest(array[p_player_id, v_recipient_id]) as ids(player_id)
   order by ids.player_id
  on conflict (player_id) do nothing;

  perform 1
    from public.bank_accounts
   where player_id in (p_player_id, v_recipient_id)
   order by player_id
   for update;

  select balance into v_sender_balance
    from public.bank_accounts
   where player_id = p_player_id;

  insert into public.bank_transfer_daily_totals(player_id, transfer_date, amount_sent)
  values (p_player_id, v_transfer_date, 0)
  on conflict (player_id, transfer_date) do nothing;

  select amount_sent into v_used
    from public.bank_transfer_daily_totals
   where player_id = p_player_id and transfer_date = v_transfer_date
   for update;

  if v_used + p_amount > v_limit then
    v_fee := greatest(1, ceil(p_amount * v_fee_percent / 100.0)::bigint);
  else
    v_fee_percent := 0;
  end if;

  if coalesce(v_sender_balance, 0) < p_amount + v_fee then
    return jsonb_build_object(
      'error', case when v_fee > 0
        then format('На счёте не хватает денег на перевод и комиссию %s%%', v_fee_percent)
        else 'Недостаточно денег на банковском счёте'
      end,
      'transfer_amount', p_amount,
      'fee', v_fee,
      'commission_percent', v_fee_percent
    );
  end if;

  v_result := public.bank_transfer_rpc_before_daily_limit(
    p_player_id, p_recipient_nickname, p_amount
  );
  if v_result is null
     or v_result ? 'error'
     or coalesce((v_result->>'success')::boolean, false) is not true then
    return coalesce(v_result, jsonb_build_object('error', 'Не удалось выполнить перевод'));
  end if;

  if v_fee > 0 then
    update public.bank_accounts
       set balance = balance - v_fee,
           updated_at = v_now
     where player_id = p_player_id
     returning balance into v_new_balance;

    insert into public.bank_transactions(player_id, operation, amount, details)
    values (
      p_player_id,
      'transfer_fee',
      -v_fee,
      jsonb_build_object(
        'nickname', p_recipient_nickname,
        'transfer_amount', p_amount,
        'commission_percent', v_fee_percent
      )
    );
  else
    v_new_balance := (v_result->>'balance')::bigint;
  end if;

  update public.bank_transfer_daily_totals
     set amount_sent = v_used + p_amount,
         updated_at = v_now
   where player_id = p_player_id and transfer_date = v_transfer_date;

  return v_result || jsonb_build_object(
    'balance', v_new_balance,
    'transfer_amount', p_amount,
    'fee', v_fee,
    'commission_percent', v_fee_percent,
    'sender_debit', p_amount + v_fee,
    'daily_limit', v_limit,
    'daily_used', v_used + p_amount,
    'daily_remaining', greatest(0, v_limit - v_used - p_amount)
  );
end;
$$;

revoke all on function public.bank_transfer_rpc(uuid, text, bigint)
  from public, anon, authenticated;
grant execute on function public.bank_transfer_rpc(uuid, text, bigint) to service_role;

notify pgrst, 'reload schema';
