-- Keep daily mission progress in the same transaction as the action.
-- This replaces API-side before/after state reads while preserving exact-once progress.

create or replace function public.work_rpc(p_player_id uuid)
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
  result_json := public.work_rpc_before_coffee_bonus(p_player_id);
  if result_json ? 'error'
    or coalesce((result_json->>'captcha_required')::boolean, false)
    or coalesce((result_json->>'ignored')::boolean, false)
    or coalesce((result_json->>'blocked')::boolean, false)
    or result_json->>'work_pay' is null then
    return result_json;
  end if;

  perform public.daily_mission_add_progress(p_player_id, 'work_5', 1);

  if not exists (
    select 1 from public.players
    where id = p_player_id and coffee_bonus_until > clock_timestamp()
  ) then
    return result_json;
  end if;

  bonus := floor(coalesce((result_json->>'work_pay')::bigint, 0) * 0.10)::bigint;
  if bonus <= 0 then return result_json; end if;
  update public.players
  set money = coalesce(money, 0) + bonus
  where id = p_player_id
  returning money into new_money;
  return result_json || jsonb_build_object(
    'work_pay', coalesce((result_json->>'work_pay')::bigint, 0) + bonus,
    'money', new_money,
    'coffee_bonus_paid', bonus
  );
end;
$$;

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
  if result ? 'error' then return result; end if;

  perform public.daily_mission_add_progress(p_player_id, 'profession_1', 1);
  perform public.daily_mission_add_progress(p_player_id, 'work_5', 1);

  select * into p from public.players where id = p_player_id;
  return result || jsonb_build_object('personal_car_health', coalesce(p.car_health, 100));
end;
$$;

notify pgrst, 'reload schema';
