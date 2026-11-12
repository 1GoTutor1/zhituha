-- Capture qualifying numbers lazily at the first post-season mutation/read.
-- This avoids a polling worker while preserving holdings before any sale/change.
alter table public.season_pass_seasons
  add column if not exists number_collection_finalized_at timestamptz;

drop trigger if exists players_archive_forever_current_plate on public.players;
drop trigger if exists player_car_numbers_archive_forever on public.player_car_numbers;
delete from public.player_forever_car_numbers;

create index if not exists player_car_numbers_legendary_idx
  on public.player_car_numbers(player_id) where estimated_value >= 30000;
create index if not exists players_current_car_plate_snapshot_idx
  on public.players(id,car_plate) where has_car is true and car_plate is not null;

create or replace function public.number_case_finalize_expired_seasons()
returns integer language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare old_season record; finalized_count integer:=0; finalized_at timestamptz;
begin
  for old_season in
    select season_no from public.season_pass_seasons
    where ends_at <= clock_timestamp() and number_collection_finalized_at is null
    order by season_no for update
  loop
    insert into public.player_forever_car_numbers(plate,player_id,estimated_value,earned_at)
    select n.plate,n.player_id,n.estimated_value,n.created_at
    from public.player_car_numbers n where n.estimated_value >= 30000
    on conflict(plate) do nothing;

    insert into public.player_forever_car_numbers(plate,player_id,estimated_value)
    select p.car_plate,p.id,public.car_plate_value(p.car_plate)
    from public.players p
    where p.has_car is true and p.car_plate is not null and public.car_plate_value(p.car_plate) >= 30000
    on conflict(plate) do nothing;

    finalized_at:=clock_timestamp();
    update public.season_pass_seasons
      set number_collection_finalized_at=finalized_at
      where season_no=old_season.season_no;
    finalized_count:=finalized_count+1;
  end loop;
  return finalized_count;
end;
$$;

create or replace function public.number_case_finalize_before_number_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  perform public.number_case_finalize_expired_seasons();
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists player_car_numbers_finalize_season_before_change on public.player_car_numbers;
create trigger player_car_numbers_finalize_season_before_change
before insert or update or delete on public.player_car_numbers
for each row execute function public.number_case_finalize_before_number_change();

drop trigger if exists players_finalize_season_before_car_change on public.players;
create trigger players_finalize_season_before_car_change
before update of car_plate,has_car on public.players
for each row execute function public.number_case_finalize_before_number_change();

revoke all on function public.number_case_finalize_expired_seasons(),
  public.number_case_finalize_before_number_change() from public,anon,authenticated;
grant execute on function public.number_case_finalize_expired_seasons() to service_role;
notify pgrst,'reload schema';
