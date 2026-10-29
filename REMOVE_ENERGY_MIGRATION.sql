-- Remove energy as a gameplay mechanic. Keep players.energy for schema compatibility.
-- Safe to rerun. Apply this in Supabase SQL Editor after the profession migrations.

create or replace function public.start_profession_cycle_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.players;
  active public.profession_cycles;
  slots integer;
begin
  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Player not found'); end if;

  select * into active from public.profession_cycles
  where player_id = p_player_id and status = 'completed_pending'
  order by created_at desc limit 1;
  if found then
    return jsonb_build_object('error', 'Claim the pending profession reward first', 'pending_reward', active.result);
  end if;

  select * into active from public.profession_cycles
  where player_id = p_player_id and status = 'active'
  order by created_at desc limit 1;
  if found then
    return jsonb_build_object('error', 'Finish the current profession action first', 'active_cycle',
      jsonb_build_object('id', active.id, 'profession', active.profession, 'started_at', active.started_at,
        'completes_at', active.completes_at, 'actions_done', active.actions_done));
  end if;

  if not p.active_profession = any(coalesce(p.unlocked_professions, array['miner']::text[])) then
    return jsonb_build_object('error', 'Profession is locked');
  end if;
  if p.active_profession = 'taxi' and not exists (
    select 1 from public.business_workers w
    join public.businesses b on b.id = w.business_id
    where w.player_id = p_player_id and w.role = convert_from(decode('d092d0bed0b4d0b8d182d0b5d0bbd18c', 'hex'), 'UTF8') and b.biz_type = 'taxi'
  ) then
    return jsonb_build_object('error', 'Join a taxi fleet as a driver first');
  end if;
  if p.active_profession in ('miner', 'lumberjack', 'fisherman', 'farmer') then
    select count(*) into slots from public.player_inventory where player_id = p_player_id and quantity > 0;
    if slots >= 200 then return jsonb_build_object('error', 'Inventory full (200/200)', 'inventory_full', true); end if;
  end if;

  insert into public.profession_cycles(player_id, profession, completes_at)
  values (p_player_id, p.active_profession, clock_timestamp() + interval '30 seconds')
  returning * into active;
  return jsonb_build_object('success', true, 'active_cycle', jsonb_build_object(
    'id', active.id, 'profession', active.profession, 'started_at', active.started_at,
    'completes_at', active.completes_at, 'actions_done', active.actions_done));
end;
$$;

create or replace function public.profession_step_rpc(p_player_id uuid, p_step smallint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare c public.profession_cycles;
begin
  if p_step is null or p_step not between 1 and 3 then
    return jsonb_build_object('error', 'Invalid profession action');
  end if;
  select * into c from public.profession_cycles
  where player_id = p_player_id and status = 'active'
  order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('error', 'No active profession action'); end if;
  if p_step <> c.actions_done + 1 then return jsonb_build_object('error', 'Profession actions must be completed in order'); end if;

  update public.profession_cycles
  set actions_done = p_step,
      completes_at = case when p_step = 3 then clock_timestamp() else completes_at end
  where id = c.id;
  return jsonb_build_object('success', true, 'actions_done', p_step,
    'completes_at', case when p_step = 3 then clock_timestamp() else c.completes_at end);
end;
$$;

create or replace function public.work_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.players;
  business_bonus integer;
  work_pay integer;
  today text;
  hash_value bigint := 0;
  day_index integer;
  i integer;
begin
  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Player not found'); end if;

  select coalesce(sum(case biz_type
    when 'coffee' then 5 when 'salon' then 10 when 'taxi' then 15
    when 'phone_factory' then 20 when 'construction' then 25 else 0 end), 0)::int
  into business_bonus from public.businesses where owner_id = p_player_id;

  today := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  for i in 1..length(today) loop
    hash_value := mod(hash_value * 31 + ascii(substr(today, i, 1)), 4294967296);
  end loop;
  day_index := mod(abs(hash_value), 10)::int;
  work_pay := floor(150 * (1 + business_bonus / 100.0));

  update public.players
  set money = coalesce(money, 0) + work_pay,
      player_xp = coalesce(player_xp, 0) + 25
  where id = p_player_id returning * into p;
  if p.referred_by is not null then
    update public.players set referral_balance = coalesce(referral_balance, 0) +
      floor(work_pay * 0.05 * case when day_index = 6 then 2 else 1 end)
    where telegram_id = p.referred_by;
  end if;

  p := public.profession_sync_level(p_player_id);
  return jsonb_build_object('money', p.money, 'work_pay', work_pay, 'xp_gained', 25,
    'level', p.player_level, 'xp', p.player_xp,
    'xp_to_next', public.profession_xp_to_next(p.player_level), 'unlocked', p.unlocked_professions);
end;
$$;

create or replace function public.claim_daily_reward_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.players;
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  elapsed bigint;
  next_streak integer;
  reward_amount integer;
  next_boost bigint;
begin
  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Player not found'); end if;
  elapsed := now_ms - coalesce(p.last_claim, 0);
  if coalesce(p.last_claim, 0) > 0 and elapsed < 86400000 then
    return jsonb_build_object('error', 'Daily reward is not ready');
  end if;
  if coalesce(p.last_claim, 0) > 0 and elapsed <= 172800000 and coalesce(p.daily_streak, 0) >= 7 then
    return jsonb_build_object('error', 'Come back tomorrow');
  end if;
  if coalesce(p.last_claim, 0) = 0 or elapsed > 172800000 then next_streak := 1;
  else next_streak := least(coalesce(p.daily_streak, 0) + 1, 7); end if;

  reward_amount := case next_streak when 1 then 500 when 2 then 250 when 3 then 1000
    when 4 then 250 when 5 then 1500 when 6 then 250 else 3500 end;
  if coalesce(p.boost_end, 0) > now_ms then reward_amount := floor(reward_amount * 1.1); end if;
  next_boost := case when next_streak = 7 then now_ms + 86400000 else coalesce(p.boost_end, 0) end;

  update public.players set daily_streak = next_streak, last_claim = now_ms, boost_end = next_boost,
    money = coalesce(money, 0) + reward_amount
  where id = p_player_id returning * into p;
  return jsonb_build_object('daily_streak', next_streak, 'reward_type', 'money',
    'reward_amount', reward_amount, 'money', p.money, 'boost_end', p.boost_end,
    'boost_awarded', next_streak = 7);
end;
$$;

-- Prevent legacy shop product records from restoring an unused stat.
update public.business_shop_products set energy_restore = 0 where energy_restore <> 0;

revoke all on function public.start_profession_cycle_rpc(uuid),
  public.profession_step_rpc(uuid, smallint), public.work_rpc(uuid),
  public.claim_daily_reward_rpc(uuid) from public, anon, authenticated;
grant execute on function public.start_profession_cycle_rpc(uuid),
  public.profession_step_rpc(uuid, smallint), public.work_rpc(uuid),
  public.claim_daily_reward_rpc(uuid) to service_role;

-- Older clients may still call these endpoints; keep them harmless and energy-free.
create or replace function public.drink_tutorial_coffee_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.players;
begin
  update public.players set onboarding_step = 3 where id = p_player_id and coalesce(onboarding_step, 0) = 2
  returning * into p;
  if not found then return jsonb_build_object('error', 'Tutorial step unavailable'); end if;
  return jsonb_build_object('onboarding_step', p.onboarding_step);
end;
$$;

create or replace function public.collect_coffee_energy_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return jsonb_build_object('success', true, 'message', 'Energy system is disabled');
end;
$$;

revoke all on function public.drink_tutorial_coffee_rpc(uuid),
  public.collect_coffee_energy_rpc(uuid) from public, anon, authenticated;
grant execute on function public.drink_tutorial_coffee_rpc(uuid),
  public.collect_coffee_energy_rpc(uuid) to service_role;

DO $$ BEGIN IF to_regprocedure('public.rest_rpc(uuid)') IS NOT NULL THEN REVOKE ALL ON FUNCTION public.rest_rpc(uuid) FROM public, anon, authenticated; END IF; END $$;
