-- Return a clear validation result instead of leaking the businesses table's
-- unique(owner_id, biz_type) violation as a generic RPC failure.

do $$
begin
  if to_regprocedure('public.purchase_business_location_rpc_before_duplicate_type_guard(uuid,text)') is null then
    alter function public.purchase_business_location_rpc(uuid, text)
      rename to purchase_business_location_rpc_before_duplicate_type_guard;
  end if;
  if to_regprocedure('public.start_business_lease_rpc_before_duplicate_type_guard(uuid,text)') is null then
    alter function public.start_business_lease_rpc(uuid, text)
      rename to start_business_lease_rpc_before_duplicate_type_guard;
  end if;
end
$$;

create or replace function public.purchase_business_location_rpc(p_player_id uuid, p_location_key text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  requested_type text;
begin
  -- Serialize purchases for one player before checking the one-per-type rule.
  perform 1 from public.players where id = p_player_id for update;
  if not found then
    return public.purchase_business_location_rpc_before_duplicate_type_guard(p_player_id, p_location_key);
  end if;

  select biz_type into requested_type
    from public.business_locations
   where location_key = p_location_key;
  if requested_type is not null and exists (
    select 1 from public.businesses
     where owner_id = p_player_id and biz_type = requested_type
  ) then
    return jsonb_build_object('error', 'У тебя уже есть такой бизнес. Можно владеть только одним бизнесом каждого типа.');
  end if;

  return public.purchase_business_location_rpc_before_duplicate_type_guard(p_player_id, p_location_key);
end
$$;

create or replace function public.start_business_lease_rpc(p_player_id uuid, p_location_key text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  requested_type text;
begin
  perform 1 from public.players where id = p_player_id for update;
  if not found then
    return public.start_business_lease_rpc_before_duplicate_type_guard(p_player_id, p_location_key);
  end if;

  select biz_type into requested_type
    from public.business_locations
   where location_key = p_location_key;
  if requested_type is not null and exists (
    select 1 from public.businesses
     where owner_id = p_player_id and biz_type = requested_type
  ) then
    return jsonb_build_object('error', 'У тебя уже есть такой бизнес. Можно владеть только одним бизнесом каждого типа.');
  end if;

  return public.start_business_lease_rpc_before_duplicate_type_guard(p_player_id, p_location_key);
end
$$;

revoke all on function public.purchase_business_location_rpc(uuid, text) from public, anon, authenticated;
revoke all on function public.purchase_business_location_rpc_before_duplicate_type_guard(uuid, text) from public, anon, authenticated;
revoke all on function public.start_business_lease_rpc(uuid, text) from public, anon, authenticated;
revoke all on function public.start_business_lease_rpc_before_duplicate_type_guard(uuid, text) from public, anon, authenticated;
grant execute on function public.purchase_business_location_rpc(uuid, text) to service_role;
grant execute on function public.purchase_business_location_rpc_before_duplicate_type_guard(uuid, text) to service_role;
grant execute on function public.start_business_lease_rpc(uuid, text) to service_role;
grant execute on function public.start_business_lease_rpc_before_duplicate_type_guard(uuid, text) to service_role;

notify pgrst, 'reload schema';
