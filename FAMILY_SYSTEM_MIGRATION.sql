-- Family system, 14-day seasons, profession activity score, and territory battles.
-- Apply after PROFESSIONS_INVENTORY_MIGRATION.sql and PROFESSION_WORK_FIX.sql.

alter table public.players
  add column if not exists family_switch_until timestamptz;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text not null,
  leader_id uuid references public.players(id) on delete set null,
  deputy_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  disbanded_at timestamptz
);
create unique index if not exists families_active_name_uq on public.families (lower(name)) where disbanded_at is null;
create unique index if not exists families_active_tag_uq on public.families (upper(tag)) where disbanded_at is null;

create table if not exists public.family_memberships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  player_id uuid not null references public.players(id),
  member_role text not null default 'member' check (member_role in ('leader','deputy','member')),
  joined_at timestamptz not null default clock_timestamp(),
  left_at timestamptz,
  last_seen_at timestamptz not null default clock_timestamp(),
  last_profession_at timestamptz
);
create unique index if not exists family_one_active_membership_per_player
  on public.family_memberships(player_id) where left_at is null;
create index if not exists family_memberships_family_active_idx
  on public.family_memberships(family_id, joined_at) where left_at is null;

create table if not exists public.family_seasons (
  season_no bigint primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  finalized_at timestamptz,
  check (ends_at > starts_at)
);

create table if not exists public.family_cycle_points (
  id bigint generated always as identity primary key,
  cycle_id uuid not null unique references public.profession_cycles(id),
  season_no bigint not null references public.family_seasons(season_no),
  family_id uuid not null references public.families(id),
  membership_id uuid not null references public.family_memberships(id),
  player_id uuid not null references public.players(id),
  point_day date not null,
  points smallint not null default 1 check (points = 1),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists family_cycle_points_score_idx
  on public.family_cycle_points(season_no, family_id, membership_id);
create index if not exists family_cycle_points_daily_idx
  on public.family_cycle_points(membership_id, season_no, point_day);

create table if not exists public.family_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  player_id uuid not null references public.players(id),
  created_by uuid not null references public.players(id),
  request_type text not null check (request_type in ('application','invite')),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','expired','cancelled')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null
);
create unique index if not exists family_one_pending_invite_per_player
  on public.family_requests(player_id) where request_type='invite' and status='pending';
create unique index if not exists family_one_pending_application_per_player
  on public.family_requests(player_id) where request_type='application' and status='pending';
create index if not exists family_requests_inbox_idx
  on public.family_requests(family_id, request_type, status, created_at desc);

create table if not exists public.family_season_results (
  season_no bigint not null references public.family_seasons(season_no),
  family_id uuid not null references public.families(id),
  place integer not null,
  score integer not null,
  family_name text not null,
  family_tag text not null,
  primary key (season_no, family_id)
);
create index if not exists family_season_results_history_idx
  on public.family_season_results(season_no desc, place);

create table if not exists public.family_member_awards (
  season_no bigint not null references public.family_seasons(season_no),
  family_id uuid not null references public.families(id),
  player_id uuid not null references public.players(id),
  place integer not null,
  contribution integer not null,
  awarded_at timestamptz not null default clock_timestamp(),
  primary key (season_no, family_id, player_id)
);

create table if not exists public.family_territories (
  territory_key text primary key check (territory_key in ('A','B','C')),
  territory_name text not null,
  base_value bigint not null default 100000 check (base_value = 100000),
  defense_value bigint not null default 100000 check (defense_value >= base_value),
  owner_family_id uuid references public.families(id) on delete set null,
  captured_at timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);
insert into public.family_territories(territory_key, territory_name)
values ('A','Поле A'),('B','Поле B'),('C','Поле C')
on conflict (territory_key) do nothing;

create table if not exists public.family_territory_attempts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  player_id uuid not null references public.players(id),
  territory_key text not null references public.family_territories(territory_key),
  attempt_day date not null,
  stake bigint not null check (stake between 25000 and 500000),
  defense_value bigint not null,
  chance_percent numeric(5,2) not null,
  roll_percent numeric(7,4) not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default clock_timestamp(),
  unique(family_id, attempt_day)
);
create index if not exists family_territory_attempts_history_idx
  on public.family_territory_attempts(territory_key, attempted_at desc);

alter table public.families enable row level security;
alter table public.family_memberships enable row level security;
alter table public.family_seasons enable row level security;
alter table public.family_cycle_points enable row level security;
alter table public.family_requests enable row level security;
alter table public.family_season_results enable row level security;
alter table public.family_member_awards enable row level security;
alter table public.family_territories enable row level security;
alter table public.family_territory_attempts enable row level security;
revoke all on public.families, public.family_memberships, public.family_seasons,
  public.family_cycle_points, public.family_requests, public.family_season_results,
  public.family_member_awards, public.family_territories, public.family_territory_attempts
  from public, anon, authenticated;
grant all on public.families, public.family_memberships, public.family_seasons,
  public.family_cycle_points, public.family_requests, public.family_season_results,
  public.family_member_awards, public.family_territories, public.family_territory_attempts
  to service_role;
grant usage, select on sequence public.family_cycle_points_id_seq to service_role;

create or replace function public.family_ensure_current_season()
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare
  now_at timestamptz := clock_timestamp();
  anchor_at timestamptz := timestamp '2026-10-26 00:00:00' at time zone 'Europe/Moscow';
  current_no bigint;
  start_at timestamptz;
  old_season record;
begin
  current_no := floor(extract(epoch from (now_at - anchor_at)) / 1209600)::bigint;
  start_at := anchor_at + (current_no * 14) * interval '1 day';

  for old_season in
    select season_no, ends_at from public.family_seasons
    where finalized_at is null and ends_at <= now_at order by season_no
  loop
    insert into public.family_season_results(season_no, family_id, place, score, family_name, family_tag)
    select old_season.season_no, ranked.id, ranked.place, ranked.score, ranked.name, ranked.tag
    from (
      select f.id, f.name, f.tag,
        coalesce(sum(cp.points),0)::integer as score,
        rank() over(order by coalesce(sum(cp.points),0) desc)::integer as place
      from public.families f
      left join public.family_memberships m on m.family_id=f.id
        and m.joined_at < old_season.ends_at and (m.left_at is null or m.left_at >= old_season.ends_at)
      left join public.family_cycle_points cp on cp.membership_id=m.id and cp.season_no=old_season.season_no
      where f.disbanded_at is null
      group by f.id, f.name, f.tag
    ) ranked
    where ranked.score > 0 and ranked.place <= 3
    on conflict (season_no, family_id) do nothing;

    insert into public.family_member_awards(season_no, family_id, player_id, place, contribution)
    select r.season_no, r.family_id, cp.player_id, r.place, sum(cp.points)::integer
    from public.family_season_results r
    join public.family_memberships m on m.family_id=r.family_id
      and m.joined_at < old_season.ends_at and (m.left_at is null or m.left_at >= old_season.ends_at)
    join public.family_cycle_points cp on cp.membership_id=m.id and cp.season_no=r.season_no
    where r.season_no=old_season.season_no
    group by r.season_no, r.family_id, cp.player_id, r.place
    having sum(cp.points) >= 20
    on conflict (season_no, family_id, player_id) do nothing;

    update public.family_seasons set finalized_at=now_at where season_no=old_season.season_no;
  end loop;

  insert into public.family_seasons(season_no, starts_at, ends_at)
  values(current_no, start_at, start_at + interval '14 days')
  on conflict (season_no) do nothing;
  return current_no;
end $$;

create or replace function public.family_drop_luck_bonus(p_player_id uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select least(0.015::numeric, count(*)::numeric * 0.005::numeric)
  from public.family_memberships m
  join public.family_territories t on t.owner_family_id=m.family_id
  where m.player_id=p_player_id and m.left_at is null
$$;

create or replace function public.family_current_score(p_family_id uuid, p_season_no bigint)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(cp.points),0)::integer
  from public.family_cycle_points cp
  join public.family_memberships m on m.id=cp.membership_id and m.left_at is null
  where cp.family_id=p_family_id and cp.season_no=p_season_no
$$;

create or replace function public.family_record_profession_cycle()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  membership public.family_memberships;
  v_season_no bigint;
  day_msk date;
  earned_today integer;
begin
  if old.status <> 'active' or new.status not in ('completed','completed_pending') then return new; end if;
  v_season_no := public.family_ensure_current_season();
  day_msk := timezone('Europe/Moscow', clock_timestamp())::date;

  select * into membership from public.family_memberships
  where player_id=new.player_id and left_at is null
  order by joined_at desc limit 1 for update;
  if not found then return new; end if;

  select count(*)::integer into earned_today from public.family_cycle_points
  where family_cycle_points.membership_id=membership.id
    and family_cycle_points.season_no=v_season_no and family_cycle_points.point_day=day_msk;
  if earned_today < 10 then
    insert into public.family_cycle_points(cycle_id, season_no, family_id, membership_id, player_id, point_day)
    values(new.id, v_season_no, membership.family_id, membership.id, new.player_id, day_msk)
    on conflict(cycle_id) do nothing;
    update public.family_memberships set last_profession_at=clock_timestamp(), last_seen_at=clock_timestamp()
      where id=membership.id;
  end if;
  return new;
end $$;
drop trigger if exists family_profession_cycle_points on public.profession_cycles;
create trigger family_profession_cycle_points
after update of status on public.profession_cycles
for each row execute function public.family_record_profession_cycle();

create or replace function public.family_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_season_no bigint;
  season public.family_seasons;
  member public.family_memberships;
  player public.players;
  family_json jsonb;
  leaderboard_json jsonb;
  territory_json jsonb;
  invite_json jsonb;
  application_json jsonb;
  history_json jsonb;
  catalog_json jsonb;
  day_msk date := timezone('Europe/Moscow', clock_timestamp())::date;
begin
  select * into player from public.players where id=p_player_id;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  v_season_no := public.family_ensure_current_season();
  select fs.* into season from public.family_seasons fs where fs.season_no=v_season_no;
  update public.family_memberships set last_seen_at=clock_timestamp()
    where player_id=p_player_id and left_at is null;
  select * into member from public.family_memberships where player_id=p_player_id and left_at is null
    order by joined_at desc limit 1;

  if member.id is not null then
    select jsonb_build_object(
      'id',f.id,'name',f.name,'tag',f.tag,'leader_id',f.leader_id,'deputy_id',f.deputy_id,
      'role',member.member_role,'score',public.family_current_score(f.id,v_season_no),
      'my_points',(select coalesce(sum(cp.points),0)::integer from public.family_cycle_points cp where cp.membership_id=member.id and cp.season_no=v_season_no),
      'today_points',(select count(*)::integer from public.family_cycle_points cp where cp.membership_id=member.id and cp.season_no=v_season_no and cp.point_day=day_msk),
      'territory_attempted_today',exists(select 1 from public.family_territory_attempts a where a.family_id=f.id and a.attempt_day=day_msk),
      'luck_bonus_percent',(select count(*)::numeric * 0.5 from public.family_territories where owner_family_id=f.id),
      'members',(select coalesce(jsonb_agg(jsonb_build_object(
        'player_id',p.id,'nickname',p.nickname,'level',coalesce(p.player_level,1),
        'profession',coalesce(p.active_profession,'miner'),'role',mm.member_role,
        'joined_at',mm.joined_at,'last_seen_at',mm.last_seen_at,
        'points',(select coalesce(sum(cp.points),0)::integer from public.family_cycle_points cp where cp.membership_id=mm.id and cp.season_no=v_season_no),
        'has_season_reward',(select coalesce(sum(cp.points),0)>=20 from public.family_cycle_points cp where cp.membership_id=mm.id and cp.season_no=v_season_no)
      ) order by case mm.member_role when 'leader' then 0 when 'deputy' then 1 else 2 end, mm.joined_at), '[]'::jsonb)
        from public.family_memberships mm join public.players p on p.id=mm.player_id
        where mm.family_id=f.id and mm.left_at is null),
      'requests',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',r.id,'player_id',r.player_id,'nickname',p.nickname,'level',coalesce(p.player_level,1),
        'type',r.request_type,'created_at',r.created_at
      ) order by r.created_at), '[]'::jsonb)
        from public.family_requests r join public.players p on p.id=r.player_id
        where r.family_id=f.id and r.status='pending' and r.expires_at>clock_timestamp()
          and r.request_type='application' and member.member_role in ('leader','deputy')),
      'sent_invites',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',r.id,'player_id',r.player_id,'nickname',p.nickname,'created_at',r.created_at,'expires_at',r.expires_at
      ) order by r.created_at), '[]'::jsonb)
        from public.family_requests r join public.players p on p.id=r.player_id
        where r.family_id=f.id and r.status='pending' and r.expires_at>clock_timestamp()
          and r.request_type='invite' and member.member_role in ('leader','deputy'))
    ) into family_json from public.families f where f.id=member.family_id and f.disbanded_at is null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'family_id',f.id,'family_name',f.name,'family_tag',f.tag,
    'type',r.request_type,'created_at',r.created_at,'expires_at',r.expires_at
  ) order by r.created_at desc), '[]'::jsonb) into invite_json
  from public.family_requests r join public.families f on f.id=r.family_id
  where r.player_id=p_player_id and r.request_type='invite' and r.status='pending'
    and r.expires_at>clock_timestamp() and f.disbanded_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'family_id',f.id,'family_name',f.name,'family_tag',f.tag,
    'created_at',r.created_at,'expires_at',r.expires_at
  ) order by r.created_at desc), '[]'::jsonb) into application_json
  from public.family_requests r join public.families f on f.id=r.family_id
  where r.player_id=p_player_id and r.request_type='application' and r.status='pending'
    and r.expires_at>clock_timestamp() and f.disbanded_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ranked.id,'name',ranked.name,'tag',ranked.tag,'leader_name',ranked.leader_name,
    'member_count',ranked.member_count,'score',ranked.score,'place',ranked.place
  ) order by ranked.place), '[]'::jsonb) into leaderboard_json
  from (
    select f.id,f.name,f.tag,lp.nickname as leader_name,
      (select count(*)::integer from public.family_memberships m where m.family_id=f.id and m.left_at is null) as member_count,
      public.family_current_score(f.id,v_season_no) as score,
      rank() over(order by public.family_current_score(f.id,v_season_no) desc)::integer as place
    from public.families f left join public.players lp on lp.id=f.leader_id
    where f.disbanded_at is null
  ) ranked
  where ranked.place<=50;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',t.territory_key,'name',t.territory_name,'base_value',t.base_value,
    'defense_value',t.defense_value,'owner_family_id',t.owner_family_id,
    'owner_name',f.name,'owner_tag',f.tag,'captured_at',t.captured_at,
    'last_attempt',(select jsonb_build_object('family_name',af.name,'family_tag',af.tag,
      'chance_percent',a.chance_percent,'succeeded',a.succeeded,'attempted_at',a.attempted_at)
      from public.family_territory_attempts a join public.families af on af.id=a.family_id
      where a.territory_key=t.territory_key order by a.attempted_at desc limit 1)
  ) order by t.territory_key), '[]'::jsonb) into territory_json
  from public.family_territories t left join public.families f on f.id=t.owner_family_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'season_no',season_no,'place',place,'score',score,'family_name',family_name,'family_tag',family_tag
  ) order by season_no desc, place), '[]'::jsonb) into history_json
  from (select * from public.family_season_results order by season_no desc, place limit 30) h;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'name',x.name,'tag',x.tag,'leader_name',x.leader_name,
    'member_count',x.member_count,'score',x.score
  ) order by x.name), '[]'::jsonb) into catalog_json
  from (
    select f.id,f.name,f.tag,lp.nickname as leader_name,
      (select count(*)::integer from public.family_memberships m where m.family_id=f.id and m.left_at is null) as member_count,
      public.family_current_score(f.id,v_season_no) as score
    from public.families f left join public.players lp on lp.id=f.leader_id
    where f.disbanded_at is null
    order by f.created_at desc limit 100
  ) x;

  return jsonb_build_object(
    'season',jsonb_build_object('number',season.season_no,'starts_at',season.starts_at,'ends_at',season.ends_at,
      'seconds_left',greatest(0,floor(extract(epoch from (season.ends_at-clock_timestamp())))::integer)),
    'player_level',coalesce(player.player_level,1),'money',coalesce(player.money,0),
    'switch_until',player.family_switch_until,'family',family_json,
    'invitations',invite_json,'applications',application_json,
    'leaderboard',leaderboard_json,'families',catalog_json,
    'territories',territory_json,'history',history_json,
    'awards',(select coalesce(jsonb_agg(jsonb_build_object('season_no',season_no,'place',place,'contribution',contribution) order by season_no desc), '[]'::jsonb)
      from public.family_member_awards where player_id=p_player_id)
  );
end $$;

create or replace function public.family_create_rpc(p_player_id uuid, p_name text, p_tag text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p public.players;
  family_id uuid;
  clean_name text := regexp_replace(btrim(coalesce(p_name,'')), '\s+', ' ', 'g');
  clean_tag text := upper(regexp_replace(btrim(coalesce(p_tag,'')), '[^[:alnum:]]', '', 'g'));
begin
  if length(clean_name)<3 or length(clean_name)>24 then return jsonb_build_object('error','Название семьи: от 3 до 24 символов'); end if;
  if length(clean_tag)<2 or length(clean_tag)>5 then return jsonb_build_object('error','Тег семьи: от 2 до 5 букв или цифр'); end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if coalesce(p.player_level,1)<5 then return jsonb_build_object('error','Создать семью можно с 5 уровня'); end if;
  if exists(select 1 from public.family_memberships where player_id=p_player_id and left_at is null) then return jsonb_build_object('error','Ты уже состоишь в семье'); end if;
  if p.family_switch_until>clock_timestamp() then return jsonb_build_object('error','До вступления в семью осталось ждать: '||ceil(extract(epoch from (p.family_switch_until-clock_timestamp()))/86400)::int||' дн.'); end if;
  if coalesce(p.money,0)<50000 then return jsonb_build_object('error','Для создания семьи нужно 50 000 ₽'); end if;
  begin
    insert into public.families(name,tag,leader_id) values(clean_name,clean_tag,p_player_id) returning id into family_id;
  exception when unique_violation then return jsonb_build_object('error','Название или тег семьи уже заняты'); end;
  insert into public.family_memberships(family_id,player_id,member_role) values(family_id,p_player_id,'leader');
  update public.players set money=money-50000, family_switch_until=null where id=p_player_id returning * into p;
  return jsonb_build_object('success',true,'family_id',family_id,'money',p.money);
end $$;

create or replace function public.family_apply_rpc(p_player_id uuid, p_family_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.players; family_row public.families;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if exists(select 1 from public.family_memberships where player_id=p_player_id and left_at is null) then return jsonb_build_object('error','Сначала выйди из своей семьи'); end if;
  if p.family_switch_until>clock_timestamp() then return jsonb_build_object('error','После смены семьи нужно подождать 7 дней'); end if;
  select * into family_row from public.families where id=p_family_id and disbanded_at is null;
  if not found then return jsonb_build_object('error','Семья не найдена'); end if;
  if (select count(*) from public.family_memberships where family_id=p_family_id and left_at is null)>=10 then return jsonb_build_object('error','В семье уже 10 участников'); end if;
  update public.family_requests set status='expired' where player_id=p_player_id and status='pending' and expires_at<=clock_timestamp();
  if exists(select 1 from public.family_requests where player_id=p_player_id and status='pending' and request_type='invite' and family_id=p_family_id) then
    return jsonb_build_object('error','У тебя уже есть приглашение от этой семьи');
  end if;
  begin
    insert into public.family_requests(family_id,player_id,created_by,request_type,expires_at)
    values(p_family_id,p_player_id,p_player_id,'application',clock_timestamp()+interval '7 days');
  exception when unique_violation then return jsonb_build_object('error','У тебя уже есть активная заявка или приглашение'); end;
  return jsonb_build_object('success',true);
end $$;

create or replace function public.family_invite_rpc(p_player_id uuid, p_target_nickname text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare member public.family_memberships; target public.players; family_row public.families;
begin
  select * into member from public.family_memberships where player_id=p_player_id and left_at is null for update;
  if not found or member.member_role not in ('leader','deputy') then return jsonb_build_object('error','Приглашать могут лидер и заместитель'); end if;
  select * into family_row from public.families where id=member.family_id and disbanded_at is null for update;
  if (select count(*) from public.family_memberships where family_id=member.family_id and left_at is null)>=10 then return jsonb_build_object('error','В семье уже 10 участников'); end if;
  select * into target from public.players where lower(nickname)=lower(btrim(coalesce(p_target_nickname,''))) and coalesce(is_banned,false)=false limit 1;
  if not found then return jsonb_build_object('error','Игрок с таким ником не найден'); end if;
  if target.id=p_player_id then return jsonb_build_object('error','Нельзя пригласить самого себя'); end if;
  if exists(select 1 from public.family_memberships where player_id=target.id and left_at is null) then return jsonb_build_object('error','Этот игрок уже состоит в семье'); end if;
  if target.family_switch_until>clock_timestamp() then return jsonb_build_object('error','Игрок сможет вступить после окончания задержки смены семьи'); end if;
  update public.family_requests set status='expired' where player_id=target.id and status='pending' and expires_at<=clock_timestamp();
  begin
    insert into public.family_requests(family_id,player_id,created_by,request_type,expires_at)
    values(member.family_id,target.id,p_player_id,'invite',clock_timestamp()+interval '48 hours');
  exception when unique_violation then return jsonb_build_object('error','У игрока уже есть активное приглашение или заявка'); end;
  return jsonb_build_object('success',true,'nickname',target.nickname);
end $$;

create or replace function public.family_respond_rpc(p_player_id uuid, p_request_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.family_requests; family_row public.families; p public.players; member public.family_memberships;
begin
  select * into r from public.family_requests where id=p_request_id for update;
  if not found or r.status<>'pending' or r.expires_at<=clock_timestamp() then return jsonb_build_object('error','Заявка или приглашение уже недействительно'); end if;
  if p_accept is null then return jsonb_build_object('error','Выбери: принять или отклонить'); end if;
  if r.request_type='invite' then
    if r.player_id<>p_player_id then return jsonb_build_object('error','Это приглашение отправлено другому игроку'); end if;
  else
    select * into member from public.family_memberships where player_id=p_player_id and family_id=r.family_id and left_at is null;
    if not found or member.member_role not in ('leader','deputy') then return jsonb_build_object('error','Заявки принимают лидер и заместитель'); end if;
  end if;
  if not p_accept then
    update public.family_requests set status='rejected' where id=r.id;
    return jsonb_build_object('success',true,'accepted',false);
  end if;
  select * into p from public.players where id=r.player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if exists(select 1 from public.family_memberships where player_id=r.player_id and left_at is null) then return jsonb_build_object('error','Игрок уже состоит в семье'); end if;
  if p.family_switch_until>clock_timestamp() then return jsonb_build_object('error','Игрок пока не может сменить семью'); end if;
  select * into family_row from public.families where id=r.family_id and disbanded_at is null for update;
  if not found then return jsonb_build_object('error','Семья больше не существует'); end if;
  if (select count(*) from public.family_memberships where family_id=r.family_id and left_at is null)>=10 then return jsonb_build_object('error','В семье уже 10 участников'); end if;
  insert into public.family_memberships(family_id,player_id,member_role) values(r.family_id,r.player_id,'member');
  update public.family_requests set status='accepted' where id=r.id;
  update public.family_requests set status='cancelled' where player_id=r.player_id and id<>r.id and status='pending';
  update public.players set family_switch_until=null where id=r.player_id;
  return jsonb_build_object('success',true,'accepted',true,'family_id',r.family_id);
end $$;

create or replace function public.family_leave_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  member public.family_memberships;
  family_row public.families;
  successor public.family_memberships;
  v_season_no bigint;
begin
  select * into member from public.family_memberships where player_id=p_player_id and left_at is null for update;
  if not found then return jsonb_build_object('error','Ты не состоишь в семье'); end if;
  select * into family_row from public.families where id=member.family_id for update;
  v_season_no := public.family_ensure_current_season();
  if member.member_role='leader' then
    select m.* into successor from public.family_memberships m
    left join lateral (select coalesce(sum(cp.points),0)::integer as points from public.family_cycle_points cp where cp.membership_id=m.id and cp.season_no=v_season_no) score on true
    where m.family_id=member.family_id and m.left_at is null and m.player_id<>p_player_id
    order by case when m.player_id=family_row.deputy_id then 0 else 1 end, score.points desc, m.joined_at asc limit 1 for update of m;
    if successor.id is null then
      update public.families set leader_id=null,deputy_id=null,disbanded_at=clock_timestamp() where id=member.family_id;
      update public.family_territories set owner_family_id=null,defense_value=base_value,captured_at=null,updated_at=clock_timestamp() where owner_family_id=member.family_id;
      update public.family_requests set status='cancelled' where family_id=member.family_id and status='pending';
    else
      update public.family_memberships set member_role='member' where family_id=member.family_id and player_id=family_row.leader_id and left_at is null;
      update public.family_memberships set member_role='leader' where id=successor.id;
      update public.families set leader_id=successor.player_id,
        deputy_id=case when successor.player_id=family_row.deputy_id then null else family_row.deputy_id end
      where id=member.family_id;
    end if;
  elsif member.member_role='deputy' then
    update public.families set deputy_id=null where id=member.family_id;
  end if;
  update public.family_memberships set left_at=clock_timestamp() where id=member.id;
  update public.players set family_switch_until=clock_timestamp()+interval '7 days' where id=p_player_id;
  return jsonb_build_object('success',true,'cooldown_hours',168);
end $$;

create or replace function public.family_kick_rpc(p_player_id uuid, p_target_player_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare actor public.family_memberships; target public.family_memberships;
begin
  select * into actor from public.family_memberships where player_id=p_player_id and left_at is null for update;
  if not found or actor.member_role not in ('leader','deputy') then return jsonb_build_object('error','Исключать могут лидер и заместитель'); end if;
  if p_target_player_id=p_player_id then return jsonb_build_object('error','Чтобы уйти самому, нажми «Покинуть семью»'); end if;
  select * into target from public.family_memberships where player_id=p_target_player_id and family_id=actor.family_id and left_at is null for update;
  if not found then return jsonb_build_object('error','Участник уже не в семье'); end if;
  if target.member_role='leader' or (actor.member_role='deputy' and target.member_role<>'member') then return jsonb_build_object('error','У заместителя нет прав исключать лидера или другого заместителя'); end if;
  update public.family_memberships set left_at=clock_timestamp() where id=target.id;
  if target.member_role='deputy' then update public.families set deputy_id=null where id=actor.family_id; end if;
  update public.players set family_switch_until=clock_timestamp()+interval '7 days' where id=target.player_id;
  update public.family_requests set status='cancelled' where player_id=target.player_id and status='pending';
  return jsonb_build_object('success',true,'removed_player_id',target.player_id,'points_removed',
    (select coalesce(sum(cp.points),0)::integer from public.family_cycle_points cp
      where cp.membership_id=target.id and cp.season_no=public.family_ensure_current_season()));
end $$;

create or replace function public.family_set_deputy_rpc(p_player_id uuid, p_target_player_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare actor public.family_memberships; target public.family_memberships;
begin
  select * into actor from public.family_memberships where player_id=p_player_id and left_at is null for update;
  if not found or actor.member_role<>'leader' then return jsonb_build_object('error','Назначить заместителя может только лидер'); end if;
  if p_target_player_id is null then
    update public.family_memberships set member_role='member' where family_id=actor.family_id and member_role='deputy' and left_at is null;
    update public.families set deputy_id=null where id=actor.family_id;
    return jsonb_build_object('success',true,'deputy_id',null);
  end if;
  select * into target from public.family_memberships where player_id=p_target_player_id and family_id=actor.family_id and left_at is null for update;
  if not found or target.member_role='leader' then return jsonb_build_object('error','Заместителем можно назначить участника своей семьи'); end if;
  update public.family_memberships set member_role='member' where family_id=actor.family_id and member_role='deputy' and left_at is null;
  update public.family_memberships set member_role='deputy' where id=target.id;
  update public.families set deputy_id=target.player_id where id=actor.family_id;
  return jsonb_build_object('success',true,'deputy_id',target.player_id);
end $$;

create or replace function public.family_claim_leadership_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare deputy public.family_memberships; f public.families; leader_member public.family_memberships;
begin
  select * into deputy from public.family_memberships where player_id=p_player_id and left_at is null and member_role='deputy' for update;
  if not found then return jsonb_build_object('error','Только заместитель может принять лидерство'); end if;
  select * into f from public.families where id=deputy.family_id for update;
  select * into leader_member from public.family_memberships where player_id=f.leader_id and family_id=f.id and left_at is null;
  if leader_member.last_seen_at>clock_timestamp()-interval '14 days' then return jsonb_build_object('error','Лидер заходил в игру за последние 14 дней'); end if;
  update public.family_memberships set member_role='deputy' where id=leader_member.id;
  update public.family_memberships set member_role='leader' where id=deputy.id;
  update public.families set leader_id=deputy.player_id,deputy_id=leader_member.player_id where id=f.id;
  return jsonb_build_object('success',true,'leader_id',deputy.player_id);
end $$;

create or replace function public.family_touch_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.family_memberships set last_seen_at=clock_timestamp()
    where player_id=p_player_id and left_at is null;
  return jsonb_build_object('success',true);
end $$;

create or replace function public.family_territory_attack_rpc(p_player_id uuid, p_territory_key text, p_stake bigint)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  member public.family_memberships;
  f public.families;
  territory public.family_territories;
  p public.players;
  day_msk date := timezone('Europe/Moscow', clock_timestamp())::date;
  chance numeric(5,2);
  roll numeric(7,4);
  success boolean;
  new_defense bigint;
begin
  if p_territory_key is null or p_territory_key not in ('A','B','C') then return jsonb_build_object('error','Выбери территорию A, B или C'); end if;
  if p_stake is null or p_stake<25000 or p_stake>500000 or p_stake%5000<>0 then return jsonb_build_object('error','Ставка захвата: от 25 000 до 500 000 ₽, шаг 5 000 ₽'); end if;
  select * into member from public.family_memberships where player_id=p_player_id and left_at is null for update;
  if not found or member.member_role not in ('leader','deputy') then return jsonb_build_object('error','Захватывать территории могут лидер и заместитель'); end if;
  select * into f from public.families where id=member.family_id and disbanded_at is null for update;
  select * into territory from public.family_territories where territory_key=p_territory_key for update;
  if territory.owner_family_id=member.family_id then return jsonb_build_object('error','Эта территория уже ваша'); end if;
  if exists(select 1 from public.family_territory_attempts where family_id=member.family_id and attempt_day=day_msk) then
    return jsonb_build_object('error','Семья уже пробовала захватить территорию сегодня');
  end if;
  select * into p from public.players where id=p_player_id for update;
  if coalesce(p.money,0)<p_stake then return jsonb_build_object('error','В кошельке недостаточно денег для ставки'); end if;
  chance := least(85::numeric, round(100.0*p_stake/(p_stake+greatest(territory.defense_value,territory.base_value)),2));
  roll := round(random()*100.0,4);
  success := roll<chance;
  update public.players set money=money-p_stake where id=p_player_id returning * into p;
  insert into public.family_territory_attempts(family_id,player_id,territory_key,attempt_day,stake,defense_value,chance_percent,roll_percent,succeeded)
    values(member.family_id,p_player_id,p_territory_key,day_msk,p_stake,territory.defense_value,chance,roll,success);
  if success then
    new_defense := territory.base_value + least(territory.base_value,p_stake/2);
    update public.family_territories set owner_family_id=member.family_id,defense_value=new_defense,
      captured_at=clock_timestamp(),updated_at=clock_timestamp() where territory_key=p_territory_key;
  end if;
  return jsonb_build_object('success',true,'captured',success,'territory',p_territory_key,
    'stake',p_stake,'chance_percent',chance,'roll_percent',roll,'money',p.money,
    'message',case when success then 'Территория захвачена!' else 'Попытка не удалась. Ставка потрачена.' end);
end $$;

create or replace function public.family_public_rpc(p_player_id uuid, p_family_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  result jsonb;
  v_season_no bigint;
begin
  if not exists(select 1 from public.players where id=p_player_id) then return jsonb_build_object('error','Игрок не найден'); end if;
  v_season_no := public.family_ensure_current_season();
  select jsonb_build_object(
    'id',f.id,'name',f.name,'tag',f.tag,'score',public.family_current_score(f.id,v_season_no),
    'member_count',(select count(*)::integer from public.family_memberships m where m.family_id=f.id and m.left_at is null),
    'members',(select coalesce(jsonb_agg(jsonb_build_object(
      'player_id',p.id,'nickname',p.nickname,'level',coalesce(p.player_level,1),
      'profession',coalesce(p.active_profession,'miner'),'role',m.member_role,
      'points',(select coalesce(sum(cp.points),0)::integer from public.family_cycle_points cp
        where cp.membership_id=m.id and cp.season_no=v_season_no)
    ) order by case m.member_role when 'leader' then 0 when 'deputy' then 1 else 2 end,m.joined_at),'[]'::jsonb)
      from public.family_memberships m join public.players p on p.id=m.player_id
      where m.family_id=f.id and m.left_at is null),
    'territories',(select coalesce(jsonb_agg(jsonb_build_object('key',t.territory_key,'name',t.territory_name)
      order by t.territory_key),'[]'::jsonb) from public.family_territories t where t.owner_family_id=f.id)
  ) into result from public.families f where f.id=p_family_id and f.disbanded_at is null;
  if result is null then return jsonb_build_object('error','Семья не найдена'); end if;
  return result;
end $$;

-- Preserve the existing taxi/car-aware finish routine; the wrapper below only adjusts rare drops.
do $$
begin
  if to_regprocedure('public.finish_profession_cycle_rpc_before_family(uuid)') is null then
    execute 'alter function public.finish_profession_cycle_rpc(uuid) rename to finish_profession_cycle_rpc_before_family';
  end if;
end $$;

-- Drop bonus is +0.5 percentage point to rare/epic per territory, applied without bypassing taxi fleet logic.
create or replace function public.finish_profession_cycle_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  result_json jsonb;
  cycle_row public.profession_cycles;
  replacement public.profession_items;
  luck numeric := 0;
  rare_weight integer;
  total_weight integer;
  roll integer;
  upgrade_chance numeric;
begin
  result_json := public.finish_profession_cycle_rpc_before_family(p_player_id);
  if result_json is null or result_json ? 'error'
    or not coalesce((result_json->>'pending_reward')::boolean,false) then
    return result_json;
  end if;

  select * into cycle_row from public.profession_cycles
    where player_id=p_player_id and status='completed_pending'
    order by created_at desc limit 1 for update;
  if not found or cycle_row.profession not in ('miner','lumberjack','fisherman','farmer') then
    return result_json;
  end if;

  luck := public.family_drop_luck_bonus(p_player_id);
  if luck<=0 then return result_json; end if;
  if coalesce(result_json#>>'{item,rarity}','') in ('rare','epic') then
    result_json := result_json || jsonb_build_object('drop_luck_bonus_percent',luck*100);
    update public.profession_cycles set result=result || jsonb_build_object('drop_luck_bonus_percent',luck*100)
      where id=cycle_row.id;
    return result_json;
  end if;

  select coalesce(sum(drop_weight) filter (where rarity in ('rare','epic')),0)::integer,
         coalesce(sum(drop_weight),0)::integer
    into rare_weight,total_weight from public.profession_items where profession=cycle_row.profession;
  if total_weight<=rare_weight or rare_weight=0 then return result_json; end if;
  upgrade_chance := least(1::numeric,luck/(1-rare_weight::numeric/total_weight));
  if random()<upgrade_chance then
    roll := floor(random()*rare_weight)::integer;
    select * into replacement from (
      select di.*,sum(di.drop_weight) over(order by di.item_id)-di.drop_weight as lower_bound
      from public.profession_items di
      where di.profession=cycle_row.profession and di.rarity in ('rare','epic')
    ) weighted where roll>=lower_bound order by lower_bound desc limit 1;
    if replacement.item_id is not null then
      result_json := jsonb_set(result_json,'{item}',jsonb_build_object(
        'item_id',replacement.item_id,'item_name',replacement.item_name,'rarity',replacement.rarity,
        'sell_price',replacement.sell_price,'icon',replacement.icon));
      update public.profession_cycles set result=jsonb_set(result,'{item}',jsonb_build_object(
        'item_id',replacement.item_id,'item_name',replacement.item_name,'rarity',replacement.rarity,
        'sell_price',replacement.sell_price,'icon',replacement.icon)) where id=cycle_row.id;
    end if;
  end if;

  result_json := result_json || jsonb_build_object('drop_luck_bonus_percent',luck*100);
  update public.profession_cycles set result=result || jsonb_build_object('drop_luck_bonus_percent',luck*100)
    where id=cycle_row.id;
  return result_json;
end $$;

revoke all on function public.family_ensure_current_season() from public, anon, authenticated;
revoke all on function public.family_drop_luck_bonus(uuid) from public, anon, authenticated;
revoke all on function public.family_current_score(uuid,bigint) from public, anon, authenticated;
revoke all on function public.family_record_profession_cycle() from public, anon, authenticated;
revoke all on function public.family_state_rpc(uuid) from public, anon, authenticated;
revoke all on function public.family_create_rpc(uuid,text,text) from public, anon, authenticated;
revoke all on function public.family_apply_rpc(uuid,uuid) from public, anon, authenticated;
revoke all on function public.family_invite_rpc(uuid,text) from public, anon, authenticated;
revoke all on function public.family_respond_rpc(uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.family_leave_rpc(uuid) from public, anon, authenticated;
revoke all on function public.family_kick_rpc(uuid,uuid) from public, anon, authenticated;
revoke all on function public.family_set_deputy_rpc(uuid,uuid) from public, anon, authenticated;
revoke all on function public.family_claim_leadership_rpc(uuid) from public, anon, authenticated;
revoke all on function public.family_touch_rpc(uuid) from public, anon, authenticated;
revoke all on function public.family_territory_attack_rpc(uuid,text,bigint) from public, anon, authenticated;
revoke all on function public.family_public_rpc(uuid,uuid) from public, anon, authenticated;
revoke all on function public.finish_profession_cycle_rpc(uuid) from public, anon, authenticated;
revoke all on function public.finish_profession_cycle_rpc_before_family(uuid) from public, anon, authenticated, service_role;
grant execute on function public.family_state_rpc(uuid), public.family_create_rpc(uuid,text,text),
  public.family_apply_rpc(uuid,uuid), public.family_invite_rpc(uuid,text), public.family_respond_rpc(uuid,uuid,boolean),
  public.family_leave_rpc(uuid), public.family_kick_rpc(uuid,uuid), public.family_set_deputy_rpc(uuid,uuid),
  public.family_claim_leadership_rpc(uuid), public.family_touch_rpc(uuid),
  public.family_territory_attack_rpc(uuid,text,bigint), public.family_public_rpc(uuid,uuid),
  public.finish_profession_cycle_rpc(uuid) to service_role;

select public.family_ensure_current_season();
