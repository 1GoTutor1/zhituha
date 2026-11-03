-- Referral activation and inactivity-return rewards.
-- Run after DONATION_PROFILE_MIGRATION.sql and the current work/profession migrations.

create table if not exists public.referral_visit_days (
  player_id uuid not null references public.players(id) on delete cascade,
  visit_date date not null,
  created_at timestamptz not null default now(),
  primary key (player_id, visit_date)
);
alter table public.referral_visit_days enable row level security;
revoke all on public.referral_visit_days from public, anon, authenticated;
grant select, insert, update, delete on public.referral_visit_days to service_role;

alter table public.players
  add column if not exists last_active_at timestamptz,
  add column if not exists return_bonus_reminded_at timestamptz,
  add column if not exists return_reminder_attempted_at timestamptz not null default 'epoch'::timestamptz,
  add column if not exists return_bonus_claimed_at timestamptz,
  add column if not exists return_boost_until timestamptz,
  add column if not exists referral_signup_rewarded_at timestamptz,
  add column if not exists referral_commission_until timestamptz,
  add column if not exists referral_commission_earned bigint not null default 0,
  add column if not exists daily_reminder_sent_for_claim bigint not null default 0,
  add column if not exists daily_reminder_attempted_at bigint not null default 0;

-- Existing players start with a fresh activity timestamp, so rollout does not
-- unexpectedly award every old account on its first request.
update public.players set last_active_at = clock_timestamp() where last_active_at is null;
alter table public.players alter column last_active_at set default now();
alter table public.players alter column last_active_at set not null;
update public.players
set referral_commission_until = referral_signup_rewarded_at + interval '14 days'
where referred_by is not null and referral_signup_rewarded_at is not null and referral_commission_until is null;

create index if not exists players_return_reminder_queue_idx
  on public.players (last_active_at, return_reminder_attempted_at)
  where return_bonus_reminded_at is null;

create or replace function public.player_touch_activity_rpc(p_player_id uuid)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  p public.players;
  v_now timestamptz := clock_timestamp();
  v_return_bonus jsonb := jsonb_build_object('granted', false);
begin
  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'player not found'); end if;

  if p.last_active_at <= v_now - interval '24 hours'
     and (p.return_bonus_claimed_at is null or p.return_bonus_claimed_at <= v_now - interval '7 days') then
    update public.players
      set money = coalesce(money, 0) + 5000,
          return_bonus_claimed_at = v_now,
          return_boost_until = v_now + interval '2 hours',
          last_active_at = v_now,
          return_bonus_reminded_at = null,
          return_reminder_attempted_at = 'epoch'::timestamptz
      where id = p_player_id
      returning * into p;
    v_return_bonus := jsonb_build_object('granted', true, 'money', 5000, 'boost_percent', 15,
      'boost_until', p.return_boost_until, 'cooldown_days', 7);
  else
    update public.players
      set last_active_at = v_now,
          return_bonus_reminded_at = null,
          return_reminder_attempted_at = 'epoch'::timestamptz
      where id = p_player_id
      returning * into p;
  end if;

  insert into public.referral_visit_days(player_id, visit_date)
    values (p_player_id, (v_now at time zone 'Europe/Moscow')::date)
    on conflict (player_id, visit_date) do nothing;

  return jsonb_build_object('money', p.money, 'return_boost_until', p.return_boost_until,
    'return_bonus', v_return_bonus);
end;
$$;

-- This is called only after a successful work RPC. The invitee must also have
-- logged in on two distinct Moscow calendar days. The row lock makes rewards one-shot.
create or replace function public.activate_referral_after_work_rpc(p_new_player_id uuid)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare invitee public.players; inviter public.players;
begin
  select * into invitee from public.players where id = p_new_player_id for update;
  if not found or invitee.referred_by is null then return jsonb_build_object('activated', false); end if;
  if invitee.referral_signup_rewarded_at is not null then
    return jsonb_build_object('activated', false, 'duplicate', true);
  end if;
  if (select count(*) from public.referral_visit_days where player_id = p_new_player_id) < 2 then
    return jsonb_build_object('activated', false, 'visits_required', 2);
  end if;

  select * into inviter from public.players where telegram_id = invitee.referred_by for update;
  if not found then return jsonb_build_object('activated', false, 'referrer_missing', true); end if;

  update public.players
    set money = coalesce(money, 0) + 500,
        premium_balance = coalesce(premium_balance, 0) + 10
    where id = inviter.id
    returning * into inviter;
  update public.players
    set referral_signup_rewarded_at = clock_timestamp(),
        referral_commission_until = clock_timestamp() + interval '14 days'
    where id = p_new_player_id;

  return jsonb_build_object('activated', true, 'referrer_money_bonus', 500,
    'referrer_token_bonus', 10, 'referrer_money', inviter.money,
    'referrer_premium_balance', inviter.premium_balance);
end;
$$;

create or replace function public.claim_return_reminder_targets_rpc(p_limit integer default 25)
returns table (id uuid, telegram_id text, last_active_at timestamptz)
language sql security definer
set search_path = pg_catalog, public, pg_temp
as $$
  with clock_now as (select clock_timestamp() as now_at), targets as (
    select p.id
    from public.players p cross join clock_now c
    where p.last_active_at <= c.now_at - interval '24 hours'
      and p.return_bonus_reminded_at is null
      and p.return_reminder_attempted_at <= c.now_at - interval '5 minutes'
      and (p.return_bonus_claimed_at is null or p.return_bonus_claimed_at <= c.now_at - interval '7 days')
      and coalesce(p.is_banned, false) = false
    order by p.return_reminder_attempted_at asc, p.last_active_at asc
    for update of p skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 50)
  )
  update public.players p
  set return_reminder_attempted_at = c.now_at
  from targets t cross join clock_now c
  where p.id = t.id
  returning p.id, p.telegram_id, p.last_active_at;
$$;

create or replace function public.mark_return_reminder_sent_rpc(p_player_id uuid, p_last_active_at timestamptz)
returns boolean
language sql security definer
set search_path = pg_catalog, public, pg_temp
as $$
  update public.players
  set return_bonus_reminded_at = clock_timestamp()
  where id = p_player_id and last_active_at = p_last_active_at
    and last_active_at <= clock_timestamp() - interval '24 hours'
    and return_bonus_reminded_at is null
  returning true;
$$;

-- Preserve the existing daily reward reminder while sharing its scheduled endpoint.
create or replace function public.claim_daily_reminder_targets_rpc(p_limit integer default 25)
returns table (id uuid, telegram_id text, nickname text, daily_streak integer, last_claim bigint)
language sql security definer
set search_path = pg_catalog, public, pg_temp
as $$
  with clock_now as (
    select floor(extract(epoch from clock_timestamp()) * 1000)::bigint as now_ms
  ), targets as (
    select p.id
    from public.players p cross join clock_now c
    where p.last_claim > 0
      and p.daily_reminder_sent_for_claim is distinct from p.last_claim
      and p.daily_reminder_attempted_at <= c.now_ms - 300000
      and ((coalesce(p.daily_streak, 0) < 7 and p.last_claim <= c.now_ms - 86400000)
        or (coalesce(p.daily_streak, 0) >= 7 and p.last_claim < c.now_ms - 172800000))
    order by p.daily_reminder_attempted_at asc, p.last_claim asc
    for update of p skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 50)
  )
  update public.players p
  set daily_reminder_attempted_at = c.now_ms
  from targets t cross join clock_now c
  where p.id = t.id
  returning p.id, p.telegram_id, p.nickname, p.daily_streak, p.last_claim;
$$;

create or replace function public.mark_daily_reminder_sent_rpc(p_player_id uuid, p_last_claim bigint)
returns boolean
language sql security definer
set search_path = pg_catalog, public, pg_temp
as $$
  update public.players
  set daily_reminder_sent_for_claim = p_last_claim
  where id = p_player_id and last_claim = p_last_claim
    and daily_reminder_sent_for_claim is distinct from p_last_claim
  returning true;
$$;

create or replace function public.apply_return_boost_bonus_rpc(p_player_id uuid, p_base_amount bigint)
returns bigint
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_bonus bigint; v_now timestamptz := clock_timestamp();
begin
  if coalesce(p_base_amount, 0) <= 0 then return 0; end if;
  v_bonus := floor(p_base_amount * 0.15)::bigint;
  if v_bonus <= 0 then return 0; end if;
  update public.players set money = coalesce(money, 0) + v_bonus
  where id = p_player_id and return_boost_until > v_now;
  if not found then return 0; end if;
  return v_bonus;
end;
$$;

-- Wrap existing payout functions rather than replacing their business logic.
do $$ begin
  if to_regprocedure('public.work_rpc_before_return_bonus(uuid)') is null then
    execute 'alter function public.work_rpc(uuid) rename to work_rpc_before_return_bonus';
  end if;
end $$;
create or replace function public.work_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare r jsonb; base_amount bigint; extra bigint; next_money bigint; referral_result jsonb;
  referrer_tg text; referral_before bigint; referral_after bigint; old_commission bigint;
  new_commission bigint; earned_so_far bigint; commission_until timestamptz;
begin
  select referred_by into referrer_tg from public.players where id = p_player_id for update;
  if referrer_tg is not null then
    select coalesce(referral_balance, 0) into referral_before
      from public.players where telegram_id = referrer_tg for update;
  end if;
  r := public.work_rpc_before_return_bonus(p_player_id);
  if r is null or r ? 'error' or r->>'work_pay' is null then return r; end if;
  referral_result := public.activate_referral_after_work_rpc(p_player_id);
  if coalesce((referral_result->>'activated')::boolean, false) then
    r := r || jsonb_build_object('referral_activated', true);
  end if;
  base_amount := greatest(0, coalesce((r->>'work_pay')::bigint, 0));
  if referrer_tg is not null and referral_before is not null then
    select coalesce(referral_balance, 0) into referral_after
      from public.players where telegram_id = referrer_tg;
    old_commission := greatest(0, coalesce(referral_after, referral_before) - referral_before);
    if old_commission > 0 then
      select coalesce(referral_commission_earned, 0), referral_commission_until
        into earned_so_far, commission_until from public.players where id = p_player_id for update;
      new_commission := case
        when commission_until > clock_timestamp() and earned_so_far < 10000
          then least(old_commission, 10000 - earned_so_far)
        else 0 end;
      update public.players set referral_balance = greatest(0, coalesce(referral_balance, 0) - old_commission)
        where telegram_id = referrer_tg;
      if new_commission > 0 then
        update public.players set referral_balance = coalesce(referral_balance, 0) + new_commission
          where telegram_id = referrer_tg;
        update public.players set referral_commission_earned = coalesce(referral_commission_earned, 0) + new_commission
          where id = p_player_id;
      end if;
    end if;
  end if;
  extra := public.apply_return_boost_bonus_rpc(p_player_id, base_amount);
  if extra > 0 then
    select money into next_money from public.players where id = p_player_id;
    r := r || jsonb_build_object('work_pay', base_amount + extra, 'return_bonus_income', extra, 'money', next_money);
  end if;
  return r;
end $$;

do $$ begin
  if to_regprocedure('public.finish_profession_cycle_rpc_before_return_bonus(uuid)') is null then
    execute 'alter function public.finish_profession_cycle_rpc(uuid) rename to finish_profession_cycle_rpc_before_return_bonus';
  end if;
end $$;
create or replace function public.finish_profession_cycle_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare r jsonb; base_amount bigint; extra bigint; next_money bigint;
begin
  r := public.finish_profession_cycle_rpc_before_return_bonus(p_player_id);
  if r is null or r ? 'error' or r->>'cash_reward' is null then return r; end if;
  base_amount := greatest(0, coalesce((r->>'cash_reward')::bigint, 0));
  extra := public.apply_return_boost_bonus_rpc(p_player_id, base_amount);
  if extra > 0 then
    select money into next_money from public.players where id = p_player_id;
    r := r || jsonb_build_object('cash_reward', base_amount + extra, 'return_bonus_income', extra, 'money', next_money);
  end if;
  return r;
end $$;

do $$ begin
  if to_regprocedure('public.sell_inventory_rpc_before_return_bonus(uuid,text,integer)') is null then
    execute 'alter function public.sell_inventory_rpc(uuid,text,integer) rename to sell_inventory_rpc_before_return_bonus';
  end if;
end $$;
create or replace function public.sell_inventory_rpc(p_player_id uuid, p_item_id text, p_quantity integer)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare r jsonb; base_amount bigint; extra bigint; next_money bigint;
begin
  r := public.sell_inventory_rpc_before_return_bonus(p_player_id, p_item_id, p_quantity);
  if r is null or r ? 'error' or not coalesce((r->>'success')::boolean, false) then return r; end if;
  base_amount := greatest(0, coalesce((r->>'proceeds')::bigint, 0));
  extra := public.apply_return_boost_bonus_rpc(p_player_id, base_amount);
  if extra > 0 then
    select money into next_money from public.players where id = p_player_id;
    r := r || jsonb_build_object('proceeds', base_amount + extra, 'return_bonus_income', extra, 'money', next_money);
  end if;
  return r;
end $$;

do $$ begin
  if to_regprocedure('public.claim_profession_reward_rpc_before_return_bonus(uuid,text)') is null then
    execute 'alter function public.claim_profession_reward_rpc(uuid,text) rename to claim_profession_reward_rpc_before_return_bonus';
  end if;
end $$;
create or replace function public.claim_profession_reward_rpc(p_player_id uuid, p_choice text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare r jsonb; base_amount bigint; extra bigint; next_money bigint;
begin
  r := public.claim_profession_reward_rpc_before_return_bonus(p_player_id, p_choice);
  if r is null or r ? 'error' or p_choice <> 'sell' or not coalesce((r->>'success')::boolean, false) then return r; end if;
  base_amount := greatest(0, coalesce((r->>'proceeds')::bigint, 0));
  extra := public.apply_return_boost_bonus_rpc(p_player_id, base_amount);
  if extra > 0 then
    select money into next_money from public.players where id = p_player_id;
    r := r || jsonb_build_object('proceeds', base_amount + extra, 'return_bonus_income', extra, 'money', next_money);
  end if;
  return r;
end $$;

do $$ begin
  if to_regprocedure('public.collect_coffee_cash_rpc_before_return_bonus(uuid,uuid)') is null then
    execute 'alter function public.collect_coffee_cash_rpc(uuid,uuid) rename to collect_coffee_cash_rpc_before_return_bonus';
  end if;
end $$;
create or replace function public.collect_coffee_cash_rpc(p_biz_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare r jsonb; base_amount bigint; extra bigint; next_money bigint;
  referrer_tg text; old_commission bigint; new_commission bigint; earned_so_far bigint; commission_until timestamptz;
begin
  r := public.collect_coffee_cash_rpc_before_return_bonus(p_biz_id, p_player_id);
  if r is null or r ? 'error' then return r; end if;
  base_amount := greatest(0, coalesce((r->>'collected')::bigint, 0));
  select referred_by, coalesce(referral_commission_earned, 0), referral_commission_until
    into referrer_tg, earned_so_far, commission_until from public.players where id = p_player_id for update;
  old_commission := floor(base_amount * 0.05)::bigint;
  if referrer_tg is not null and old_commission > 0 then
    new_commission := case
      when commission_until > clock_timestamp() and earned_so_far < 10000
        then least(old_commission, 10000 - earned_so_far)
      else 0 end;
    update public.players set referral_balance = greatest(0, coalesce(referral_balance, 0) - old_commission)
      where telegram_id = referrer_tg;
    if new_commission > 0 then
      update public.players set referral_balance = coalesce(referral_balance, 0) + new_commission
        where telegram_id = referrer_tg;
      update public.players set referral_commission_earned = coalesce(referral_commission_earned, 0) + new_commission
        where id = p_player_id;
    end if;
  end if;
  extra := public.apply_return_boost_bonus_rpc(p_player_id, base_amount);
  if extra > 0 then
    select money into next_money from public.players where id = p_player_id;
    r := r || jsonb_build_object('collected', base_amount + extra, 'return_bonus_income', extra, 'money', next_money);
  end if;
  return r;
end $$;

do $$ begin
  if to_regprocedure('public.collect_business_passive_rpc_before_return_bonus(uuid,uuid)') is null then
    execute 'alter function public.collect_business_passive_rpc(uuid,uuid) rename to collect_business_passive_rpc_before_return_bonus';
  end if;
end $$;
create or replace function public.collect_business_passive_rpc(p_biz_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare r jsonb; base_amount bigint; extra bigint; next_money bigint;
begin
  r := public.collect_business_passive_rpc_before_return_bonus(p_biz_id, p_player_id);
  if r is null or r ? 'error' then return r; end if;
  base_amount := greatest(0, coalesce((r->>'collected')::bigint, 0));
  extra := public.apply_return_boost_bonus_rpc(p_player_id, base_amount);
  if extra > 0 then
    select money into next_money from public.players where id = p_player_id;
    r := r || jsonb_build_object('collected', base_amount + extra, 'return_bonus_income', extra, 'money', next_money);
  end if;
  return r;
end $$;

do $$ begin
  if to_regprocedure('public.collect_tips_rpc_before_return_bonus(uuid)') is null then
    execute 'alter function public.collect_tips_rpc(uuid) rename to collect_tips_rpc_before_return_bonus';
  end if;
end $$;
create or replace function public.collect_tips_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare r jsonb; base_amount bigint; extra bigint; next_money bigint;
begin
  r := public.collect_tips_rpc_before_return_bonus(p_player_id);
  if r is null or r ? 'error' then return r; end if;
  base_amount := greatest(0, coalesce((r->>'collected')::bigint, 0));
  extra := public.apply_return_boost_bonus_rpc(p_player_id, base_amount);
  if extra > 0 then
    select money into next_money from public.players where id = p_player_id;
    r := r || jsonb_build_object('collected', base_amount + extra, 'return_bonus_income', extra, 'money', next_money);
  end if;
  return r;
end $$;

do $$ begin
  if to_regprocedure('public.taxi_collect_rpc_before_return_bonus(uuid,uuid)') is null then
    execute 'alter function public.taxi_collect_rpc(uuid,uuid) rename to taxi_collect_rpc_before_return_bonus';
  end if;
end $$;
create or replace function public.taxi_collect_rpc(p_biz_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare r jsonb; base_amount bigint; extra bigint; next_money bigint;
begin
  r := public.taxi_collect_rpc_before_return_bonus(p_biz_id, p_player_id);
  if r is null or r ? 'error' then return r; end if;
  base_amount := greatest(0, coalesce((r->>'income')::bigint, 0));
  extra := public.apply_return_boost_bonus_rpc(p_player_id, base_amount);
  if extra > 0 then
    select money into next_money from public.players where id = p_player_id;
    r := r || jsonb_build_object('income', base_amount + extra, 'return_bonus_income', extra, 'money', next_money);
  end if;
  return r;
end $$;

revoke all on function public.player_touch_activity_rpc(uuid),
  public.activate_referral_after_work_rpc(uuid),
  public.claim_return_reminder_targets_rpc(integer),
  public.mark_return_reminder_sent_rpc(uuid,timestamptz),
  public.claim_daily_reminder_targets_rpc(integer), public.mark_daily_reminder_sent_rpc(uuid,bigint),
  public.apply_return_boost_bonus_rpc(uuid,bigint),
  public.work_rpc_before_return_bonus(uuid), public.work_rpc(uuid),
  public.finish_profession_cycle_rpc_before_return_bonus(uuid), public.finish_profession_cycle_rpc(uuid),
  public.sell_inventory_rpc_before_return_bonus(uuid,text,integer), public.sell_inventory_rpc(uuid,text,integer),
  public.claim_profession_reward_rpc_before_return_bonus(uuid,text), public.claim_profession_reward_rpc(uuid,text),
  public.collect_coffee_cash_rpc_before_return_bonus(uuid,uuid), public.collect_coffee_cash_rpc(uuid,uuid),
  public.collect_business_passive_rpc_before_return_bonus(uuid,uuid), public.collect_business_passive_rpc(uuid,uuid),
  public.collect_tips_rpc_before_return_bonus(uuid), public.collect_tips_rpc(uuid),
  public.taxi_collect_rpc_before_return_bonus(uuid,uuid), public.taxi_collect_rpc(uuid,uuid)
from public, anon, authenticated;

grant execute on function public.player_touch_activity_rpc(uuid),
  public.claim_return_reminder_targets_rpc(integer),
  public.mark_return_reminder_sent_rpc(uuid,timestamptz),
  public.claim_daily_reminder_targets_rpc(integer), public.mark_daily_reminder_sent_rpc(uuid,bigint),
  public.work_rpc(uuid), public.finish_profession_cycle_rpc(uuid),
  public.sell_inventory_rpc(uuid,text,integer), public.claim_profession_reward_rpc(uuid,text),
  public.collect_coffee_cash_rpc(uuid,uuid), public.collect_business_passive_rpc(uuid,uuid),
  public.collect_tips_rpc(uuid), public.taxi_collect_rpc(uuid,uuid)
to service_role;

-- Reuse the existing hourly/minute Supabase reminder runner when present;
-- create it only if the daily-reminders job has not already been configured.
create extension if not exists pg_cron;
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'daily-reward-reminders') then
    if not exists (select 1 from vault.decrypted_secrets where name = 'daily_reminders_url')
       or not exists (select 1 from vault.decrypted_secrets where name = 'daily_reminders_cron_secret') then
      raise exception 'Add daily_reminders_url and daily_reminders_cron_secret to Supabase Vault before scheduling return reminders';
    end if;
    perform cron.schedule(
      'daily-reward-reminders',
      '* * * * *',
      $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'daily_reminders_url'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'daily_reminders_cron_secret')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 5000
        );
      $job$
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
