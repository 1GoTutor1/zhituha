-- Black market cultivation and daily family delivery. Times use Moscow time.
create table if not exists public.black_market_wallets(player_id uuid primary key references public.players(id) on delete cascade,seeds integer not null default 0 check(seeds>=0),crop_units integer not null default 0 check(crop_units>=0));
create table if not exists public.black_market_plots(player_id uuid primary key references public.players(id) on delete cascade,planted_at timestamptz,ready_at timestamptz,yield_units integer check(yield_units in(8,10,12)));
create table if not exists public.black_market_windows(window_key text primary key,market_day date not null,slot smallint not null check(slot in(1,2)),starts_at timestamptz not null,ends_at timestamptz not null,buy_price integer not null check(buy_price between 8000 and 16000 and mod(buy_price,1000)=0),unique(market_day,slot));
create table if not exists public.black_market_seed_purchases(player_id uuid not null references public.players(id) on delete cascade,window_key text not null references public.black_market_windows(window_key),bought_at timestamptz not null default now(),primary key(player_id,window_key));
create table if not exists public.black_market_family_events(id uuid primary key default gen_random_uuid(),market_day date not null,family_id uuid not null references public.families(id) on delete cascade,season_no bigint not null references public.family_seasons(season_no),target_units integer not null default 20,sold_units integer not null default 0,min_members integer not null default 2,completed_at timestamptz,unique(market_day,family_id));
create table if not exists public.black_market_family_event_members(event_id uuid not null references public.black_market_family_events(id) on delete cascade,player_id uuid not null references public.players(id) on delete cascade,sold_units integer not null default 0,joined_at timestamptz not null default now(),primary key(event_id,player_id));
create table if not exists public.family_black_market_event_points(event_id uuid primary key references public.black_market_family_events(id) on delete cascade,family_id uuid not null references public.families(id) on delete cascade,season_no bigint not null references public.family_seasons(season_no),points integer not null default 15 check(points=15),awarded_at timestamptz not null default now());

do $$ declare t text; begin
  foreach t in array array['black_market_wallets','black_market_plots','black_market_windows','black_market_seed_purchases','black_market_family_events','black_market_family_event_members','family_black_market_event_points'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

create or replace function public.black_market_get_window(p_now timestamptz default clock_timestamp()) returns public.black_market_windows
language plpgsql security definer set search_path=public,pg_temp as $$
declare ln timestamp; d date; sl smallint; sh integer; eh integer; w public.black_market_windows;
begin
  ln:=timezone('Europe/Moscow',p_now); d:=ln::date;
  if ln::time>=time '07:00' and ln::time<time '11:00' then sl:=1; sh:=7; eh:=11;
  elsif ln::time>=time '15:00' and ln::time<time '19:00' then sl:=2; sh:=15; eh:=19;
  else return null; end if;
  insert into public.black_market_windows(window_key,market_day,slot,starts_at,ends_at,buy_price)
  values(to_char(d,'YYYYMMDD')||'-'||sl,d,sl,(d+make_time(sh,0,0)) at time zone 'Europe/Moscow',(d+make_time(eh,0,0)) at time zone 'Europe/Moscow',8000+floor(random()*9)::integer*1000)
  on conflict(market_day,slot) do nothing;
  select * into w from public.black_market_windows where market_day=d and slot=sl; return w;
end $$;

create or replace function public.black_market_state_rpc(p_player_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.black_market_windows; wa public.black_market_wallets; pl public.black_market_plots; ln timestamp; next_at timestamptz; fam uuid; ev public.black_market_family_events; eid uuid; members integer:=0; joined boolean:=false; sn bigint;
begin
  insert into public.black_market_wallets(player_id) values(p_player_id) on conflict do nothing;
  insert into public.black_market_plots(player_id) values(p_player_id) on conflict do nothing;
  select * into wa from public.black_market_wallets where player_id=p_player_id;
  select * into pl from public.black_market_plots where player_id=p_player_id;
  w:=public.black_market_get_window(); ln:=timezone('Europe/Moscow',clock_timestamp());
  if w.window_key is null then
    if ln::time<time '07:00' then next_at:=(ln::date+time '07:00') at time zone 'Europe/Moscow';
    elsif ln::time<time '15:00' then next_at:=(ln::date+time '15:00') at time zone 'Europe/Moscow';
    else next_at:=((ln::date+1)+time '07:00') at time zone 'Europe/Moscow'; end if;
  end if;
  select family_id into fam from public.family_memberships where player_id=p_player_id and left_at is null limit 1;
  if fam is not null then
    sn:=public.family_ensure_current_season();
    if w.slot=2 then insert into public.black_market_family_events(market_day,family_id,season_no) values(w.market_day,fam,sn) on conflict do nothing;
    else insert into public.black_market_family_events(market_day,family_id,season_no) values(ln::date,fam,sn) on conflict do nothing; end if;
    select id into eid from public.black_market_family_events where family_id=fam and market_day=case when w.slot=2 then w.market_day else ln::date end;
  end if;
  if eid is not null then
    select * into ev from public.black_market_family_events where id=eid;
    select count(*)::integer into members from public.black_market_family_event_members where event_id=eid and sold_units>0;
    select exists(select 1 from public.black_market_family_event_members where event_id=eid and player_id=p_player_id) into joined;
  end if;
  return jsonb_build_object('market_open',w.window_key is not null,'buy_price',w.buy_price,'seed_price',100000,'slot',w.slot,'next_open_at',next_at,'seeds',wa.seeds,'crop_units',wa.crop_units,
    'plot',case when pl.planted_at is null then null else jsonb_build_object('planted_at',pl.planted_at,'ready_at',pl.ready_at,'ready_in_seconds',greatest(0,ceil(extract(epoch from(pl.ready_at-clock_timestamp())))::integer)) end,
    'family_event',case when ev.id is null then null else jsonb_build_object('id',ev.id,'target_units',ev.target_units,'sold_units',ev.sold_units,'min_members',ev.min_members,'member_count',members,'joined',joined,'completed',ev.completed_at is not null) end);
end $$;

create or replace function public.black_market_buy_seed_rpc(p_player_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.black_market_windows; p public.players; wa public.black_market_wallets;
begin
  w:=public.black_market_get_window(); if w.window_key is null then return jsonb_build_object('error','Семена продают только во время приезда торговца'); end if;
  select * into p from public.players where id=p_player_id for update; if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  insert into public.black_market_wallets(player_id) values(p_player_id) on conflict do nothing;
  perform 1 from public.black_market_wallets where player_id=p_player_id for update;
  if exists(select 1 from public.black_market_seed_purchases where player_id=p_player_id and window_key=w.window_key) then return jsonb_build_object('error','В этот приезд семя уже куплено'); end if;
  if coalesce(p.money,0)<100000 then return jsonb_build_object('error','Нужно 100 000 ₽'); end if;
  update public.players set money=money-100000 where id=p_player_id returning * into p;
  update public.black_market_wallets set seeds=seeds+1 where player_id=p_player_id returning * into wa;
  insert into public.black_market_seed_purchases(player_id,window_key) values(p_player_id,w.window_key);
  return jsonb_build_object('success',true,'money',p.money,'seeds',wa.seeds,'message','Семя куплено за 100 000 ₽');
end $$;

create or replace function public.black_market_plant_rpc(p_player_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare wa public.black_market_wallets; pl public.black_market_plots; y integer; r numeric;
begin
  insert into public.black_market_wallets(player_id) values(p_player_id) on conflict do nothing; insert into public.black_market_plots(player_id) values(p_player_id) on conflict do nothing;
  select * into wa from public.black_market_wallets where player_id=p_player_id for update; select * into pl from public.black_market_plots where player_id=p_player_id for update;
  if wa.seeds<1 then return jsonb_build_object('error','Нет семян'); end if; if pl.planted_at is not null then return jsonb_build_object('error','Сначала собери текущий урожай'); end if;
  r:=random(); y:=case when r<0.05 then 8 when r>=0.95 then 12 else 10 end;
  update public.black_market_wallets set seeds=seeds-1 where player_id=p_player_id;
  update public.black_market_plots set planted_at=clock_timestamp(),ready_at=clock_timestamp()+interval '4 hours',yield_units=y where player_id=p_player_id;
  return jsonb_build_object('success',true,'message','Посажено. Созреет через 4 часа');
end $$;

create or replace function public.black_market_harvest_rpc(p_player_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare pl public.black_market_plots; wa public.black_market_wallets;
begin
  select * into pl from public.black_market_plots where player_id=p_player_id for update;
  if not found or pl.planted_at is null then return jsonb_build_object('error','Нечего собирать'); end if; if pl.ready_at>clock_timestamp() then return jsonb_build_object('error','Урожай ещё не созрел'); end if;
  update public.black_market_wallets set crop_units=crop_units+pl.yield_units where player_id=p_player_id returning * into wa;
  update public.black_market_plots set planted_at=null,ready_at=null,yield_units=null where player_id=p_player_id;
  return jsonb_build_object('success',true,'crop_units',wa.crop_units,'message','Урожай собран: '||pl.yield_units||' единиц');
end $$;

create or replace function public.family_black_market_join_rpc(p_player_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.black_market_windows; fam uuid; eid uuid; sn bigint;
begin
  w:=public.black_market_get_window(); if w.window_key is null or w.slot<>2 then return jsonb_build_object('error','Семейная поставка проходит с 15:00 до 19:00 МСК'); end if;
  select family_id into fam from public.family_memberships where player_id=p_player_id and left_at is null limit 1; if fam is null then return jsonb_build_object('error','Для участия нужна семья'); end if;
  sn:=public.family_ensure_current_season(); insert into public.black_market_family_events(market_day,family_id,season_no) values(w.market_day,fam,sn) on conflict do nothing;
  select id into eid from public.black_market_family_events where market_day=w.market_day and family_id=fam;
  insert into public.black_market_family_event_members(event_id,player_id) values(eid,p_player_id) on conflict do nothing;
  return jsonb_build_object('success',true,'message','Ты участвуешь. Продажи засчитаются до 19:00 МСК');
end $$;

create or replace function public.black_market_sell_rpc(p_player_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.black_market_windows; wa public.black_market_wallets; qty integer; payout bigint; p public.players; fam uuid; eid uuid; ev public.black_market_family_events; eligible integer;
begin
  w:=public.black_market_get_window(); if w.window_key is null then return jsonb_build_object('error','Торговец сейчас уехал'); end if;
  select * into wa from public.black_market_wallets where player_id=p_player_id for update; if not found or wa.crop_units<1 then return jsonb_build_object('error','Нет урожая для сбыта'); end if;
  qty:=wa.crop_units; payout:=qty*w.buy_price;
  update public.black_market_wallets set crop_units=0 where player_id=p_player_id;
  update public.players set money=coalesce(money,0)+payout where id=p_player_id returning * into p;
  if w.slot=2 then
    select family_id into fam from public.family_memberships where player_id=p_player_id and left_at is null limit 1;
    if fam is not null then select e.id into eid from public.black_market_family_events e join public.black_market_family_event_members m on m.event_id=e.id and m.player_id=p_player_id where e.family_id=fam and e.market_day=w.market_day and e.completed_at is null for update of e; end if;
    if eid is not null then
      select * into ev from public.black_market_family_events where id=eid;
      eligible:=qty;
      update public.black_market_family_events set sold_units=least(target_units,sold_units+eligible) where id=eid;
      update public.black_market_family_event_members set sold_units=sold_units+eligible where event_id=eid and player_id=p_player_id;
      select count(*)::integer into eligible from public.black_market_family_event_members where event_id=eid and sold_units>0;
      select * into ev from public.black_market_family_events where id=eid;
      if ev.sold_units>=ev.target_units and eligible>=ev.min_members then
        update public.black_market_family_events set completed_at=clock_timestamp() where id=eid and completed_at is null;
        if found then insert into public.family_black_market_event_points(event_id,family_id,season_no) values(eid,ev.family_id,ev.season_no) on conflict do nothing; end if;
      end if;
    end if;
  end if;
  return jsonb_build_object('success',true,'money',p.money,'sold_units',qty,'payout',payout,'message','Сбыт: '||qty||' ед. за '||payout||' ₽');
end $$;

create or replace function public.family_current_score(p_family_id uuid,p_season_no bigint) returns integer
language sql stable security definer set search_path=public,pg_temp as $$
  select (coalesce((select sum(cp.points) from public.family_cycle_points cp join public.family_memberships m on m.id=cp.membership_id and m.left_at is null where cp.family_id=p_family_id and cp.season_no=p_season_no),0)+coalesce((select sum(ep.points) from public.family_black_market_event_points ep where ep.family_id=p_family_id and ep.season_no=p_season_no),0))::integer
$$;

create or replace function public.family_ensure_current_season()
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare
  now_at timestamptz:=clock_timestamp();
  anchor_at timestamptz:=timestamp '2026-10-26 00:00:00' at time zone 'Europe/Moscow';
  current_no bigint; start_at timestamptz; old_season record;
begin
  current_no:=floor(extract(epoch from(now_at-anchor_at))/1209600)::bigint;
  start_at:=anchor_at+(current_no*14)*interval '1 day';
  for old_season in select season_no,ends_at from public.family_seasons where finalized_at is null and ends_at<=now_at order by season_no loop
    insert into public.family_season_results(season_no,family_id,place,score,family_name,family_tag)
    select old_season.season_no,r.id,r.place,r.score,r.name,r.tag from (
      select f.id,f.name,f.tag,
        (coalesce(sum(cp.points),0)+coalesce((select sum(ep.points) from public.family_black_market_event_points ep where ep.family_id=f.id and ep.season_no=old_season.season_no),0))::integer score,
        rank() over(order by (coalesce(sum(cp.points),0)+coalesce((select sum(ep.points) from public.family_black_market_event_points ep where ep.family_id=f.id and ep.season_no=old_season.season_no),0)) desc)::integer place
      from public.families f
      left join public.family_memberships m on m.family_id=f.id and m.joined_at<old_season.ends_at and (m.left_at is null or m.left_at>=old_season.ends_at)
      left join public.family_cycle_points cp on cp.membership_id=m.id and cp.season_no=old_season.season_no
      where f.disbanded_at is null group by f.id,f.name,f.tag
    ) r where r.score>0 and r.place<=3 on conflict(season_no,family_id) do nothing;
    insert into public.family_member_awards(season_no,family_id,player_id,place,contribution)
    select r.season_no,r.family_id,cp.player_id,r.place,sum(cp.points)::integer
    from public.family_season_results r
    join public.family_memberships m on m.family_id=r.family_id and m.joined_at<old_season.ends_at and (m.left_at is null or m.left_at>=old_season.ends_at)
    join public.family_cycle_points cp on cp.membership_id=m.id and cp.season_no=r.season_no
    where r.season_no=old_season.season_no group by r.season_no,r.family_id,cp.player_id,r.place having sum(cp.points)>=20
    on conflict(season_no,family_id,player_id) do nothing;
    update public.family_seasons set finalized_at=now_at where season_no=old_season.season_no;
  end loop;
  insert into public.family_seasons(season_no,starts_at,ends_at) values(current_no,start_at,start_at+interval '14 days') on conflict(season_no) do nothing;
  return current_no;
end $$;

do $$ declare r record; begin
  for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('black_market_state_rpc','black_market_buy_seed_rpc','black_market_plant_rpc','black_market_harvest_rpc','black_market_sell_rpc','family_black_market_join_rpc') loop
    execute format('revoke all on function %s from public,anon,authenticated',r.sig); execute format('grant execute on function %s to service_role',r.sig);
  end loop;
end $$;
revoke all on function public.black_market_get_window(timestamptz),public.family_current_score(uuid,bigint),public.family_ensure_current_season() from public,anon,authenticated;
grant execute on function public.black_market_get_window(timestamptz),public.family_current_score(uuid,bigint),public.family_ensure_current_season() to service_role;
notify pgrst,'reload schema';
