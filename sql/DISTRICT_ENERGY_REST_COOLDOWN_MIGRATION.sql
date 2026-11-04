-- Run after DISTRICTS_ENERGY_MIGRATION.sql and DISTRICT_COFFEE_ENERGY_FIX.sql.
-- Adds a server-enforced +20 energy recovery once every 90 seconds.

alter table public.players
  add column if not exists district_energy_rest_at timestamptz;

create or replace function public.district_rest_state_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  p public.players;
  ready_at timestamptz;
  energy_cap integer;
begin
  select * into p
  from public.players
  where id = p_player_id;

  if not found then
    return jsonb_build_object('error', 'Игрок не найден');
  end if;

  ready_at := coalesce(p.district_energy_rest_at + interval '90 seconds', clock_timestamp());
  energy_cap := case when coalesce(p.has_house, false) then 150 else 100 end;

  return jsonb_build_object(
    'energy', coalesce(p.energy, 0),
    'max_energy', energy_cap,
    'available_at', ready_at,
    'cooldown_seconds', greatest(0, ceil(extract(epoch from (ready_at - clock_timestamp())))::integer)
  );
end;
$$;

create or replace function public.district_rest_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  p public.players;
  ready_at timestamptz;
  energy_cap integer;
  restored integer;
begin
  select * into p
  from public.players
  where id = p_player_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Игрок не найден');
  end if;

  ready_at := coalesce(p.district_energy_rest_at + interval '90 seconds', clock_timestamp());
  if ready_at > clock_timestamp() then
    return jsonb_build_object(
      'error', 'Подожди перед следующим восстановлением энергии',
      'available_at', ready_at,
      'cooldown_seconds', ceil(extract(epoch from (ready_at - clock_timestamp())))::integer
    );
  end if;

  energy_cap := case when coalesce(p.has_house, false) then 150 else 100 end;
  restored := least(20, energy_cap - coalesce(p.energy, 0));
  if restored <= 0 then
    return jsonb_build_object('error', 'Энергия уже полная', 'energy', coalesce(p.energy, 0));
  end if;

  update public.players
  set energy = coalesce(energy, 0) + restored,
      district_energy_rest_at = clock_timestamp()
  where id = p_player_id
  returning district_energy_rest_at into ready_at;

  return jsonb_build_object(
    'success', true,
    'energy', coalesce(p.energy, 0) + restored,
    'energy_restored', restored,
    'available_at', ready_at + interval '90 seconds'
  );
end;
$$;

revoke all on function public.district_rest_state_rpc(uuid) from public, anon, authenticated;
revoke all on function public.district_rest_rpc(uuid) from public, anon, authenticated;
grant execute on function public.district_rest_state_rpc(uuid) to service_role;
grant execute on function public.district_rest_rpc(uuid) to service_role;

notify pgrst, 'reload schema';
