-- Server-side click-pattern CAPTCHA for repeated work actions.
create table if not exists public.work_anticheat (
  player_id uuid primary key references public.players(id) on delete cascade,
  last_action_at timestamptz,
  recent_intervals_ms integer[] not null default '{}'::integer[],
  rapid_clicks integer not null default 0,
  captcha_code text,
  captcha_issued_at timestamptz,
  captcha_failures integer not null default 0,
  blocked_until timestamptz
);
alter table public.work_anticheat enable row level security;
revoke all on public.work_anticheat from public, anon, authenticated;
grant all on public.work_anticheat to service_role;

create or replace function public.work_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  p players; guard public.work_anticheat; business_bonus int; energy_cost int; work_pay int;
  today text; hash_value bigint := 0; day_index int; i int;
  now_ts timestamptz; interval_ms int; intervals_ms integer[];
  min_interval int; max_interval int; fast_clicks int; suspicious boolean := false; code text;
begin
  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;
  insert into public.work_anticheat(player_id) values (p_player_id) on conflict (player_id) do nothing;
  select * into guard from public.work_anticheat where player_id = p_player_id for update;
  now_ts := clock_timestamp();

  if guard.blocked_until is not null and guard.blocked_until > now_ts then
    return jsonb_build_object('error', 'Too many incorrect answers. Try again in one minute.', 'blocked', true);
  end if;
  if guard.captcha_code is not null then
    if guard.captcha_issued_at < now_ts - interval '10 minutes' then
      select string_agg(n::text, '' order by random()) into code from generate_series(1, 5) as seq(n);
      update public.work_anticheat set captcha_code = code, captcha_issued_at = now_ts, captcha_failures = 0
        where player_id = p_player_id;
      return jsonb_build_object('captcha_required', true, 'captcha_code', code);
    end if;
    return jsonb_build_object('captcha_required', true, 'captcha_code', guard.captcha_code);
  end if;

  energy_cost := case when p.has_car then 10 else 20 end;
  if coalesce(p.energy,0) < energy_cost then return jsonb_build_object('error', 'Недостаточно энергии'); end if;

  intervals_ms := coalesce(guard.recent_intervals_ms, '{}'::integer[]);
  fast_clicks := coalesce(guard.rapid_clicks, 0);
  if guard.last_action_at is not null then
    interval_ms := greatest(0, floor(extract(epoch from (now_ts - guard.last_action_at)) * 1000)::int);
    intervals_ms := array_append(intervals_ms, interval_ms);
    if cardinality(intervals_ms) > 8 then intervals_ms := intervals_ms[2:9]; end if;
    if interval_ms < 350 then fast_clicks := fast_clicks + 1; else fast_clicks := 0; end if;
    if fast_clicks >= 5 then suspicious := true; end if;
    if cardinality(intervals_ms) >= 8 then
      select min(value), max(value) into min_interval, max_interval from unnest(intervals_ms) as sample(value);
      if min_interval >= 350 and max_interval <= 1600 and max_interval - min_interval <= 20 then
        suspicious := true;
      end if;
    end if;
  end if;

  update public.work_anticheat
  set last_action_at = now_ts, recent_intervals_ms = intervals_ms, rapid_clicks = fast_clicks
  where player_id = p_player_id;

  if suspicious then
    select string_agg(n::text, '' order by random()) into code from generate_series(1, 5) as seq(n);
    update public.work_anticheat
    set captcha_code = code, captcha_issued_at = now_ts, captcha_failures = 0,
        recent_intervals_ms = '{}'::integer[], rapid_clicks = 0
    where player_id = p_player_id;
    return jsonb_build_object('captcha_required', true, 'captcha_code', code);
  end if;
  if interval_ms is not null and interval_ms < 350 then
    return jsonb_build_object('ignored', true);
  end if;

  select coalesce(sum(case biz_type when 'coffee' then 5 when 'salon' then 10 when 'taxi' then 15
    when 'phone_factory' then 20 when 'construction' then 25 else 0 end), 0)::int
    into business_bonus from businesses where owner_id = p_player_id;

  today := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  for i in 1..length(today) loop
    hash_value := mod(hash_value * 31 + ascii(substr(today, i, 1)), 4294967296);
    if hash_value < 0 then hash_value := hash_value + 4294967296; end if;
    if hash_value >= 2147483648 then hash_value := hash_value - 4294967296; end if;
  end loop;
  day_index := mod(abs(hash_value), 10)::int;
  work_pay := floor(150 * (1 + business_bonus / 100.0));

  update players set money = coalesce(money,0) + work_pay, energy = coalesce(energy,0) - energy_cost
    where id = p_player_id returning * into p;
  if p.referred_by is not null then
    update players set referral_balance = coalesce(referral_balance,0) +
      floor(work_pay * 0.05 * case when day_index = 6 then 2 else 1 end)
      where telegram_id = p.referred_by;
  end if;
  return jsonb_build_object('money', p.money, 'energy', p.energy, 'work_pay', work_pay);
end $$;

-- Админ: выдать/забрать деньги + лог. Только для роли admin/superadmin.
create or replace function public.verify_work_captcha_rpc(p_player_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare guard public.work_anticheat; now_ts timestamptz := clock_timestamp(); code text; failures int;
begin
  select * into guard from public.work_anticheat where player_id = p_player_id for update;
  if not found or guard.captcha_code is null then
    return jsonb_build_object('success', false, 'error', 'Challenge expired. Tap Work again.');
  end if;
  if guard.captcha_issued_at < now_ts - interval '10 minutes' then
    select string_agg(n::text, '' order by random()) into code from generate_series(1, 5) as seq(n);
    update public.work_anticheat set captcha_code = code, captcha_issued_at = now_ts, captcha_failures = 0
      where player_id = p_player_id;
    return jsonb_build_object('success', false, 'captcha_required', true, 'captcha_code', code,
                              'message', 'Code expired. Enter the new one.');
  end if;
  if upper(trim(coalesce(p_code, ''))) = guard.captcha_code then
    update public.work_anticheat
    set captcha_code = null, captcha_issued_at = null, captcha_failures = 0,
        last_action_at = null, recent_intervals_ms = '{}'::integer[], rapid_clicks = 0, blocked_until = null
    where player_id = p_player_id;
    return jsonb_build_object('success', true);
  end if;

  failures := guard.captcha_failures + 1;
  if failures >= 3 then
    update public.work_anticheat
    set captcha_code = null, captcha_issued_at = null, captcha_failures = 0,
        blocked_until = now_ts + interval '1 minute'
    where player_id = p_player_id;
    return jsonb_build_object('success', false, 'blocked', true, 'retry_after_seconds', 60,
                              'message', 'Too many incorrect answers. Try again in one minute.');
  end if;

  select string_agg(n::text, '' order by random()) into code from generate_series(1, 5) as seq(n);
  update public.work_anticheat
  set captcha_code = code, captcha_issued_at = now_ts, captcha_failures = failures
  where player_id = p_player_id;
  return jsonb_build_object('success', false, 'captcha_required', true, 'captcha_code', code,
                            'attempts_left', 3 - failures, 'message', 'Code did not match. Try again.');
end $$;


alter function public.work_rpc(uuid) set search_path = pg_catalog, public, pg_temp;
revoke all on function public.work_rpc(uuid) from public, anon, authenticated;
revoke all on function public.verify_work_captcha_rpc(uuid, text) from public, anon, authenticated;
grant execute on function public.work_rpc(uuid) to service_role;
grant execute on function public.verify_work_captcha_rpc(uuid, text) to service_role;
