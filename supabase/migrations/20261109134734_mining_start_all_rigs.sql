-- Start every installed, currently stopped mining rig in one atomic action.
create or replace function public.mining_turn_on_all_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_player public.players;
  v_required_balance bigint;
  v_started_count integer := 0;
begin
  select * into v_player
  from public.players
  where id = p_player_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Игрок не найден');
  end if;
  if coalesce(v_player.is_banned, false) then
    return jsonb_build_object('error', 'Аккаунт заблокирован');
  end if;
  if coalesce(v_player.player_level, 1) < 10 then
    return jsonb_build_object('error', 'Майнинг откроется с 10 уровня');
  end if;

  select coalesce(sum(
    case rig_type
      when 'gpu_farm' then ceil(gpu_count * 750)::bigint
      when 'asic' then 5000::bigint
      when 'industrial' then 18000::bigint
    end
  ), 0)::bigint
  into v_required_balance
  from public.player_mining_rigs
  where player_id = p_player_id
    and installed
    and not is_running
    and (rig_type <> 'gpu_farm' or gpu_count > 0);

  if v_required_balance = 0 then
    return public.mining_state_rpc(p_player_id) || jsonb_build_object('started_count', 0);
  end if;
  if coalesce(v_player.money, 0) < v_required_balance then
    return jsonb_build_object('error', 'Не хватит ₽ даже на 12 часов электричества для всех установок');
  end if;

  update public.player_mining_rigs
  set is_running = true,
      last_settled_at = clock_timestamp()
  where player_id = p_player_id
    and installed
    and not is_running
    and (rig_type <> 'gpu_farm' or gpu_count > 0);
  get diagnostics v_started_count = row_count;

  return public.mining_state_rpc(p_player_id)
    || jsonb_build_object('started_count', v_started_count);
end;
$$;

revoke all on function public.mining_turn_on_all_rpc(uuid) from public, anon, authenticated;
grant execute on function public.mining_turn_on_all_rpc(uuid) to service_role;

notify pgrst, 'reload schema';
