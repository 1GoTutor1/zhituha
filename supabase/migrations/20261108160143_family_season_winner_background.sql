-- Give every member present at season close the winner-family profile background.
-- The existing family_member_awards rows remain the medal entitlement: those
-- rows are only created for players with at least 20 profession points.

create or replace function public.award_family_winner_background()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if old.finalized_at is not null or new.finalized_at is null then
    return new;
  end if;

  update public.players p
  set owned_cosmetics = case
    when 'background_family_timenewromans' = any(coalesce(p.owned_cosmetics, '{}'::text[]))
      then coalesce(p.owned_cosmetics, '{}'::text[])
    else array_append(coalesce(p.owned_cosmetics, '{}'::text[]), 'background_family_timenewromans')
  end
  where exists (
    select 1
    from public.family_season_results r
    join public.family_memberships m on m.family_id = r.family_id
    where r.season_no = new.season_no
      and r.place = 1
      and m.player_id = p.id
      and m.joined_at < new.ends_at
      and (m.left_at is null or m.left_at >= new.ends_at)
  );

  return new;
end;
$$;

revoke all on function public.award_family_winner_background() from public, anon, authenticated;

drop trigger if exists family_season_winner_background on public.family_seasons;
create trigger family_season_winner_background
after update of finalized_at on public.family_seasons
for each row
when (old.finalized_at is null and new.finalized_at is not null)
execute function public.award_family_winner_background();

-- Let the winner-family background be equipped from the existing cosmetics UI.
create or replace function public.donation_equip_rpc(p_player_id uuid, p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  p public.players;
begin
  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;

  if p_item_id = 'default' then
    update public.players set profile_frame = '', profile_background = ''
    where id = p_player_id returning * into p;
  elsif p_item_id in ('frame_test', 'frame_amber', 'frame_route')
    and p_item_id = any(coalesce(p.owned_cosmetics, '{}'::text[])) then
    update public.players set profile_frame = p_item_id
    where id = p_player_id returning * into p;
  elsif p_item_id in (
      'background_concrete', 'background_brick', 'background_panelka',
      'background_night_route', 'background_family_timenewromans'
    ) and p_item_id = any(coalesce(p.owned_cosmetics, '{}'::text[])) then
    update public.players set profile_background = p_item_id
    where id = p_player_id returning * into p;
  else
    return jsonb_build_object('error', 'Сначала получи эту косметику');
  end if;

  return jsonb_build_object('success', true, 'player', jsonb_build_object(
    'profile_frame', p.profile_frame,
    'profile_background', p.profile_background,
    'owned_cosmetics', p.owned_cosmetics
  ));
end;
$$;
