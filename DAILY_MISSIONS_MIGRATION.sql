-- Daily goals with server-owned progress and once-per-task claiming.
create table if not exists public.player_daily_missions (
  player_id uuid not null references public.players(id) on delete cascade,
  mission_date date not null,
  mission_id text not null,
  progress integer not null default 0,
  target integer not null,
  reward bigint not null,
  claimed_at timestamptz,
  primary key(player_id,mission_date,mission_id)
);
alter table public.player_daily_missions enable row level security;
revoke all on public.player_daily_missions from public,anon,authenticated;
grant all on public.player_daily_missions to service_role;

create or replace function public.daily_mission_add_progress(p_player_id uuid,p_mission_id text,p_amount integer)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare mission_target integer; today_utc date:=timezone('UTC',clock_timestamp())::date;
begin
  if p_amount<=0 then return; end if;
  mission_target:=case p_mission_id when 'work_5' then 5 when 'sell_1' then 1 when 'profession_1' then 1 else null end;
  if mission_target is null then return; end if;
  insert into public.player_daily_missions(player_id,mission_date,mission_id,target,reward)
    values (p_player_id,today_utc,p_mission_id,mission_target,
      case p_mission_id when 'work_5' then 500 when 'sell_1' then 700 else 800 end)
    on conflict do nothing;
  update public.player_daily_missions set progress=least(target,progress+p_amount)
  where player_id=p_player_id and mission_date=today_utc and mission_id=p_mission_id;
end $$;

create or replace function public.daily_missions_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare today_utc date:=timezone('UTC',clock_timestamp())::date;
begin
  if not exists(select 1 from public.players where id=p_player_id) then
    return jsonb_build_object('error','Игрок не найден');
  end if;
  insert into public.player_daily_missions(player_id,mission_date,mission_id,target,reward) values
    (p_player_id,today_utc,'work_5',5,500),
    (p_player_id,today_utc,'sell_1',1,700),
    (p_player_id,today_utc,'profession_1',1,800)
  on conflict do nothing;
  return jsonb_build_object('date',today_utc,'missions',coalesce((
    select jsonb_agg(jsonb_build_object('id',mission_id,'progress',progress,'target',target,
      'reward',reward,'claimed',claimed_at is not null)
      order by case mission_id when 'work_5' then 1 when 'sell_1' then 2 else 3 end)
    from public.player_daily_missions where player_id=p_player_id and mission_date=today_utc
  ),'[]'::jsonb));
end $$;

create or replace function public.daily_mission_claim_rpc(p_player_id uuid,p_mission_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare today_utc date:=timezone('UTC',clock_timestamp())::date; m public.player_daily_missions; new_money bigint;
begin
  select * into m from public.player_daily_missions
    where player_id=p_player_id and mission_date=today_utc and mission_id=p_mission_id for update;
  if not found then return jsonb_build_object('error','Задание не найдено'); end if;
  if m.progress<m.target then return jsonb_build_object('error','Сначала выполни задание'); end if;
  if m.claimed_at is not null then return jsonb_build_object('error','Награда уже получена'); end if;
  update public.player_daily_missions set claimed_at=clock_timestamp()
    where player_id=p_player_id and mission_date=today_utc and mission_id=p_mission_id;
  update public.players set money=coalesce(money,0)+m.reward where id=p_player_id returning money into new_money;
  perform public.log_action_rpc(p_player_id,'daily_mission_reward',
    jsonb_build_object('mission',p_mission_id,'reward',m.reward),m.reward::integer,new_money::integer);
  return jsonb_build_object('success',true,'reward',m.reward,'money',new_money);
end $$;

-- Wrap the current economy RPCs so progress cannot be forged by the client.
do $$ begin
  if to_regprocedure('public.work_rpc_before_daily_missions(uuid)') is null then
    execute 'alter function public.work_rpc(uuid) rename to work_rpc_before_daily_missions';
  end if;
end $$;
create or replace function public.work_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb;
begin
  result_json:=public.work_rpc_before_daily_missions(p_player_id);
  if result_json ? 'error' or coalesce((result_json->>'captcha_required')::boolean,false)
    or coalesce((result_json->>'ignored')::boolean,false) or result_json ? 'blocked' then return result_json; end if;
  perform public.daily_mission_add_progress(p_player_id,'work_5',1);
  return result_json;
end $$;

do $$ begin
  if to_regprocedure('public.sell_inventory_rpc_before_daily_missions(uuid,text,integer)') is null then
    execute 'alter function public.sell_inventory_rpc(uuid,text,integer) rename to sell_inventory_rpc_before_daily_missions';
  end if;
end $$;
create or replace function public.sell_inventory_rpc(p_player_id uuid,p_item_id text,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb;
begin
  result_json:=public.sell_inventory_rpc_before_daily_missions(p_player_id,p_item_id,p_quantity);
  if not (result_json ? 'error') and coalesce((result_json->>'success')::boolean,false) then
    perform public.daily_mission_add_progress(p_player_id,'sell_1',1);
  end if;
  return result_json;
end $$;

do $$ begin
  if to_regprocedure('public.finish_profession_cycle_rpc_before_daily_missions(uuid)') is null then
    execute 'alter function public.finish_profession_cycle_rpc(uuid) rename to finish_profession_cycle_rpc_before_daily_missions';
  end if;
end $$;
create or replace function public.finish_profession_cycle_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb;
begin
  result_json:=public.finish_profession_cycle_rpc_before_daily_missions(p_player_id);
  if not (result_json ? 'error') then
    perform public.daily_mission_add_progress(p_player_id,'profession_1',1);
  end if;
  return result_json;
end $$;

revoke all on function public.daily_mission_add_progress(uuid,text,integer),
  public.daily_missions_state_rpc(uuid),public.daily_mission_claim_rpc(uuid,text),
  public.work_rpc_before_daily_missions(uuid),public.sell_inventory_rpc_before_daily_missions(uuid,text,integer),
  public.finish_profession_cycle_rpc_before_daily_missions(uuid),public.work_rpc(uuid),
  public.sell_inventory_rpc(uuid,text,integer),public.finish_profession_cycle_rpc(uuid)
  from public,anon,authenticated;
grant execute on function public.daily_missions_state_rpc(uuid),public.daily_mission_claim_rpc(uuid,text),
  public.work_rpc(uuid),public.sell_inventory_rpc(uuid,text,integer),public.finish_profession_cycle_rpc(uuid)
  to service_role;
notify pgrst,'reload schema';
