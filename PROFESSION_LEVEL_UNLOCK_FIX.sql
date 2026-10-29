-- Fix profession unlock generation at levels 3, 5, 7, 9, and 12.
-- The old text[] || text expression treated a profession id as an array literal.
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
