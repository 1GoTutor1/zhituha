-- Profession cycles are completed by player actions, not by a 30-second timer.
-- The existing finish RPC still validates all rewards and taxi/car state.
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
