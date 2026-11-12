-- Install and start every inventory rig that fits the mining site and has
-- enough balance reserved for its first 12 hours of electricity.
create or replace function public.mining_install_all_rigs_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_player public.players;
  v_rig public.player_mining_rigs;
  v_site_slots integer;
  v_used_slots integer := 0;
  v_slot_cost integer;
  v_power_cost bigint;
  v_reserved_power bigint := 0;
  v_installed_count integer := 0;
  v_skipped_space integer := 0;
  v_skipped_funds integer := 0;
  v_skipped_gpu integer := 0;
  v_now timestamptz := clock_timestamp();
  v_settlement jsonb;
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

  insert into public.player_mining_accounts(player_id)
  values (p_player_id)
  on conflict (player_id) do nothing;

  select site_slots into v_site_slots
  from public.player_mining_accounts
  where player_id = p_player_id
  for update;

  -- Settle existing rigs before calculating the available balance.
  v_settlement := public.mining_settle_player(p_player_id);
  if v_settlement ? 'error' then
    return v_settlement;
  end if;
  select * into v_player from public.players where id = p_player_id;

  select coalesce(sum(case when rig_type = 'industrial' then 4 else 1 end), 0)::integer
  into v_used_slots
  from public.player_mining_rigs
  where player_id = p_player_id and installed;

  for v_rig in
    select * from public.player_mining_rigs
    where player_id = p_player_id and not installed
    order by created_at, id
    for update
  loop
    if v_rig.rig_type = 'gpu_farm' and v_rig.gpu_count < 1 then
      v_skipped_gpu := v_skipped_gpu + 1;
      continue;
    end if;

    v_slot_cost := case when v_rig.rig_type = 'industrial' then 4 else 1 end;
    if v_used_slots + v_slot_cost > coalesce(v_site_slots, 1) then
      v_skipped_space := v_skipped_space + 1;
      continue;
    end if;

    v_power_cost := case v_rig.rig_type
      when 'gpu_farm' then ceil(v_rig.gpu_count * 750)::bigint
      when 'asic' then 5000::bigint
      else 18000::bigint
    end;
    if v_reserved_power + v_power_cost > coalesce(v_player.money, 0) then
      v_skipped_funds := v_skipped_funds + 1;
      continue;
    end if;

    update public.player_mining_rigs
    set installed = true,
        is_running = true,
        last_settled_at = v_now
    where id = v_rig.id and player_id = p_player_id and not installed;

    if found then
      v_installed_count := v_installed_count + 1;
      v_used_slots := v_used_slots + v_slot_cost;
      v_reserved_power := v_reserved_power + v_power_cost;
    end if;
  end loop;

  return public.mining_state_rpc(p_player_id)
    || jsonb_build_object(
      'installed_count', v_installed_count,
      'skipped_no_space', v_skipped_space,
      'skipped_no_funds', v_skipped_funds,
      'skipped_no_gpu', v_skipped_gpu,
      'electricity_reserved', v_reserved_power
    );
end;
$$;

revoke all on function public.mining_install_all_rigs_rpc(uuid) from public, anon, authenticated;
grant execute on function public.mining_install_all_rigs_rpc(uuid) to service_role;

notify pgrst, 'reload schema';
