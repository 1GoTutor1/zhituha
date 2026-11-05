-- District map and travel energy. Apply after BUSINESS_LOCATIONS_MIGRATION.sql,
-- BUSINESS_COMMERCE_MIGRATION.sql, BUSINESS_LEASE_TO_OWN_MIGRATION.sql,
-- COFFEE_BARISTA_PAYOUT_FIX.sql and REMOVE_ENERGY_MIGRATION.sql.

alter table public.players
  add column if not exists current_district text;
alter table public.players
  drop constraint if exists players_current_district_check;
alter table public.players
  add constraint players_current_district_check
  check (current_district in ('center','residential','factory'));

alter table public.business_locations
  add column if not exists district text,
  add column if not exists retired boolean not null default false;
alter table public.business_locations
  drop constraint if exists business_locations_district_check;
alter table public.business_locations
  add constraint business_locations_district_check
  check (district in ('center','residential','factory'));

-- Seven active business points in each of three districts. Retired points are
-- kept in place so any existing owner and their business remain untouched.
update public.business_locations set district = case location_key
  when 'coffee_01' then 'center' when 'coffee_02' then 'center'
  when 'salon_high' then 'center' when 'taxi_yandex' then 'center'
  when 'minimarket_01' then 'center' when 'repair_01' then 'center' when 'casino_01' then 'center'
  when 'coffee_03' then 'residential' when 'coffee_04' then 'residential'
  when 'salon_low' then 'residential' when 'taxi_maxim' then 'residential'
  when 'minimarket_02' then 'residential' when 'minimarket_03' then 'residential' when 'repair_02' then 'residential'
  when 'coffee_05' then 'factory' when 'coffee_06' then 'factory'
  when 'salon_mid' then 'factory' when 'taxi_uber' then 'factory'
  when 'construction_01' then 'factory' when 'construction_02' then 'factory' when 'minimarket_04' then 'factory'
  when 'coffee_07' then 'factory' when 'minimarket_05' then 'residential'
  else coalesce(district,'center') end;
update public.business_locations
set retired = location_key in ('coffee_07','minimarket_05'),
    purchase_price = case when location_key in ('coffee_07','minimarket_05') then null else purchase_price end;

-- Spread existing players deterministically; future registrations receive a
-- stable district from their Telegram ID without exposing a choice to spoof.
with ordered_players as (
  select id, row_number() over(order by created_at, id) - 1 as rn
  from public.players where current_district is null
)
update public.players p
set current_district = case mod(o.rn,3) when 0 then 'center' when 1 then 'residential' else 'factory' end
from ordered_players o where o.id=p.id;
update public.players set current_district='center' where current_district is null;
alter table public.players alter column current_district set not null;

create or replace function public.assign_player_district()
returns trigger language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
  if new.current_district is null or new.current_district not in ('center','residential','factory') then
    new.current_district := case mod((hashtext(coalesce(new.telegram_id,''))::bigint & 2147483647),3)
      when 0 then 'center' when 1 then 'residential' else 'factory' end;
  end if;
  return new;
end $$;
drop trigger if exists players_assign_district on public.players;
create trigger players_assign_district before insert or update of current_district
on public.players for each row execute function public.assign_player_district();

-- Keep lease metadata added by the existing catalog wrapper and add district
-- fields; hide only vacant retired points from the public list.
do $$ begin
  if to_regprocedure('public.business_catalog_rpc_before_districts(uuid)') is null then
    execute 'alter function public.business_catalog_rpc(uuid) rename to business_catalog_rpc_before_districts';
  end if;
end $$;
create or replace function public.business_catalog_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare catalog jsonb; locations jsonb;
begin
  catalog := public.business_catalog_rpc_before_districts(p_player_id);
  select coalesce(jsonb_agg(
    loc || jsonb_build_object('district', bl.district,
      'district_name', case bl.district when 'center' then 'Центр' when 'residential' then 'Спальный район' else 'Заводской район' end)
    order by case bl.district when 'center' then 1 when 'residential' then 2 else 3 end, bl.location_key
  ),'[]'::jsonb) into locations
  from jsonb_array_elements(coalesce(catalog->'locations','[]'::jsonb)) with ordinality as rows(loc,ordinality)
  join public.business_locations bl on bl.location_key=loc->>'location_key'
  where not bl.retired or nullif(loc->>'business_id','') is not null;
  return jsonb_set(catalog,'{locations}',locations,true);
end $$;

-- Enrich shop cards from the same source catalog so the UI can explain why a
-- coffee point is unavailable while travelling elsewhere.
do $$ begin
  if to_regprocedure('public.business_shop_state_rpc_before_districts(uuid)') is null then
    execute 'alter function public.business_shop_state_rpc(uuid) rename to business_shop_state_rpc_before_districts';
  end if;
end $$;
create or replace function public.business_shop_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result jsonb; shops jsonb;
begin
  result := public.business_shop_state_rpc_before_districts(p_player_id);
  select coalesce(jsonb_agg(shop || jsonb_build_object(
    'district', bl.district,
    'district_name', case bl.district when 'center' then 'Центр' when 'residential' then 'Спальный район' else 'Заводской район' end
  ) order by ordinality),'[]'::jsonb) into shops
  from jsonb_array_elements(coalesce(result->'shops','[]'::jsonb)) with ordinality as rows(shop,ordinality)
  left join public.businesses b on b.id=(shop->>'business_id')::uuid
  left join public.business_locations bl on bl.business_id=b.id;
  return jsonb_set(result,'{shops}',shops,true);
end $$;

-- Enforce district-only coffee access in the database, even for direct RPC calls.
do $$ begin
  if to_regprocedure('public.business_shop_buy_rpc_before_districts(uuid,uuid,text,integer)') is null then
    execute 'alter function public.business_shop_buy_rpc(uuid,uuid,text,integer) rename to business_shop_buy_rpc_before_districts';
  end if;
end $$;
create or replace function public.business_shop_buy_rpc(
  p_player_id uuid,p_business_id uuid,p_product_id text,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare player_district text; shop_district text; shop_type text;
begin
  select current_district into player_district from public.players where id=p_player_id;
  select b.biz_type, bl.district into shop_type,shop_district
  from public.businesses b left join public.business_locations bl on bl.business_id=b.id
  where b.id=p_business_id;
  if shop_type='coffee' and shop_district is not null and shop_district is distinct from player_district then
    return jsonb_build_object('error','Кофейня находится в другом районе. Сначала приезжай туда.');
  end if;
  return public.business_shop_buy_rpc_before_districts(p_player_id,p_business_id,p_product_id,p_quantity);
end $$;

do $$ begin
  if to_regprocedure('public.buy_coffee_rpc_before_districts(uuid,uuid)') is null then
    execute 'alter function public.buy_coffee_rpc(uuid,uuid) rename to buy_coffee_rpc_before_districts';
  end if;
end $$;
create or replace function public.buy_coffee_rpc(p_buyer_id uuid,p_cafe_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare player_district text; cafe_district text;
begin
  select current_district into player_district from public.players where id=p_buyer_id;
  select bl.district into cafe_district from public.businesses b
  left join public.business_locations bl on bl.business_id=b.id
  where b.id=p_cafe_id and b.biz_type='coffee';
  if cafe_district is not null and cafe_district is distinct from player_district then
    return jsonb_build_object('error','Эта кофейня в другом районе. Сначала приезжай туда.');
  end if;
  return public.buy_coffee_rpc_before_districts(p_buyer_id,p_cafe_id);
end $$;

create or replace function public.district_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.players;
begin
  select * into p from public.players where id=p_player_id;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  return jsonb_build_object(
    'current_district',p.current_district,'energy',coalesce(p.energy,0),'has_car',coalesce(p.has_car,false),
    'locations',coalesce((select jsonb_agg(jsonb_build_object(
      'location_key',l.location_key,'biz_type',l.biz_type,'business_name',l.business_name,
      'business_id',l.business_id,'district',l.district,'district_name',
      case l.district when 'center' then 'Центр' when 'residential' then 'Спальный район' else 'Заводской район' end,
      'status',case when l.business_id is null then 'available' when b.owner_id=p_player_id then 'owned' else 'busy' end)
      order by l.district,l.location_key)
      from public.business_locations l left join public.businesses b on b.id=l.business_id
      where not l.retired or l.business_id is not null),'[]'::jsonb));
end $$;

create or replace function public.district_travel_rpc(p_player_id uuid,p_district text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.players; cost integer; district_label text; new_health integer;
begin
  if p_district is null or p_district not in ('center','residential','factory') then return jsonb_build_object('error','Неизвестный район'); end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if p.current_district=p_district then return jsonb_build_object('error','Ты уже в этом районе'); end if;
  cost:=case when coalesce(p.has_car,false) then 5 else 20 end;
  if coalesce(p.energy,0)<cost then return jsonb_build_object('error',format('Нужно %s энергии для поездки',cost)); end if;
  district_label:=case p_district when 'center' then 'Центр' when 'residential' then 'Спальный район' else 'Заводской район' end;
  update public.players set current_district=p_district,energy=coalesce(energy,0)-cost,
    car_health=case when coalesce(has_car,false) then greatest(0,coalesce(car_health,100)-2) else car_health end
    where id=p_player_id returning car_health into new_health;
  return jsonb_build_object('success',true,'current_district',p_district,'district_name',district_label,
    'energy',coalesce(p.energy,0)-cost,'energy_spent',cost,
    'personal_car_health',case when coalesce(p.has_car,false) then new_health else null end);
end $$;

create or replace function public.district_rest_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result jsonb;
begin
  result:=public.rest_rpc(p_player_id);
  if result ? 'error' then return result; end if;
  return result;
end $$;

revoke all on function public.business_catalog_rpc(uuid),public.business_catalog_rpc_before_districts(uuid),
  public.business_shop_state_rpc(uuid),public.business_shop_state_rpc_before_districts(uuid),
  public.business_shop_buy_rpc(uuid,uuid,text,integer),public.business_shop_buy_rpc_before_districts(uuid,uuid,text,integer),
  public.buy_coffee_rpc(uuid,uuid),public.buy_coffee_rpc_before_districts(uuid,uuid),
  public.district_state_rpc(uuid),public.district_travel_rpc(uuid,text),public.district_rest_rpc(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.business_catalog_rpc(uuid),public.business_shop_state_rpc(uuid),
  public.business_shop_buy_rpc(uuid,uuid,text,integer),public.buy_coffee_rpc(uuid,uuid),
  public.district_state_rpc(uuid),public.district_travel_rpc(uuid,text),public.district_rest_rpc(uuid)
  to service_role;

notify pgrst,'reload schema';
