-- Courier shifts get a server-assigned district destination. Run after
-- PROFESSIONS_INVENTORY_MIGRATION.sql, DISTRICTS_ENERGY_MIGRATION.sql,
-- DISTRICT_TAXI_RIDES_MIGRATION.sql, and all later profession-cycle migrations.
-- Courier cash rewards are guaranteed to be at least 550 RUB (usual range 550–670).

alter table public.profession_cycles
  add column if not exists delivery_district text;

-- Give already-running courier shifts a destination without interrupting them.
update public.profession_cycles c
set delivery_district = case p.current_district
  when 'center' then case when random() < 0.5 then 'residential' else 'factory' end
  when 'residential' then case when random() < 0.5 then 'center' else 'factory' end
  else case when random() < 0.5 then 'center' else 'residential' end
end
from public.players p
where p.id = c.player_id
  and c.profession = 'courier'
  and c.status = 'active'
  and c.delivery_district is null;

do $$
begin
  if to_regprocedure('public.profession_state_rpc_before_courier_district_delivery(uuid)') is null then
    if to_regprocedure('public.profession_state_rpc(uuid)') is null then
      raise exception 'Profession RPCs are missing; apply PROFESSIONS_INVENTORY_MIGRATION.sql first';
    end if;
    alter function public.profession_state_rpc(uuid)
      rename to profession_state_rpc_before_courier_district_delivery;
  end if;
  if to_regprocedure('public.start_profession_cycle_rpc_before_courier_district_delivery(uuid)') is null then
    alter function public.start_profession_cycle_rpc(uuid)
      rename to start_profession_cycle_rpc_before_courier_district_delivery;
  end if;
  if to_regprocedure('public.profession_step_rpc_before_courier_district_delivery(uuid,smallint)') is null then
    alter function public.profession_step_rpc(uuid,smallint)
      rename to profession_step_rpc_before_courier_district_delivery;
  end if;
  if to_regprocedure('public.finish_profession_cycle_rpc_before_courier_district_delivery(uuid)') is null then
    alter function public.finish_profession_cycle_rpc(uuid)
      rename to finish_profession_cycle_rpc_before_courier_district_delivery;
  end if;
end;
$$;

create or replace function public.profession_state_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  result_json jsonb;
  destination text;
  cycle_id uuid;
begin
  result_json := public.profession_state_rpc_before_courier_district_delivery(p_player_id);
  if result_json is null or result_json ? 'error'
     or result_json->'active_cycle' is null
     or result_json->'active_cycle' = 'null'::jsonb then
    return result_json;
  end if;

  cycle_id := (result_json->'active_cycle'->>'id')::uuid;
  select delivery_district into destination
  from public.profession_cycles
  where id = cycle_id and profession = 'courier' and status = 'active';

  if destination is not null then
    result_json := jsonb_set(result_json, '{active_cycle,delivery_district}', to_jsonb(destination), true);
  end if;
  return result_json;
end;
$$;

create or replace function public.start_profession_cycle_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  result_json jsonb;
  cycle_id uuid;
  v_current_district text;
  destination text;
begin
  result_json := public.start_profession_cycle_rpc_before_courier_district_delivery(p_player_id);
  if result_json is null or result_json ? 'error'
     or result_json->'active_cycle' is null
     or result_json->'active_cycle' = 'null'::jsonb
     or result_json->'active_cycle'->>'profession' <> 'courier' then
    return result_json;
  end if;

  cycle_id := (result_json->'active_cycle'->>'id')::uuid;
  select p.current_district into v_current_district
  from public.players p
  where p.id = p_player_id;

  destination := case v_current_district
    when 'center' then case when random() < 0.5 then 'residential' else 'factory' end
    when 'residential' then case when random() < 0.5 then 'center' else 'factory' end
    when 'factory' then case when random() < 0.5 then 'center' else 'residential' end
    else null
  end;

  if destination is null then
    return jsonb_build_object('error', 'Не удалось назначить район доставки. Обнови районы в игре.');
  end if;

  update public.profession_cycles
  set delivery_district = destination
  where id = cycle_id and profession = 'courier' and status = 'active';

  return jsonb_set(result_json, '{active_cycle,delivery_district}', to_jsonb(destination), true);
end;
$$;

create or replace function public.profession_step_rpc(p_player_id uuid, p_step smallint)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  cycle_row public.profession_cycles;
  player_district text;
  result_json jsonb;
begin
  if p_step between 2 and 3 then
    select * into cycle_row
    from public.profession_cycles
    where player_id = p_player_id and status = 'active'
    order by created_at desc
    limit 1
    for update;

    if found and cycle_row.profession = 'courier' then
      select current_district into player_district
      from public.players
      where id = p_player_id
      for update;

      if cycle_row.delivery_district is null then
        return jsonb_build_object('error', 'У заказа не назначен район доставки. Отмени текущую смену через поддержку.');
      end if;
      if player_district is distinct from cycle_row.delivery_district then
        return jsonb_build_object('error', 'Сначала отправься в назначенный район доставки');
      end if;
    end if;
  end if;

  result_json := public.profession_step_rpc_before_courier_district_delivery(p_player_id, p_step);
  if result_json is null or result_json ? 'error' then return result_json; end if;

  if cycle_row.id is not null and cycle_row.profession = 'courier' then
    result_json := jsonb_set(result_json, '{delivery_district}', to_jsonb(cycle_row.delivery_district), true);
  end if;
  return result_json;
end;
$$;

create or replace function public.finish_profession_cycle_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  cycle_row public.profession_cycles;
  player_district text;
  result_json jsonb;
  reward bigint;
  target_reward bigint;
  bonus bigint;
  updated_money bigint;
begin
  select * into cycle_row
  from public.profession_cycles
  where player_id = p_player_id and status = 'active'
  order by created_at desc
  limit 1
  for update;

  if found and cycle_row.profession = 'courier' then
    select current_district into player_district from public.players where id = p_player_id for update;
    if cycle_row.delivery_district is null then
      return jsonb_build_object('error', 'У заказа не назначен район доставки. Отмени текущую смену через поддержку.');
    end if;
    if player_district is distinct from cycle_row.delivery_district then
      return jsonb_build_object('error', 'Чтобы завершить доставку, вернись в назначенный район');
    end if;
  end if;

  result_json := public.finish_profession_cycle_rpc_before_courier_district_delivery(p_player_id);
  if result_json is null or result_json ? 'error' then return result_json; end if;

  if result_json->>'profession' = 'courier' then
    reward := greatest(0, coalesce((result_json->>'cash_reward')::bigint, 0));
    target_reward := 550 + floor(random() * 121)::bigint;
    if reward < target_reward then
      bonus := target_reward - reward;
      update public.players
      set money = coalesce(money, 0) + bonus
      where id = p_player_id
      returning money into updated_money;

      result_json := result_json || jsonb_build_object(
        'cash_reward', target_reward,
        'money', updated_money,
        'courier_minimum_topup', bonus
      );
      update public.profession_cycles
      set result = result_json
      where id = cycle_row.id;
    end if;
  end if;

  return result_json;
end;
$$;

revoke all on function public.profession_state_rpc(uuid),
  public.start_profession_cycle_rpc(uuid),
  public.profession_step_rpc(uuid,smallint),
  public.finish_profession_cycle_rpc(uuid)
from public, anon, authenticated;

grant execute on function public.profession_state_rpc(uuid),
  public.start_profession_cycle_rpc(uuid),
  public.profession_step_rpc(uuid,smallint),
  public.finish_profession_cycle_rpc(uuid)
to service_role;
