-- Repair profession unlocks and allow completed action cycles to pay out immediately.
-- Safe to rerun. Apply after PROFESSIONS_INVENTORY_MIGRATION.sql.

create or replace function public.profession_sync_level(p_player_id uuid)
returns public.players
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.players;
  next_level integer;
  earned bigint;
  unlocks text[] := array[]::text[];
begin
  select * into p from public.players where id = p_player_id for update;
  if not found then return null; end if;

  next_level := greatest(1, coalesce(p.player_level, 1));
  earned := greatest(0, coalesce(p.player_xp, 0));
  while earned >= public.profession_xp_to_next(next_level) loop
    earned := earned - public.profession_xp_to_next(next_level);
    next_level := next_level + 1;
  end loop;

  if next_level >= 3 then unlocks := array_append(unlocks, 'lumberjack'); end if;
  if next_level >= 5 then unlocks := array_append(unlocks, 'fisherman'); end if;
  if next_level >= 7 then unlocks := array_append(unlocks, 'farmer'); end if;
  if next_level >= 9 then unlocks := array_append(unlocks, 'courier'); end if;
  if next_level >= 12 then unlocks := array_append(unlocks, 'taxi'); end if;

  update public.players
  set player_level = next_level,
      player_xp = earned,
      unlocked_professions = array['miner']::text[] || unlocks
  where id = p_player_id
  returning * into p;

  return p;
end;
$$;

create or replace function public.profession_step_rpc(p_player_id uuid, p_step smallint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.profession_cycles;
begin
  if p_step is null or p_step not between 1 and 3 then
    return jsonb_build_object('error', 'Недопустимый этап');
  end if;

  select * into c
  from public.profession_cycles
  where player_id = p_player_id and status = 'active'
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('error', 'Активное действие не найдено');
  end if;
  if p_step <> c.actions_done + 1 then
    return jsonb_build_object('error', 'Этап уже пройден или нарушен порядок');
  end if;

  update public.profession_cycles
  set actions_done = p_step,
      completes_at = case when p_step = 3 then clock_timestamp() else completes_at end
  where id = c.id;

  return jsonb_build_object(
    'success', true,
    'actions_done', p_step,
    'completes_at', case when p_step = 3 then clock_timestamp() else c.completes_at end
  );
end;
$$;

revoke all on function public.profession_step_rpc(uuid, smallint) from public, anon, authenticated;
grant execute on function public.profession_step_rpc(uuid, smallint) to service_role;

-- Rescue completed cycles created before the immediate-finish patch was applied.
update public.profession_cycles
set completes_at = clock_timestamp()
where status = 'active' and actions_done >= 3 and completes_at > clock_timestamp();
