-- Require energy for both the legacy work button and the new profession cycle.
-- Apply after PROFESSIONS_INVENTORY_MIGRATION.sql.

create or replace function public.start_profession_cycle_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  p public.players;
  active public.profession_cycles;
  slots integer;
  energy_cost integer;
  energy_left integer;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;

  if exists(select 1 from public.profession_cycles where player_id=p_player_id and status='completed_pending') then
    return jsonb_build_object('error','Сначала выбери, что сделать с выпавшим предметом','pending_reward',
      (select result from public.profession_cycles where player_id=p_player_id and status='completed_pending' order by created_at desc limit 1));
  end if;
  select * into active from public.profession_cycles where player_id=p_player_id and status='active'
    order by created_at desc limit 1;
  if found then
    return jsonb_build_object('error','Сначала заверши текущее действие','active_cycle',jsonb_build_object(
      'id',active.id,'profession',active.profession,'started_at',active.started_at,
      'completes_at',active.completes_at,'actions_done',active.actions_done));
  end if;
  if not p.active_profession=any(coalesce(p.unlocked_professions,array['miner']::text[])) then
    return jsonb_build_object('error','Эта профессия ещё не открыта');
  end if;
  if p.active_profession='taxi' and not exists(
    select 1 from public.business_workers w join public.businesses b on b.id=w.business_id
    where w.player_id=p_player_id and w.role='Водитель' and b.biz_type='taxi'
  ) then return jsonb_build_object('error','Нужно устроиться водителем в таксопарк'); end if;
  if p.active_profession in ('miner','lumberjack','fisherman','farmer') then
    select count(*) into slots from public.player_inventory where player_id=p_player_id and quantity>0;
    if slots>=200 then return jsonb_build_object('error','Инвентарь заполнен (200/200). Освободи слот перед работой','inventory_full',true); end if;
  end if;

  energy_cost:=case when coalesce(p.has_car,false) then 10 else 20 end;
  if coalesce(p.energy,0)<energy_cost then
    return jsonb_build_object('error','Недостаточно энергии для работы','energy',coalesce(p.energy,0),'energy_cost',energy_cost);
  end if;
  update public.players set energy=coalesce(energy,0)-energy_cost where id=p_player_id returning energy into energy_left;
  insert into public.profession_cycles(player_id,profession,completes_at)
    values(p_player_id,p.active_profession,clock_timestamp()+interval '30 seconds') returning * into active;
  return jsonb_build_object('success',true,'energy',energy_left,'energy_cost',energy_cost,
    'active_cycle',jsonb_build_object('id',active.id,'profession',active.profession,
      'started_at',active.started_at,'completes_at',active.completes_at,'actions_done',active.actions_done));
end $$;

-- Keep the legacy work implementation, but enforce energy before invoking it.
create or replace function public.work_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; p public.players; energy_cost integer;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  energy_cost:=case when coalesce(p.has_car,false) then 10 else 20 end;
  if coalesce(p.energy,0)<energy_cost then
    return jsonb_build_object('error','Недостаточно энергии','energy',coalesce(p.energy,0),'energy_cost',energy_cost);
  end if;

  result:=public.work_rpc_legacy(p_player_id);
  if result ? 'error' then return result; end if;
  update public.players set player_xp=coalesce(player_xp,0)+25 where id=p_player_id;
  p:=public.profession_sync_level(p_player_id);
  return result||jsonb_build_object('xp_gained',25,'level',p.player_level,'xp',p.player_xp,
    'xp_to_next',public.profession_xp_to_next(p.player_level),'unlocked',p.unlocked_professions);
end $$;

revoke all on function public.start_profession_cycle_rpc(uuid),public.work_rpc(uuid) from public,anon,authenticated;
grant execute on function public.start_profession_cycle_rpc(uuid),public.work_rpc(uuid) to service_role;
