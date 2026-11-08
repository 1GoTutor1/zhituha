-- Rotating season-pass daily quests. The client can only read the server-owned
-- state through season_pass_state_rpc; quest progress and XP are recorded here.
create table if not exists public.season_pass_daily_quests (
  player_id uuid not null,
  season_no integer not null,
  quest_slot smallint not null check (quest_slot in (1, 2)),
  quest_date date not null,
  quest_id text not null,
  activity text not null check (activity in ('work', 'sale', 'profession')),
  target smallint not null check (target > 0),
  progress smallint not null default 0 check (progress >= 0),
  xp_reward smallint not null default 12 check (xp_reward > 0),
  completed boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (player_id, season_no, quest_slot),
  foreign key (player_id, season_no)
    references public.season_pass_player_state(player_id, season_no) on delete cascade
);

create unique index if not exists season_pass_daily_quest_activity_unique
  on public.season_pass_daily_quests(player_id, season_no, quest_date, activity);

alter table public.season_pass_daily_quests enable row level security;
revoke all on public.season_pass_daily_quests from public, anon, authenticated;
grant all on public.season_pass_daily_quests to service_role;

create or replace function public.season_pass_ensure_daily_quests(
  p_player_id uuid,
  p_season_no integer,
  p_today date
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  s public.season_pass_seasons;
  day_index integer;
  rotating_activity text;
  rotating_id text;
  rotating_target smallint;
  work_target smallint;
begin
  select * into s from public.season_pass_seasons where season_no = p_season_no;
  if not found or p_today < timezone('UTC', s.starts_at)::date or p_today > timezone('UTC', s.ends_at)::date then
    return;
  end if;

  day_index := greatest(0, p_today - timezone('UTC', s.starts_at)::date);
  -- One non-work activity rotates daily; a work challenge changes target each day.
  -- This guarantees that players see a different pair on consecutive days.
  case mod(day_index, 6)
    when 0 then rotating_activity := 'sale'; rotating_id := 'sale_1'; rotating_target := 1;
    when 1 then rotating_activity := 'profession'; rotating_id := 'profession_1'; rotating_target := 1;
    when 2 then rotating_activity := 'sale'; rotating_id := 'sale_2'; rotating_target := 2;
    when 3 then rotating_activity := 'profession'; rotating_id := 'profession_2'; rotating_target := 2;
    when 4 then rotating_activity := 'sale'; rotating_id := 'sale_3'; rotating_target := 3;
    else rotating_activity := 'profession'; rotating_id := 'profession_3'; rotating_target := 3;
  end case;
  work_target := (2 + mod(day_index, 4))::smallint;

  insert into public.season_pass_daily_quests(
    player_id, season_no, quest_slot, quest_date, quest_id, activity, target, progress, xp_reward, completed
  ) values
    (p_player_id, p_season_no, 1, p_today, rotating_id, rotating_activity, rotating_target, 0, 12, false),
    (p_player_id, p_season_no, 2, p_today, 'work_' || work_target::text, 'work', work_target, 0, 12, false)
  on conflict (player_id, season_no, quest_slot) do update
    set quest_date = excluded.quest_date,
        quest_id = excluded.quest_id,
        activity = excluded.activity,
        target = excluded.target,
        progress = 0,
        xp_reward = excluded.xp_reward,
        completed = false,
        updated_at = clock_timestamp()
    where public.season_pass_daily_quests.quest_date is distinct from excluded.quest_date;
end;
$$;

create or replace function public.season_pass_state_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  s public.season_pass_seasons;
  st public.season_pass_player_state;
  selected text[];
  today date := timezone('UTC', clock_timestamp())::date;
begin
  if not exists(select 1 from public.players where id = p_player_id) then
    return jsonb_build_object('error', 'Игрок не найден');
  end if;
  s := public.season_pass_ensure_current();
  insert into public.season_pass_player_state(player_id, season_no)
    values (p_player_id, s.season_no) on conflict do nothing;
  select * into st from public.season_pass_player_state
    where player_id = p_player_id and season_no = s.season_no;
  select coalesce(season_badge_showcase, '{}') into selected from public.players where id = p_player_id;

  if clock_timestamp() >= s.starts_at and clock_timestamp() <= s.ends_at then
    perform public.season_pass_ensure_daily_quests(p_player_id, s.season_no, today);
  end if;

  return jsonb_build_object(
    'season', jsonb_build_object(
      'number', s.season_no,
      'name', s.season_name,
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'seconds_left', greatest(0, floor(extract(epoch from (s.ends_at - clock_timestamp())))::integer),
      'is_open', clock_timestamp() >= s.starts_at,
      'seconds_until_start', greatest(0, floor(extract(epoch from (s.starts_at - clock_timestamp())))::integer),
      'premium_cost', s.premium_cost
    ),
    'xp', st.xp,
    'tier', least(30, floor(st.xp / 45.0)::integer),
    'xp_in_tier', mod(st.xp, 45),
    'premium_unlocked', st.premium_unlocked,
    'claimed_free', st.claimed_free,
    'claimed_premium', st.claimed_premium,
    'earned_badges', (
      select coalesce(array_agg(distinct badges.badge), '{}')
      from public.season_pass_player_state all_states
      cross join lateral unnest(all_states.earned_badges) as badges(badge)
      where all_states.player_id = p_player_id
    ),
    'showcase', selected,
    'premium_balance', (select premium_balance from public.players where id = p_player_id),
    'daily_quests', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.quest_id,
        'title', case q.quest_id
          when 'work_2' then 'Отработай 2 смены'
          when 'work_3' then 'Отработай 3 смены'
          when 'work_4' then 'Отработай 4 смены'
          when 'work_5' then 'Отработай 5 смен'
          when 'sale_1' then 'Продай предмет'
          when 'sale_2' then 'Соверши 2 продажи'
          when 'sale_3' then 'Соверши 3 продажи'
          when 'profession_1' then 'Заверши цикл профессии'
          when 'profession_2' then 'Заверши 2 цикла профессии'
          when 'profession_3' then 'Заверши 3 цикла профессии'
          else 'Ежедневное задание'
        end,
        'progress', q.progress,
        'target', q.target,
        'xp_reward', q.xp_reward,
        'completed', q.completed
      ) order by q.quest_slot), '[]'::jsonb)
      from public.season_pass_daily_quests q
      where q.player_id = p_player_id and q.season_no = s.season_no and q.quest_date = today
    ),
    'tiers', (
      select jsonb_agg(jsonb_build_object(
        'level', n,
        'required_xp', n * 45,
        'free', public.season_pass_reward(n, 'free'),
        'premium', public.season_pass_reward(n, 'premium')
      ) order by n) from generate_series(1, 30) n
    )
  );
end;
$$;

create or replace function public.season_pass_add_xp(p_player_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  s public.season_pass_seasons;
  st public.season_pass_player_state;
  q record;
  today date := timezone('UTC', clock_timestamp())::date;
  gain integer := 0;
  quest_gain integer := 0;
  next_progress smallint;
begin
  if p_action is null or p_action not in ('work', 'sale', 'profession') then return; end if;
  s := public.season_pass_ensure_current();
  if clock_timestamp() < s.starts_at or clock_timestamp() > s.ends_at then return; end if;
  insert into public.season_pass_player_state(player_id, season_no)
    values (p_player_id, s.season_no) on conflict do nothing;
  select * into st from public.season_pass_player_state
    where player_id = p_player_id and season_no = s.season_no for update;
  perform public.season_pass_ensure_daily_quests(p_player_id, s.season_no, today);

  -- Ordinary actions still grant progress, but work alone is no longer enough
  -- to finish the pass quickly. Quest rewards make varied daily play worthwhile.
  if p_action = 'work' then
    if st.work_date is distinct from today then st.work_date := today; st.work_count := 0; end if;
    if st.work_count < 5 then gain := 3; st.work_count := st.work_count + 1; end if;
  elsif p_action = 'sale' then
    if st.sale_date is distinct from today then st.sale_date := today; st.sale_count := 0; end if;
    if st.sale_count < 1 then gain := 5; st.sale_count := st.sale_count + 1; end if;
  else
    if st.profession_date is distinct from today then st.profession_date := today; st.profession_count := 0; end if;
    if st.profession_count < 1 then gain := 5; st.profession_count := st.profession_count + 1; end if;
  end if;

  for q in
    select quest_slot, target, progress, xp_reward
    from public.season_pass_daily_quests
    where player_id = p_player_id and season_no = s.season_no
      and quest_date = today and activity = p_action and not completed
    for update
  loop
    next_progress := least(q.target, q.progress + 1);
    if next_progress >= q.target then quest_gain := quest_gain + q.xp_reward; end if;
    update public.season_pass_daily_quests
      set progress = next_progress,
          completed = next_progress >= target,
          updated_at = clock_timestamp()
      where player_id = p_player_id and season_no = s.season_no
        and quest_date = today and quest_slot = q.quest_slot;
  end loop;

  update public.season_pass_player_state
    set xp = xp + gain + quest_gain,
        work_date = st.work_date,
        work_count = st.work_count,
        sale_date = st.sale_date,
        sale_count = st.sale_count,
        profession_date = st.profession_date,
        profession_count = st.profession_count,
        updated_at = clock_timestamp()
    where player_id = p_player_id and season_no = s.season_no;
end;
$$;

-- Preserve the live commerce behavior while recording successful sales for the
-- pass. The existing coffee bonus and daily mission handling remain unchanged.
create or replace function public.sell_inventory_rpc(p_player_id uuid, p_item_id text, p_quantity integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  result_json jsonb;
  bonus bigint;
  new_money bigint;
begin
  result_json := public.sell_inventory_rpc_before_coffee_bonus(p_player_id, p_item_id, p_quantity);
  if coalesce((result_json->>'success')::boolean, false) then
    perform public.daily_mission_add_progress(p_player_id, 'sell_1', 1);
    perform public.season_pass_add_xp(p_player_id, 'sale');
  end if;

  if result_json ? 'error'
    or not exists (
      select 1 from public.players
      where id = p_player_id and coffee_bonus_until > clock_timestamp()
    ) then
    return result_json;
  end if;

  bonus := floor(coalesce((result_json->>'proceeds')::bigint, 0) * 0.10)::bigint;
  if bonus <= 0 then return result_json; end if;
  update public.players
  set money = coalesce(money, 0) + bonus
  where id = p_player_id
  returning money into new_money;
  return result_json || jsonb_build_object(
    'proceeds', coalesce((result_json->>'proceeds')::bigint, 0) + bonus,
    'money', new_money,
    'coffee_bonus_paid', bonus
  );
end;
$$;

-- Keep taxi/business completion logic and its daily mission, then award pass XP
-- only after the profession cycle has actually completed successfully.
create or replace function public.finish_profession_cycle_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  result jsonb;
  p public.players;
begin
  result := public.finish_profession_cycle_rpc_before_commerce(p_player_id);
  if result is null or result ? 'error' then return result; end if;

  perform public.daily_mission_add_progress(p_player_id, 'profession_1', 1);
  perform public.daily_mission_add_progress(p_player_id, 'work_5', 1);
  perform public.season_pass_add_xp(p_player_id, 'profession');

  select * into p from public.players where id = p_player_id;
  return result || jsonb_build_object('personal_car_health', coalesce(p.car_health, 100));
end;
$$;

revoke all on function public.season_pass_ensure_daily_quests(uuid, integer, date),
  public.season_pass_state_rpc(uuid), public.season_pass_add_xp(uuid, text)
  from public, anon, authenticated;
grant execute on function public.season_pass_state_rpc(uuid) to service_role;

notify pgrst, 'reload schema';
