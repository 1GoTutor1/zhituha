-- Balance taxi-fleet condition loss and preserve fractional wear between collections.
-- Without a mechanic: 8 condition points/hour. With a mechanic: 4 points/hour.
-- Apply after DEALERSHIP_FLEET_MIGRATION.sql.

do $$
begin
  if to_regprocedure('public.taxi_collect_rpc_before_wear_balance(uuid,uuid)') is null then
    if to_regprocedure('public.taxi_collect_rpc(uuid,uuid)') is null then
      raise exception 'taxi_collect_rpc is missing; apply DEALERSHIP_FLEET_MIGRATION.sql first';
    end if;
    execute 'alter function public.taxi_collect_rpc(uuid,uuid) rename to taxi_collect_rpc_before_wear_balance';
  end if;
end;
$$;

create or replace function public.taxi_collect_rpc(p_biz_id uuid,p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare
  fleet public.businesses;
  result_json jsonb;
  original_cars jsonb;
  updated_cars jsonb:='[]'::jsonb;
  car jsonb;
  now_ms bigint:=floor(extract(epoch from clock_timestamp())*1000);
  elapsed_hours numeric;
  wear_rate numeric;
  exact_wear numeric;
  wear_points integer;
  next_health integer;
  next_fraction numeric;
begin
  select * into fleet
  from public.businesses
  where id=p_biz_id and owner_id=p_player_id and biz_type='taxi'
  for update;

  -- Let the original function return its normal authorization/business error.
  if not found then
    return public.taxi_collect_rpc_before_wear_balance(p_biz_id,p_player_id);
  end if;

  original_cars:=case when jsonb_typeof(fleet.stock->'taxi_cars')='array'
    then fleet.stock->'taxi_cars' else '[]'::jsonb end;

  result_json:=public.taxi_collect_rpc_before_wear_balance(p_biz_id,p_player_id);
  if result_json ? 'error' or coalesce((result_json->>'income')::bigint,0)<=0 then
    return result_json;
  end if;

  if exists (
    select 1 from public.business_workers
    where business_id=p_biz_id and role='Механик' and player_id is not null
  ) then wear_rate:=4;
  else wear_rate:=8;
  end if;

  for car in select value from jsonb_array_elements(original_cars) loop
    if coalesce((car->>'health')::integer,0)<=0 then
      updated_cars:=updated_cars||jsonb_build_array(car);
      continue;
    end if;

    elapsed_hours:=least(greatest(0,
      (now_ms-coalesce((car->>'last_claim')::bigint,now_ms))/3600000.0),8);
    exact_wear:=elapsed_hours*wear_rate+coalesce((car->>'wear_fraction')::numeric,0);
    wear_points:=floor(exact_wear)::integer;
    next_fraction:=exact_wear-wear_points;
    next_health:=greatest(0,coalesce((car->>'health')::integer,100)-wear_points);
    if next_health=0 then next_fraction:=0; end if;

    car:=car||jsonb_build_object(
      'health',next_health,
      'last_claim',now_ms,
      'wear_fraction',next_fraction
    );
    updated_cars:=updated_cars||jsonb_build_array(car);
  end loop;

  update public.businesses
  set stock=jsonb_set(coalesce(stock,'{}'::jsonb),'{taxi_cars}',updated_cars,true)
  where id=p_biz_id;

  return result_json||jsonb_build_object(
    'stock',jsonb_set(coalesce(fleet.stock,'{}'::jsonb),'{taxi_cars}',updated_cars,true)
  );
end;
$$;

revoke all on function public.taxi_collect_rpc(uuid,uuid),
  public.taxi_collect_rpc_before_wear_balance(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.taxi_collect_rpc(uuid,uuid) to service_role;

notify pgrst,'reload schema';
