-- Player taxi rides between city districts.
-- Apply after BUSINESS_LOCATIONS_MIGRATION.sql, DISTRICTS_ENERGY_MIGRATION.sql,
-- DEALERSHIP_FLEET_MIGRATION.sql, and PROFESSIONS_INVENTORY_MIGRATION.sql.

create table if not exists public.district_taxi_rides (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  driver_id uuid not null references public.players(id) on delete restrict,
  car_index integer not null check (car_index >= 0),
  car_model text not null,
  car_name text not null,
  taxi_class text not null check (taxi_class in ('economy','comfort','business')),
  source_district text not null check (source_district in ('center','residential','factory')),
  destination_district text not null check (destination_district in ('center','residential','factory')),
  fare bigint not null check (fare in (500,700,900)),
  owner_cut bigint not null check (owner_cut >= 0),
  driver_cut bigint not null check (driver_cut >= 0),
  status text not null default 'dispatching' check (status in ('dispatching','in_trip','completed')),
  created_at timestamptz not null default clock_timestamp(),
  arrives_at timestamptz not null,
  completes_at timestamptz not null,
  completed_at timestamptz,
  check (source_district <> destination_district),
  check (owner_cut + driver_cut = fare)
);

create index if not exists district_taxi_rides_player_active_idx
  on public.district_taxi_rides(player_id, arrives_at) where status in ('dispatching','in_trip');
create index if not exists district_taxi_rides_car_history_idx
  on public.district_taxi_rides(business_id, car_index, status);
create unique index if not exists district_taxi_one_active_ride_per_player
  on public.district_taxi_rides(player_id) where status in ('dispatching','in_trip');
create unique index if not exists district_taxi_one_active_ride_per_car
  on public.district_taxi_rides(business_id, car_index) where status in ('dispatching','in_trip');

alter table public.district_taxi_rides enable row level security;
drop policy if exists "no direct taxi ride access" on public.district_taxi_rides;
create policy "no direct taxi ride access" on public.district_taxi_rides
  for all using (false) with check (false);
revoke all on public.district_taxi_rides from public, anon, authenticated;
grant select, insert, update, delete on public.district_taxi_rides to service_role;

create or replace function public.district_taxi_options_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.players;
begin
  select * into p from public.players where id=p_player_id;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if exists(select 1 from public.district_taxi_rides r where r.player_id=p_player_id and r.status in ('dispatching','in_trip')) then
    return jsonb_build_object('error','Сначала заверши текущую поездку');
  end if;
  return jsonb_build_object(
    'current_district',p.current_district,
    'options',coalesce((
      select jsonb_agg(jsonb_build_object(
        'business_id',q.business_id,'business_name',q.business_name,
        'district',q.district,'taxi_class',q.taxi_class,'fare',q.fare,
        'cars',q.cars)
        order by case q.taxi_class when 'economy' then 1 when 'comfort' then 2 else 3 end,q.business_name)
      from (
        select b.id business_id,b.business_name,l.district,c.taxi_class,c.fare,
          jsonb_agg(jsonb_build_object('car_index',v.position-1,'model',c.model_id,
            'model_name',c.model_name,'driver_name',coalesce(driver.player_name,'Водитель')) order by v.position) cars
        from public.business_locations l
        join public.businesses b on b.id=l.business_id and b.biz_type='taxi' and b.owner_id is not null
        cross join lateral jsonb_array_elements(case when jsonb_typeof(b.stock->'taxi_cars')='array'
          then b.stock->'taxi_cars' else '[]'::jsonb end) with ordinality v(car,position)
        join public.business_vehicle_catalog c on c.model_id=v.car->>'model'
        join lateral (
          select a.player_id,w.player_name
          from public.taxi_driver_assignments a
          join public.business_workers w on w.business_id=b.id and w.player_id=a.player_id and w.role='Водитель'
          where a.business_id=b.id and a.car_index=v.position-1 and a.active_cycle_id is null
          order by (select count(*) from public.district_taxi_rides h
            where h.driver_id=a.player_id and h.status='completed'),w.created_at,a.player_id
          limit 1
        ) driver on true
        where l.district=p.current_district and coalesce((v.car->>'health')::integer,0)>0
          and not exists(select 1 from public.district_taxi_rides busy
            where busy.business_id=b.id and busy.car_index=v.position-1 and busy.status in ('dispatching','in_trip'))
        group by b.id,b.business_name,l.district,c.taxi_class,c.fare
      ) q
    ),'[]'::jsonb));
end $$;

create or replace function public.district_taxi_order_rpc(
  p_player_id uuid,p_destination text,p_business_id uuid,p_class text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare
  p public.players; b public.businesses; v record; ride public.district_taxi_rides;
  owner_percent integer; owner_amount bigint; driver_amount bigint;
  destination_label text; trip_seconds integer; route_steps integer;
begin
  if p_destination is null or p_destination not in ('center','residential','factory') then
    return jsonb_build_object('error','Неизвестный район');
  end if;
  if p_class is null or p_class not in ('economy','comfort','business') then
    return jsonb_build_object('error','Неизвестный класс такси');
  end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if p.current_district=p_destination then return jsonb_build_object('error','Ты уже в этом районе'); end if;
  if exists(select 1 from public.district_taxi_rides where player_id=p_player_id and status in ('dispatching','in_trip')) then
    return jsonb_build_object('error','У тебя уже идёт поездка');
  end if;
  select * into b from public.businesses where id=p_business_id and biz_type='taxi' and owner_id is not null for update;
  if not found then return jsonb_build_object('error','Таксопарк сейчас недоступен'); end if;
  if not exists(select 1 from public.business_locations l where l.business_id=b.id and l.district=p.current_district) then
    return jsonb_build_object('error','Такси можно заказать только в районе, где находится таксопарк');
  end if;

  -- Choose the least-used available car of the requested class. Each car is
  -- connected to the driver who assigned it in the taxi fleet screen.
  select car_row.position-1 car_index,c.model_id car_model,c.model_name car_name,c.taxi_class,c.fare,
      driver.player_id driver_id,coalesce(driver.player_name,'Водитель') driver_name
    into v
  from jsonb_array_elements(case when jsonb_typeof(b.stock->'taxi_cars')='array'
      then b.stock->'taxi_cars' else '[]'::jsonb end) with ordinality car_row(car,position)
  join public.business_vehicle_catalog c on c.model_id=car_row.car->>'model' and c.taxi_class=p_class
  join lateral (
    select a.player_id,w.player_name
    from public.taxi_driver_assignments a
    join public.business_workers w on w.business_id=b.id and w.player_id=a.player_id and w.role='Водитель'
    where a.business_id=b.id and a.car_index=car_row.position-1 and a.active_cycle_id is null
    order by (select count(*) from public.district_taxi_rides h
      where h.driver_id=a.player_id and h.status='completed'),w.created_at,a.player_id
    limit 1
  ) driver on true
  where coalesce((car_row.car->>'health')::integer,0)>0
    and not exists(select 1 from public.district_taxi_rides busy
      where busy.business_id=b.id and busy.car_index=car_row.position-1 and busy.status in ('dispatching','in_trip'))
  order by (select count(*) from public.district_taxi_rides h
      where h.business_id=b.id and h.car_index=car_row.position-1 and h.status='completed'),car_row.position
  limit 1;
  if not found then return jsonb_build_object('error','В этом районе сейчас нет свободной машины и водителя нужного тарифа'); end if;
  if coalesce(p.money,0)<v.fare then
    return jsonb_build_object('error',format('Для поездки нужно %s ₽',v.fare));
  end if;

  owner_percent:=greatest(0,least(50,coalesce(b.taxi_owner_cut_percent,30)));
  owner_amount:=floor(v.fare*owner_percent/100.0)::bigint;
  driver_amount:=v.fare-owner_amount;
  destination_label:=case p_destination when 'center' then 'Центр'
    when 'residential' then 'Спальный район' else 'Заводской район' end;
  route_steps:=case
    when p.current_district='center' or p_destination='center' then
      case when p.current_district='factory' or p_destination='factory' then 1 else 0 end
    else 2 end;
  trip_seconds:=case v.taxi_class when 'economy' then 10 when 'comfort' then 8 else 6 end
    + route_steps*2;

  update public.players set money=coalesce(money,0)-v.fare where id=p_player_id;
  update public.businesses set cash_balance=coalesce(cash_balance,0)+owner_amount where id=b.id;
  update public.players set tip_balance=coalesce(tip_balance,0)+driver_amount where id=v.driver_id;
  insert into public.district_taxi_rides(player_id,business_id,driver_id,car_index,car_model,car_name,
      taxi_class,source_district,destination_district,fare,owner_cut,driver_cut,arrives_at,completes_at)
    values(p_player_id,b.id,v.driver_id,v.car_index,v.car_model,v.car_name,v.taxi_class,
      p.current_district,p_destination,v.fare,owner_amount,driver_amount,
      clock_timestamp()+interval '5 seconds',clock_timestamp()+interval '5 seconds'+make_interval(secs=>trip_seconds))
    returning * into ride;

  return jsonb_build_object('success',true,'ride',jsonb_build_object(
    'id',ride.id,'source_district',ride.source_district,'destination_district',ride.destination_district,
    'destination_name',destination_label,'taxi_class',ride.taxi_class,'fare',ride.fare,
    'car_name',ride.car_name,'driver_name',v.driver_name,'status',ride.status,
    'arrives_at',ride.arrives_at,'completes_at',ride.completes_at),
    'money',coalesce(p.money,0)-v.fare,'owner_income',owner_amount,'driver_income',driver_amount);
end $$;

create or replace function public.district_taxi_ride_state_rpc(p_player_id uuid)
returns jsonb language sql security definer set search_path=pg_catalog,public,pg_temp as $$
  select jsonb_build_object('ride',coalesce((select jsonb_build_object(
    'id',r.id,'source_district',r.source_district,'destination_district',r.destination_district,
    'taxi_class',r.taxi_class,'fare',r.fare,'car_name',r.car_name,'status',r.status,
    'arrives_at',r.arrives_at,'completes_at',r.completes_at)
    from public.district_taxi_rides r where r.player_id=p_player_id and r.status in ('dispatching','in_trip')
    order by r.created_at desc limit 1),'null'::jsonb))
$$;

create or replace function public.district_taxi_finish_ride_rpc(p_player_id uuid,p_ride_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare r public.district_taxi_rides; destination_label text;
begin
  select * into r from public.district_taxi_rides where id=p_ride_id and player_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Поездка не найдена'); end if;
  destination_label:=case r.destination_district when 'center' then 'Центр'
    when 'residential' then 'Спальный район' else 'Заводской район' end;
  if r.status='completed' then
    return jsonb_build_object('completed',true,'current_district',r.destination_district,
      'destination_name',destination_label,'money',(select money from public.players where id=p_player_id));
  end if;
  if r.status='dispatching' and clock_timestamp()<r.arrives_at then
    return jsonb_build_object('completed',false,'status','dispatching',
      'remaining_ms',greatest(1,ceil(extract(epoch from (r.arrives_at-clock_timestamp()))*1000)::bigint));
  end if;
  if r.status='dispatching' then
    update public.district_taxi_rides set status='in_trip' where id=r.id returning * into r;
    return jsonb_build_object('completed',false,'status','in_trip',
      'remaining_ms',greatest(1,ceil(extract(epoch from (r.completes_at-clock_timestamp()))*1000)::bigint));
  end if;
  if clock_timestamp()<r.completes_at then
    return jsonb_build_object('completed',false,'status','in_trip',
      'remaining_ms',greatest(1,ceil(extract(epoch from (r.completes_at-clock_timestamp()))*1000)::bigint));
  end if;
  update public.players set current_district=r.destination_district where id=p_player_id;
  update public.district_taxi_rides set status='completed',completed_at=clock_timestamp() where id=r.id;
  return jsonb_build_object('completed',true,'current_district',r.destination_district,
    'destination_name',destination_label,'money',(select money from public.players where id=p_player_id));
end $$;

-- Prevent bypassing the ride timer through the ordinary district-travel RPC.
create or replace function public.district_travel_rpc(p_player_id uuid,p_district text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.players; cost integer; district_label text; new_health integer;
begin
  if p_district is null or p_district not in ('center','residential','factory') then
    return jsonb_build_object('error','Неизвестный район');
  end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if exists(select 1 from public.district_taxi_rides where player_id=p_player_id and status in ('dispatching','in_trip')) then
    return jsonb_build_object('error','Дождись завершения поездки на такси');
  end if;
  if p.current_district=p_district then return jsonb_build_object('error','Ты уже в этом районе'); end if;
  cost:=case when coalesce(p.has_car,false) then 5 else 20 end;
  if coalesce(p.energy,0)<cost then return jsonb_build_object('error',format('Нужно %s энергии для поездки',cost)); end if;
  district_label:=case p_district when 'center' then 'Центр'
    when 'residential' then 'Спальный район' else 'Заводской район' end;
  update public.players set current_district=p_district,energy=coalesce(energy,0)-cost,
    car_health=case when coalesce(has_car,false) then greatest(0,coalesce(car_health,100)-2) else car_health end
    where id=p_player_id returning car_health into new_health;
  return jsonb_build_object('success',true,'current_district',p_district,'district_name',district_label,
    'energy',coalesce(p.energy,0)-cost,'energy_spent',cost,
    'personal_car_health',case when coalesce(p.has_car,false) then new_health else null end);
end $$;

revoke all on function public.district_taxi_options_rpc(uuid),
  public.district_taxi_order_rpc(uuid,text,uuid,text),
  public.district_taxi_ride_state_rpc(uuid),
  public.district_taxi_finish_ride_rpc(uuid,uuid),
  public.district_travel_rpc(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.district_taxi_options_rpc(uuid),
  public.district_taxi_order_rpc(uuid,text,uuid,text),
  public.district_taxi_ride_state_rpc(uuid),
  public.district_taxi_finish_ride_rpc(uuid,uuid),
  public.district_travel_rpc(uuid,text) to service_role;

notify pgrst,'reload schema';
