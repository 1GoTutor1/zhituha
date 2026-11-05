-- Personal cars spend condition on inter-district trips, not profession shifts.
-- Apply after BUSINESS_COMMERCE_MIGRATION.sql and DISTRICT_TAXI_RIDES_MIGRATION.sql.

do $$
begin
  if to_regprocedure('public.finish_profession_cycle_rpc_before_personal_car_travel_wear(uuid)') is null then
    if to_regprocedure('public.finish_profession_cycle_rpc(uuid)') is null then
      raise exception 'finish_profession_cycle_rpc is missing';
    end if;
    alter function public.finish_profession_cycle_rpc(uuid)
      rename to finish_profession_cycle_rpc_before_personal_car_travel_wear;
  end if;

  if to_regprocedure('public.district_travel_rpc_before_personal_car_travel_wear(uuid,text)') is null then
    if to_regprocedure('public.district_travel_rpc(uuid,text)') is null then
      raise exception 'district_travel_rpc is missing; apply DISTRICT_TAXI_RIDES_MIGRATION.sql first';
    end if;
    alter function public.district_travel_rpc(uuid,text)
      rename to district_travel_rpc_before_personal_car_travel_wear;
  end if;
end $$;

-- Older commerce migrations reduced personal car condition after every profession shift.
-- Preserve the old condition around the legacy call so shifts no longer wear the car.
create or replace function public.finish_profession_cycle_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  result_json jsonb;
  had_car boolean;
  previous_health integer;
begin
  select coalesce(has_car,false), coalesce(car_health,100)
    into had_car, previous_health
    from public.players
    where id = p_player_id
    for update;

  result_json := public.finish_profession_cycle_rpc_before_personal_car_travel_wear(p_player_id);
  if result_json is null or result_json ? 'error' then
    return result_json;
  end if;

  if coalesce(had_car,false) then
    update public.players set car_health = previous_health where id = p_player_id;
    result_json := result_json || jsonb_build_object('personal_car_health', previous_health);
  end if;
  return result_json;
end;
$$;

-- A successful district trip in the player's own car costs 5 energy (existing
-- district rule) and 2 condition points. Failed/same-district attempts cost neither.
create or replace function public.district_travel_rpc(p_player_id uuid, p_district text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  result_json jsonb;
  had_car boolean;
  new_health integer;
begin
  result_json := public.district_travel_rpc_before_personal_car_travel_wear(p_player_id, p_district);
  if result_json is null or result_json->>'success' is distinct from 'true' then
    return result_json;
  end if;

  select coalesce(has_car,false) into had_car
    from public.players where id = p_player_id for update;
  if coalesce(had_car,false) then
    update public.players
      set car_health = greatest(0, coalesce(car_health,100) - 2)
      where id = p_player_id
      returning car_health into new_health;
    result_json := result_json || jsonb_build_object('personal_car_health', new_health);
  end if;
  return result_json;
end;
$$;

revoke all on function public.finish_profession_cycle_rpc_before_personal_car_travel_wear(uuid),
  public.district_travel_rpc_before_personal_car_travel_wear(uuid,text)
  from public, anon, authenticated, service_role;
revoke all on function public.finish_profession_cycle_rpc(uuid),
  public.district_travel_rpc(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.finish_profession_cycle_rpc(uuid),
  public.district_travel_rpc(uuid,text) to service_role;

notify pgrst, 'reload schema';
