-- Adds a human-readable reason to every new player balance-change log.
-- Run once in Supabase SQL Editor after the base schema is installed.

create or replace function public.admin_give_money_rpc(
  p_admin_id uuid,
  p_target_player_id uuid,
  p_amount bigint
)
returns jsonb
language plpgsql
security definer
as $$
declare
  a public.players;
  t public.players;
begin
  select * into a from public.players where id = p_admin_id;
  if a.role is distinct from 'admin' and a.role is distinct from 'superadmin' then
    return jsonb_build_object('error', 'не админ');
  end if;

  select * into t from public.players where id = p_target_player_id for update;
  if not found then return jsonb_build_object('error', 'игрок не найден'); end if;
  if coalesce(t.money, 0) + p_amount < 0 then
    return jsonb_build_object('error', 'уход в минус');
  end if;

  -- The audit trigger uses this transaction-local value for the actor label.
  perform set_config('app.money_actor_id', p_admin_id::text, true);
  update public.players
     set money = coalesce(money, 0) + p_amount
   where id = p_target_player_id;

  perform public.log_action_rpc(
    p_target_player_id,
    'admin_give_money',
    jsonb_build_object('from_admin', a.nickname),
    greatest(-2147483648::bigint, least(2147483647::bigint, p_amount))::integer,
    greatest(-2147483648::bigint, least(2147483647::bigint, t.money::bigint + p_amount))::integer
  );
  return jsonb_build_object('success', true, 'money', t.money + p_amount);
end;
$$;

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
  v_actor_id uuid;
  v_actor_nickname text;
  v_delta bigint;
  v_details jsonb;
  v_log_ctid tid;
begin
  if new.money is not distinct from old.money then return new; end if;

  v_delta := new.money::bigint - old.money::bigint;
  get diagnostics v_context = pg_context;
  for v_match in
    select regexp_matches(v_context, 'PL/pgSQL function (?:public[.])?([[:alnum:]_]+)[(]', 'g')
  loop
    if v_match[1] not in ('audit_player_money_change', 'change_stats', 'log_action_rpc') then
      v_source := v_match[1];
      exit;
    end if;
  end loop;
  v_source := coalesce(v_source, 'direct_database_update');

  v_reason := case
    when v_source = 'admin_give_money_rpc' then 'Выдача денег администратором'
    when v_source = 'work_rpc' then 'Выплата за работу'
    when v_source = 'pay_workers_for_batch' then 'Зарплата от бизнеса за рабочую смену'
    when v_source = 'finish_profession_cycle_rpc' then 'Награда за смену профессии'
    when v_source = 'claim_profession_reward_rpc' then 'Награда за действие в профессии'
    when v_source = 'sell_inventory_rpc' then 'Продажа предмета из инвентаря'
    when v_source = 'buy_market_item' and v_delta > 0 then 'Продажа предмета на рынке'
    when v_source = 'buy_market_item' then 'Покупка на рынке'
    when v_source in ('collect_business_passive_rpc', 'business_worker_passive_trigger') then 'Пассивный доход бизнеса'
    when v_source like 'collect_%' then 'Сбор дохода бизнеса'
    when v_source = 'claim_daily_mission_rpc' then 'Награда за ежедневное задание'
    when v_source in ('claim_daily_reward_rpc', 'claim_daily_rpc') then 'Ежедневная награда'
    when v_source in ('redeem_promo_rpc', 'redeem_promo') then 'Награда за промокод'
    when v_source = 'collect_return_bonus_rpc' then 'Бонус за возвращение в игру'
    when v_source in ('invite_friend_rpc', 'collect_ref_bonus_rpc', 'add_referral_balance') then 'Реферальная награда'
    when v_source like '%casino%' or v_source like '%round%' then 'Выплата казино'
    when v_delta > 0 then 'Начисление: ' || replace(v_source, '_', ' ')
    else 'Списание: ' || replace(v_source, '_', ' ')
  end;

  begin
    v_actor_id := nullif(current_setting('app.money_actor_id', true), '')::uuid;
  exception when invalid_text_representation then
    v_actor_id := null;
  end;
  if v_actor_id is not null then
    select nickname into v_actor_nickname from public.players where id = v_actor_id;
  end if;

  v_details := jsonb_build_object(
    'reason', v_reason,
    'source_function', v_source,
    'money_old', old.money,
    'money_new', new.money,
    'telegram_id', new.telegram_id
  );
  if v_actor_id is not null then
    v_details := v_details || jsonb_build_object(
      'actor_id', v_actor_id,
      'actor_nickname', v_actor_nickname,
      'actor_label', 'выдал'
    );
  end if;

  -- Enrich an existing generic money log if another installed trigger already
  -- wrote it in this transaction; otherwise create the row here.
  select ctid into v_log_ctid
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

-- The current admin UI sends p_player_query to filter logs by nickname,
-- Telegram ID, or player UUID. Replace the old three-argument function so the
-- RPC signature in PostgREST matches that request.
drop function if exists public.get_logs_rpc(uuid, integer, text);
create or replace function public.get_logs_rpc(
  p_admin_id uuid,
  p_limit int default 200,
  p_action_type text default null,
  p_player_query text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin(p_admin_id) then
    return jsonb_build_object('error', 'не админ');
  end if;

  return jsonb_build_object('logs', (
    select jsonb_agg(l order by l.created_at desc)
      from (
        select l.*
          from public.action_logs l
          left join public.players p on p.id = l.player_id
         where l.action_type not in ('casino_bet', 'casino_resolve')
           and (p_action_type is null or l.action_type = p_action_type)
           and (nullif(trim(p_player_query), '') is null
             or l.player_id::text = trim(p_player_query)
             or coalesce(p.telegram_id::text, '') = trim(p_player_query)
             or lower(coalesce(p.nickname, '')) = lower(trim(p_player_query)))
         order by l.created_at desc
         limit least(coalesce(p_limit, 200), 500)
      ) l
  ));
end;
$$;

notify pgrst, 'reload schema';
