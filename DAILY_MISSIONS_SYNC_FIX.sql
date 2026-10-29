-- Apply this after the other game migrations. Keeps daily quest progress wired
-- to whichever work/sell/profession RPC versions are currently installed.

create or replace function public.daily_mission_add_progress(p_player_id uuid,p_mission_id text,p_amount integer)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare mission_target integer; today_utc date:=timezone('UTC',clock_timestamp())::date;
begin
  if p_amount<=0 then return; end if;
  mission_target:=case p_mission_id when 'work_5' then 5 when 'sell_1' then 1 when 'profession_1' then 1 else null end;
  if mission_target is null then return; end if;
  insert into public.player_daily_missions(player_id,mission_date,mission_id,target,reward)
    values(p_player_id,today_utc,p_mission_id,mission_target,
      case p_mission_id when 'work_5' then 500 when 'sell_1' then 700 else 800 end)
    on conflict do nothing;
  update public.player_daily_missions set progress=least(target,progress+p_amount)
    where player_id=p_player_id and mission_date=today_utc and mission_id=p_mission_id;
end $$;

do $$ begin
  if to_regprocedure('public.work_rpc_before_daily_missions_sync_fix(uuid)') is null then
    execute 'alter function public.work_rpc(uuid) rename to work_rpc_before_daily_missions_sync_fix';
  end if;
end $$;
create or replace function public.work_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb; before_progress integer:=0; after_progress integer:=0;
        today_utc date:=timezone('UTC',clock_timestamp())::date;
begin
  select progress into before_progress from public.player_daily_missions
    where player_id=p_player_id and mission_date=today_utc and mission_id='work_5';
  result_json:=public.work_rpc_before_daily_missions_sync_fix(p_player_id);
  if result_json ? 'error' or coalesce((result_json->>'captcha_required')::boolean,false)
    or coalesce((result_json->>'ignored')::boolean,false) or coalesce((result_json->>'blocked')::boolean,false) then
    return result_json;
  end if;
  select progress into after_progress from public.player_daily_missions
    where player_id=p_player_id and mission_date=today_utc and mission_id='work_5';
  if coalesce(after_progress,0)<=coalesce(before_progress,0) then
    perform public.daily_mission_add_progress(p_player_id,'work_5',1);
  end if;
  return result_json;
end $$;

do $$ begin
  if to_regprocedure('public.sell_inventory_rpc_before_daily_missions_sync_fix(uuid,text,integer)') is null then
    execute 'alter function public.sell_inventory_rpc(uuid,text,integer) rename to sell_inventory_rpc_before_daily_missions_sync_fix';
  end if;
end $$;
create or replace function public.sell_inventory_rpc(p_player_id uuid,p_item_id text,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb; before_progress integer:=0; after_progress integer:=0;
        today_utc date:=timezone('UTC',clock_timestamp())::date;
begin
  select progress into before_progress from public.player_daily_missions
    where player_id=p_player_id and mission_date=today_utc and mission_id='sell_1';
  result_json:=public.sell_inventory_rpc_before_daily_missions_sync_fix(p_player_id,p_item_id,p_quantity);
  if result_json ? 'error' or not coalesce((result_json->>'success')::boolean,false) then return result_json; end if;
  select progress into after_progress from public.player_daily_missions
    where player_id=p_player_id and mission_date=today_utc and mission_id='sell_1';
  if coalesce(after_progress,0)<=coalesce(before_progress,0) then
    perform public.daily_mission_add_progress(p_player_id,'sell_1',1);
  end if;
  return result_json;
end $$;

do $$ begin
  if to_regprocedure('public.finish_profession_cycle_rpc_before_daily_missions_sync_fix(uuid)') is null then
    execute 'alter function public.finish_profession_cycle_rpc(uuid) rename to finish_profession_cycle_rpc_before_daily_missions_sync_fix';
  end if;
end $$;
create or replace function public.finish_profession_cycle_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb; before_progress integer:=0; after_progress integer:=0;
        today_utc date:=timezone('UTC',clock_timestamp())::date;
begin
  select progress into before_progress from public.player_daily_missions
    where player_id=p_player_id and mission_date=today_utc and mission_id='profession_1';
  result_json:=public.finish_profession_cycle_rpc_before_daily_missions_sync_fix(p_player_id);
  if result_json ? 'error' then return result_json; end if;
  select progress into after_progress from public.player_daily_missions
    where player_id=p_player_id and mission_date=today_utc and mission_id='profession_1';
  if coalesce(after_progress,0)<=coalesce(before_progress,0) then
    perform public.daily_mission_add_progress(p_player_id,'profession_1',1);
  end if;
  return result_json;
end $$;

revoke all on function public.daily_mission_add_progress(uuid,text,integer),
  public.work_rpc_before_daily_missions_sync_fix(uuid),
  public.sell_inventory_rpc_before_daily_missions_sync_fix(uuid,text,integer),
  public.finish_profession_cycle_rpc_before_daily_missions_sync_fix(uuid),
  public.work_rpc(uuid),public.sell_inventory_rpc(uuid,text,integer),
  public.finish_profession_cycle_rpc(uuid) from public,anon,authenticated;
grant execute on function public.work_rpc(uuid),public.sell_inventory_rpc(uuid,text,integer),
  public.finish_profession_cycle_rpc(uuid) to service_role;
notify pgrst,'reload schema';
