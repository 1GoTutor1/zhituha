-- Keep money_change audit rows only for money received from bank operations
-- and proceeds from selling owned assets. This does not change game payouts.
-- Run after MONEY_CHANGE_SOURCE_AUDIT_MIGRATION.sql.

create or replace function public.audit_player_money_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context text;
  v_match text[];
  v_source text;
  v_reason text;
  v_delta bigint;
  v_details jsonb;
  v_log_ctid tid;
begin
  if new.money is not distinct from old.money then
    return new;
  end if;

  v_delta := new.money::bigint - old.money::bigint;
  -- Only record receipts. Deposits, purchases, fees and other debits are noise here.
  if v_delta <= 0 then
    return new;
  end if;

  get diagnostics v_context = pg_context;
  for v_match in
    select regexp_matches(
      v_context,
      'PL/pgSQL function (?:public[.])?([[:alnum:]_]+)[(]',
      'g'
    )
  loop
    if v_match[1] not in ('audit_player_money_change', 'change_stats', 'log_action_rpc') then
      v_source := v_match[1];
      exit;
    end if;
  end loop;
  v_source := coalesce(v_source, 'direct_database_update');

  -- Bank credits plus sales of owned property/assets. In particular, this
  -- excludes profession payouts, ore/item sales, business income and rewards.
  if not (
    left(v_source, 5) = 'bank_'
    or v_source in (
      'buy_market_item',
      'sell_business_rpc',
      'sell_business_to_state_rpc',
      'business_auctions_settle_rpc'
    )
  ) then
    return new;
  end if;

  v_reason := case
    when left(v_source, 5) = 'bank_' then 'Поступление из банка'
    when v_source = 'buy_market_item' then 'Продажа имущества на рынке'
    when v_source in ('sell_business_rpc', 'sell_business_to_state_rpc') then 'Продажа бизнеса'
    when v_source = 'business_auctions_settle_rpc' then 'Продажа бизнеса на аукционе'
    else 'Поступление'
  end;

  v_details := jsonb_build_object(
    'reason', v_reason,
    'source_function', v_source,
    'money_old', old.money,
    'money_new', new.money,
    'telegram_id', new.telegram_id
  );

  -- Preserve the existing deduplication behavior if another trigger already
  -- wrote a generic money_change row in the same transaction.
  select ctid
    into v_log_ctid
    from public.action_logs
   where player_id = new.id
     and action_type = 'money_change'
     and money_delta = greatest(-2147483648::bigint, least(2147483647::bigint, v_delta))::integer
     and money_after = greatest(-2147483648::bigint, least(2147483647::bigint, new.money::bigint))::integer
     and created_at >= transaction_timestamp()
   order by created_at desc
   limit 1;

  if v_log_ctid is not null then
    update public.action_logs
       set details = coalesce(details, '{}'::jsonb) || v_details
     where ctid = v_log_ctid;
  else
    insert into public.action_logs(player_id, action_type, details, money_delta, money_after)
    values (
      new.id,
      'money_change',
      v_details,
      greatest(-2147483648::bigint, least(2147483647::bigint, v_delta))::integer,
      greatest(-2147483648::bigint, least(2147483647::bigint, new.money::bigint))::integer
    );
  end if;

  return new;
end;
$$;

drop trigger if exists zzzz_players_money_source_audit on public.players;
create trigger zzzz_players_money_source_audit
after update of money on public.players
for each row execute function public.audit_player_money_change();

notify pgrst, 'reload schema';
