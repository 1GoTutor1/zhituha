-- Update a player's daily mission counter with one atomic write.
create or replace function public.daily_mission_add_progress(
  p_player_id uuid,
  p_mission_id text,
  p_amount integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  mission_target integer;
  today_utc date := timezone('UTC', clock_timestamp())::date;
begin
  if p_amount <= 0 then return; end if;

  mission_target := case p_mission_id
    when 'work_5' then 5
    when 'sell_1' then 1
    when 'profession_1' then 1
    else null
  end;
  if mission_target is null then return; end if;

  insert into public.player_daily_missions as existing_mission
    (player_id, mission_date, mission_id, progress, target, reward)
  values (
    p_player_id,
    today_utc,
    p_mission_id,
    least(mission_target, p_amount),
    mission_target,
    case p_mission_id when 'work_5' then 500 when 'sell_1' then 700 else 800 end
  )
  on conflict (player_id, mission_date, mission_id) do update
    set progress = least(existing_mission.target, existing_mission.progress + p_amount);
end;
$$;

notify pgrst, 'reload schema';
