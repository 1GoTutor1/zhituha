-- One row per vehicle, including legacy duplicate models and listed vehicles.
-- Apply before deploying the garage client. Existing active-car fields remain
-- the interface for travel, repairs, numbers and bank collateral.
do $$
begin
  if exists(select 1 from public.players p where p.has_car and not exists(select 1 from public.business_vehicle_catalog c where c.model_id=p.car_model))
    or exists(select 1 from public.market_items m where m.item_type='car' and m.item_data like 'personal:%'
      and not exists(select 1 from public.business_vehicle_catalog c where c.model_id=split_part(m.item_data,':',2))) then
    raise exception 'Unknown personal vehicle model: reconcile catalog before migrating garage';
  end if;
end $$;
create table public.player_garage_vehicles (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  model_id text not null references public.business_vehicle_catalog(model_id),
  health smallint not null default 100 check (health between 0 and 100),
  plate text,
  is_active boolean not null default false,
  is_owned boolean not null default true,
  is_listed boolean not null default false,
  market_item_id uuid unique references public.market_items(id) on delete set null,
  acquired_at timestamptz not null default clock_timestamp(),
  check (not is_active or (is_owned and not is_listed))
);
create unique index garage_one_active on public.player_garage_vehicles(player_id) where is_active;
create unique index garage_owned_plate on public.player_garage_vehicles(plate) where is_owned and plate is not null;
create index garage_owner on public.player_garage_vehicles(player_id) where is_owned;
alter table public.player_garage_vehicles enable row level security;
revoke all on public.player_garage_vehicles from public, anon, authenticated, service_role;

insert into public.player_garage_vehicles(player_id,model_id,health,plate,is_active)
select p.id,p.car_model,coalesce(p.car_health,100),p.car_plate,true
from public.players p join public.business_vehicle_catalog c on c.model_id=p.car_model
where p.has_car;
-- Plates of listed cars already belong to the seller's separate number collection.
insert into public.player_garage_vehicles(player_id,model_id,health,is_listed,market_item_id)
select m.seller_id,split_part(m.item_data,':',2),coalesce(s.car_health,100),true,m.id
from public.market_items m
join public.business_vehicle_catalog c on c.model_id=split_part(m.item_data,':',2)
left join private.market_personal_car_snapshots s on s.market_item_id=m.id
where m.item_type='car' and m.item_data like 'personal:%';

create function private.garage_capacity(p_owned boolean,p_type text) returns integer
language sql immutable set search_path='' as $$
  select case when not coalesce(p_owned,false) then 1
    else case p_type when 'penthouse' then 6 when 'house' then 4 when 'apartment' then 2 else 1 end end
$$;
revoke all on function private.garage_capacity(boolean,text) from public,anon,authenticated;

-- Internal switches must not reroll plates, heal cars or archive parked plates.
create or replace function public.ensure_personal_car_plate() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if current_setting('zhituha.garage_internal',true)='on' then return new; end if;
  if coalesce(new.has_car,false) then
    if tg_op='INSERT' or not coalesce(old.has_car,false) or new.car_model is distinct from old.car_model or nullif(new.car_plate,'') is null then
      new.car_plate:=public.generate_car_plate();
    end if;
  else new.car_plate:=null;
  end if;
  return new;
end $$;
create or replace function public.reset_personal_car_condition() returns trigger
language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
  if current_setting('zhituha.garage_internal',true)='on' then return new; end if;
  if new.has_car and (not coalesce(old.has_car,false) or new.car_model is distinct from old.car_model) then new.car_health:=100; end if;
  return new;
end $$;
create or replace function public.archive_previous_car_plate() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if current_setting('zhituha.garage_internal',true)='on' then return new; end if;
  if coalesce(old.has_car,false) and nullif(old.car_plate,'') is not null and old.car_plate is distinct from new.car_plate then
    insert into public.player_car_numbers(player_id,plate,estimated_value)
    values(old.id,old.car_plate,public.car_plate_value(old.car_plate)) on conflict(plate) do nothing;
  end if;
  return new;
end $$;
alter function public.generate_car_plate() rename to generate_car_plate_before_garage;
create function public.generate_car_plate() returns text
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare candidate text; i integer;
begin
  perform pg_advisory_xact_lock(hashtext('zhituha-car-plate'));
  for i in 1..100 loop
    candidate:=public.generate_car_plate_before_garage();
    if not exists(select 1 from public.player_garage_vehicles where plate=candidate and is_owned) then return candidate; end if;
  end loop;
  raise exception 'Unable to allocate a unique garage plate';
end $$;
revoke all on function public.generate_car_plate(),public.generate_car_plate_before_garage() from public,anon,authenticated,service_role;
alter function public.generate_number_case_plate(text) rename to generate_number_case_plate_before_garage;
create function public.generate_number_case_plate(p_tier text) returns text
language plpgsql security definer set search_path='' as $$
declare candidate text; i integer;
begin
  for i in 1..100 loop
    candidate:=public.generate_number_case_plate_before_garage(p_tier);
    if not exists(select 1 from public.player_garage_vehicles where plate=candidate and is_owned) then return candidate; end if;
  end loop;
  raise exception 'Unable to allocate a unique garage case plate';
end $$;
revoke all on function public.generate_number_case_plate(text),public.generate_number_case_plate_before_garage(text) from public,anon,authenticated,service_role;

create function private.sync_player_garage_vehicle() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if current_setting('zhituha.garage_internal',true)='on' then return new; end if;
  if coalesce(old.has_car,false) and (not coalesce(new.has_car,false) or old.car_model is distinct from new.car_model) then
    update public.player_garage_vehicles set is_active=false,is_owned=false,plate=null
    where player_id=new.id and is_active;
  end if;
  if coalesce(new.has_car,false) then
    update public.player_garage_vehicles set health=new.car_health,plate=new.car_plate
    where player_id=new.id and is_active;
    if not found then
      insert into public.player_garage_vehicles(player_id,model_id,health,plate,is_active)
      values(new.id,new.car_model,coalesce(new.car_health,100),new.car_plate,true);
    end if;
  end if;
  return new;
end $$;
revoke all on function private.sync_player_garage_vehicle() from public,anon,authenticated;
create trigger players_sync_garage_vehicle after update of has_car,car_model,car_health,car_plate
on public.players for each row execute function private.sync_player_garage_vehicle();

-- Parked plates must still count in the existing end-of-season collection.
create or replace function public.number_case_finalize_expired_seasons() returns integer
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare old_season record; finalized_count integer:=0;
begin
  for old_season in select season_no from public.season_pass_seasons
    where ends_at<=clock_timestamp() and number_collection_finalized_at is null
    order by season_no for update
  loop
    insert into public.player_forever_car_numbers(plate,player_id,estimated_value,earned_at)
    select plate,player_id,estimated_value,created_at from public.player_car_numbers where estimated_value>=30000
    on conflict(plate) do nothing;
    insert into public.player_forever_car_numbers(plate,player_id,estimated_value)
    select car_plate,id,public.car_plate_value(car_plate) from public.players
    where has_car and car_plate is not null and public.car_plate_value(car_plate)>=30000
    on conflict(plate) do nothing;
    insert into public.player_forever_car_numbers(plate,player_id,estimated_value)
    select plate,player_id,public.car_plate_value(plate) from public.player_garage_vehicles
    where is_owned and plate is not null and public.car_plate_value(plate)>=30000
    on conflict(plate) do nothing;
    update public.season_pass_seasons set number_collection_finalized_at=clock_timestamp() where season_no=old_season.season_no;
    finalized_count:=finalized_count+1;
  end loop;
  return finalized_count;
end $$;
create trigger garage_finalize_season_before_change before delete or update of plate,is_owned
on public.player_garage_vehicles for each row execute function public.number_case_finalize_before_number_change();

create function public.player_garage_state_rpc(p_player_id uuid) returns jsonb
language sql security definer set search_path='' as $$
select jsonb_build_object(
  'vehicles',coalesce((select jsonb_agg(jsonb_build_object(
    'id',g.id,'model_id',g.model_id,'model_name',c.model_name,'health',g.health,
    'plate',g.plate,'is_active',g.is_active,'is_listed',g.is_listed,'base_price',c.base_price
  ) order by g.is_active desc,g.is_listed,c.base_price desc,g.id)
  from public.player_garage_vehicles g join public.business_vehicle_catalog c on c.model_id=g.model_id
  where g.player_id=p.id and g.is_owned),'[]'::jsonb),
  'garage_slots',private.garage_capacity(p.has_house,p.house_type),
  'garage_used',(select count(*) from public.player_garage_vehicles g where g.player_id=p.id and g.is_owned))
from public.players p where p.id=p_player_id
$$;

create function public.garage_set_active_rpc(p_player_id uuid,p_vehicle_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.players; v public.player_garage_vehicles; previous_flag text;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  select * into v from public.player_garage_vehicles where id=p_vehicle_id and player_id=p_player_id and is_owned and not is_listed for update;
  if not found then return jsonb_build_object('error','Машина недоступна'); end if;
  if v.is_active then return jsonb_build_object('success',true); end if;
  if exists(select 1 from public.bank_loans where player_id=p_player_id and status='active' and collateral_type='car' and amount_due>0) then
    return jsonb_build_object('error','Сначала погаси кредит под залог активной машины');
  end if;
  previous_flag:=coalesce(current_setting('zhituha.garage_internal',true),'off');
  perform set_config('zhituha.garage_internal','on',true);
  delete from public.player_car_numbers where player_id=p_player_id and plate=p.car_plate;
  update public.player_garage_vehicles set is_active=false where player_id=p_player_id and is_active;
  update public.player_garage_vehicles set is_active=true where id=v.id;
  update public.players set has_car=true,car_model=v.model_id,car_health=v.health,car_plate=v.plate where id=p_player_id;
  perform set_config('zhituha.garage_internal',previous_flag,true);
  return jsonb_build_object('success',true);
end $$;

create function public.home_upgrade_rpc(p_player_id uuid,p_target_type text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.players; next_type text; cost bigint; slots integer;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if not coalesce(p.has_house,false) then return jsonb_build_object('error','Сначала купи квартиру'); end if;
  if exists(select 1 from public.bank_loans where player_id=p_player_id and status='active' and collateral_type='house' and amount_due>0) then
    return jsonb_build_object('error','Сначала погаси кредит под залог жилья');
  end if;
  case p.house_type
    when 'apartment' then next_type:='house'; cost:=450000; slots:=4;
    when 'house' then next_type:='penthouse'; cost:=2500000; slots:=6;
    else return jsonb_build_object('error','Жильё уже максимального уровня');
  end case;
  if p_target_type is distinct from next_type then return jsonb_build_object('error','Обнови состояние жилья'); end if;
  if coalesce(p.money,0)<cost then return jsonb_build_object('error','Не хватает денег'); end if;
  update public.players set money=money-cost,house_type=next_type where id=p_player_id;
  return jsonb_build_object('success',true,'house_type',next_type,'garage_slots',slots,'money',p.money-cost);
end $$;

alter function public.buy_market_item(uuid,uuid,integer) rename to buy_market_item_before_garage;
alter function public.list_item_rpc(uuid,text,text,bigint,text,integer) rename to list_item_rpc_before_garage;
alter function public.cancel_lot_rpc(uuid,uuid,boolean) rename to cancel_lot_rpc_before_garage;
-- Keep sale receipts classified correctly after wrapping the settlement RPC.
do $$
declare definition text; updated text;
begin
  if to_regprocedure('public.audit_player_money_change()') is not null then
    definition:=pg_get_functiondef('public.audit_player_money_change()'::regprocedure);
    updated:=replace(definition,
      'v_source := coalesce(v_source, ''direct_database_update'');',
      'v_source := coalesce(v_source, ''direct_database_update''); if v_source = ''buy_market_item_before_garage'' then v_source := ''buy_market_item''; end if;');
    if updated=definition then raise exception 'Money audit source mapping changed; review migration'; end if;
    execute updated;
  end if;
end $$;
-- Extend the existing market settlement, stock and salary logic to upgraded homes.
-- Fail closed if a future underlying implementation no longer has these predicates.
do $$
declare definition text; updated text;
begin
  definition:=pg_get_functiondef('public.buy_market_item_before_garage(uuid,uuid,integer)'::regprocedure);
  updated:=replace(definition, 'real_data=''apartment''', 'real_data in (''apartment'',''house'',''penthouse'')');
  if updated=definition then raise exception 'House purchase predicate changed; review migration'; end if;
  execute updated;
  definition:=pg_get_functiondef('public.list_item_rpc_before_personal_car_snapshot(uuid,text,text,bigint,text,integer)'::regprocedure);
  updated:=replace(definition,'p_item_data=''apartment''','p_item_data in (''apartment'',''house'',''penthouse'')');
  if updated=definition then raise exception 'House listing predicate changed; review migration'; end if;
  execute updated;
end $$;

create function public.buy_market_item(p_buyer_id uuid,p_item_id uuid,p_commission_percent integer default 5) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.players; m public.market_items; result jsonb; previous_flag text;
  source_vehicle uuid; saved_health smallint; fresh_plate text;
begin
  -- Market row first, then players in stable order: matches cancellation/listing.
  select * into m from public.market_items where id=p_item_id for update;
  if not found then return jsonb_build_object('error','Лот не найден'); end if;
  perform 1 from public.players where id in (p_buyer_id,m.seller_id) order by id for update;
  select * into p from public.players where id=p_buyer_id;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if m.item_type<>'car' then
    if m.item_type='house' and exists(select 1 from public.market_items where seller_id=p_buyer_id and item_type='house' and item_data like 'personal:%') then
      return jsonb_build_object('error','Сначала продай или сними с рынка своё жильё');
    end if;
    return public.buy_market_item_before_garage(p_buyer_id,p_item_id,p_commission_percent);
  end if;
  if exists(select 1 from public.bank_loans where player_id=p_buyer_id and status='active' and collateral_type='car' and amount_due>0) then
    return jsonb_build_object('error','Сначала погаси кредит под залог машины');
  end if;
  if (select count(*) from public.player_garage_vehicles where player_id=p_buyer_id and is_owned)>=private.garage_capacity(p.has_house,p.house_type) then
    return jsonb_build_object('error','В гараже нет свободного места');
  end if;
  select id,health into source_vehicle,saved_health from public.player_garage_vehicles where market_item_id=m.id and player_id=m.seller_id and is_owned and is_listed;
  if split_part(m.item_data,':',1)='personal' and source_vehicle is null then
    return jsonb_build_object('error','Не удалось подтвердить автомобиль продавца');
  end if;
  previous_flag:=coalesce(current_setting('zhituha.garage_internal',true),'off');
  perform set_config('zhituha.garage_internal','on',true);
  update public.players set has_car=false where id=p_buyer_id;
  result:=public.buy_market_item_before_garage(p_buyer_id,p_item_id,p_commission_percent);
  if result ? 'error' then
    update public.players set has_car=p.has_car,car_model=p.car_model,car_health=p.car_health,car_plate=p.car_plate where id=p_buyer_id;
    perform set_config('zhituha.garage_internal',previous_flag,true);
    return result;
  end if;
  fresh_plate:=public.generate_car_plate();
  saved_health:=coalesce(saved_health,100);
  delete from public.player_car_numbers where player_id=p_buyer_id and plate=p.car_plate;
  update public.player_garage_vehicles set is_active=false where player_id=p_buyer_id and is_active;
  update public.player_garage_vehicles set is_owned=false,is_listed=false,market_item_id=null,plate=null where id=source_vehicle;
  insert into public.player_garage_vehicles(player_id,model_id,health,plate,is_active)
  values(p_buyer_id,result->>'item_data',saved_health,fresh_plate,true);
  update public.players set car_health=saved_health,car_plate=fresh_plate where id=p_buyer_id;
  perform set_config('zhituha.garage_internal',previous_flag,true);
  return result || jsonb_build_object('car_health',saved_health,'car_plate',fresh_plate);
end $$;

create function public.list_item_rpc(p_seller_id uuid,p_item_type text,p_item_data text,p_price bigint,p_source text,p_bonus_slots integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.players; result jsonb; active_vehicle uuid; listing_id uuid;
begin
  select * into p from public.players where id=p_seller_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if p_source='personal' and p_item_type in ('car','house') then
    if exists(select 1 from public.bank_loans where player_id=p_seller_id and status='active' and collateral_type=p_item_type and amount_due>0) then
      return jsonb_build_object('error','Имущество находится в залоге');
    end if;
    if p_item_type='car' and (not coalesce(p.has_car,false) or p_item_data is distinct from p.car_model) then
      return jsonb_build_object('error','Можно выставить только свою активную машину');
    end if;
    if p_item_type='house' then
      if not coalesce(p.has_house,false) or p_item_data is distinct from p.house_type then return jsonb_build_object('error','Это жильё тебе не принадлежит'); end if;
      if (select count(*) from public.player_garage_vehicles where player_id=p_seller_id and is_owned)>1 then
        return jsonb_build_object('error','Сначала оставь не больше одной машины в гараже');
      end if;
    end if;
  end if;
  if p_source='stock' and p_item_type='house' and p_item_data is distinct from 'apartment' then
    return jsonb_build_object('error','На складе стройтреста доступны только квартиры');
  end if;
  select id into active_vehicle from public.player_garage_vehicles where player_id=p_seller_id and is_active;
  result:=public.list_item_rpc_before_garage(p_seller_id,p_item_type,p_item_data,p_price,p_source,p_bonus_slots);
  if result->>'success'='true' and p_source='personal' and p_item_type='car' then
    select id into listing_id from public.market_items where seller_id=p_seller_id and item_type='car' and item_data='personal:'||p_item_data order by created_at desc,id desc limit 1;
    update public.player_garage_vehicles set is_active=false,is_owned=true,is_listed=true,market_item_id=listing_id,plate=null where id=active_vehicle;
  end if;
  return result;
end $$;

create function public.cancel_lot_rpc(p_player_id uuid,p_item_id uuid,p_add_stock boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.players; m public.market_items; v public.player_garage_vehicles; saved_plate text; previous_flag text;
begin
  select * into m from public.market_items where id=p_item_id and seller_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Лот не найден'); end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if m.item_type<>'car' or split_part(m.item_data,':',1)<>'personal' then
    if m.item_type='house' and split_part(m.item_data,':',1)='personal' and p.has_house then
      return jsonb_build_object('error','Сначала освободи текущее жильё');
    end if;
    return public.cancel_lot_rpc_before_garage(p_player_id,p_item_id,p_add_stock);
  end if;
  select * into v from public.player_garage_vehicles where market_item_id=m.id and player_id=p_player_id and is_owned and is_listed for update;
  if not found then return jsonb_build_object('error','Автомобиль лота не найден'); end if;
  select s.car_plate into saved_plate from private.market_personal_car_snapshots s where s.market_item_id=m.id;
  -- Claim only a plate still in this seller's collection, never a sold plate.
  delete from public.player_car_numbers n where n.player_id=p_player_id and n.plate=saved_plate
    and not exists(select 1 from public.player_garage_vehicles g where g.is_owned and g.plate=saved_plate);
  if not found then saved_plate:=public.generate_car_plate(); end if;
  previous_flag:=coalesce(current_setting('zhituha.garage_internal',true),'off');
  perform set_config('zhituha.garage_internal','on',true);
  delete from public.market_items where id=m.id;
  update public.player_garage_vehicles set is_listed=false,market_item_id=null,plate=saved_plate,is_active=not coalesce(p.has_car,false) where id=v.id;
  if not coalesce(p.has_car,false) then
    update public.players set has_car=true,car_model=v.model_id,car_health=v.health,car_plate=saved_plate where id=p_player_id;
  end if;
  perform set_config('zhituha.garage_internal',previous_flag,true);
  return jsonb_build_object('success',true,'item_type','car','item_data',v.model_id,'returned_to_garage',true);
end $$;

-- The legacy resets enumerate tables explicitly; include parked vehicles.
alter function public.reset_game_rpc(uuid) rename to reset_game_rpc_before_garage;
create function public.reset_game_rpc(p_admin_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  result:=public.reset_game_rpc_before_garage(p_admin_id);
  if result->>'success'='true' then delete from public.player_garage_vehicles where player_id=p_admin_id; end if;
  return result;
end $$;
alter function public.admin_reset_player_rpc(uuid,uuid) rename to admin_reset_player_rpc_before_garage;
create function public.admin_reset_player_rpc(p_admin_id uuid,p_target_player_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  result:=public.admin_reset_player_rpc_before_garage(p_admin_id,p_target_player_id);
  if result->>'success'='true' then delete from public.player_garage_vehicles where player_id=p_target_player_id; end if;
  return result;
end $$;

revoke all on function public.player_garage_state_rpc(uuid),public.garage_set_active_rpc(uuid,uuid),public.home_upgrade_rpc(uuid,text),
  public.buy_market_item(uuid,uuid,integer),public.list_item_rpc(uuid,text,text,bigint,text,integer),public.cancel_lot_rpc(uuid,uuid,boolean),
  public.reset_game_rpc(uuid),public.admin_reset_player_rpc(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.player_garage_state_rpc(uuid),public.garage_set_active_rpc(uuid,uuid),public.home_upgrade_rpc(uuid,text),
  public.buy_market_item(uuid,uuid,integer),public.list_item_rpc(uuid,text,text,bigint,text,integer),public.cancel_lot_rpc(uuid,uuid,boolean),
  public.reset_game_rpc(uuid),public.admin_reset_player_rpc(uuid,uuid) to service_role;
revoke all on function public.buy_market_item_before_garage(uuid,uuid,integer),public.list_item_rpc_before_garage(uuid,text,text,bigint,text,integer),
  public.cancel_lot_rpc_before_garage(uuid,uuid,boolean),public.reset_game_rpc_before_garage(uuid),public.admin_reset_player_rpc_before_garage(uuid,uuid)
  from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
