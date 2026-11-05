-- Adds district metadata to shop rows returned by business_shop_state_rpc.
-- Apply after BUSINESS_LOCATIONS_MIGRATION.sql and BUSINESS_COMMERCE_MIGRATION.sql.
-- This migration does not change district travel, energy, inventory, or prices.

do $$
begin
  if to_regprocedure('public.business_shop_state_rpc_before_store_district_fix(uuid)') is null then
    if to_regprocedure('public.business_shop_state_rpc(uuid)') is null then
      raise exception 'business_shop_state_rpc is missing; apply BUSINESS_COMMERCE_MIGRATION.sql first';
    end if;
    execute 'alter function public.business_shop_state_rpc(uuid) rename to business_shop_state_rpc_before_store_district_fix';
  end if;
end;
$$;

create or replace function public.business_shop_state_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  result jsonb;
  shops jsonb;
begin
  result := public.business_shop_state_rpc_before_store_district_fix(p_player_id);

  select coalesce(jsonb_agg(
    shop || jsonb_build_object(
      'district', coalesce(to_jsonb(bl)->>'district', case bl.location_key
        when 'coffee_01' then 'center'
        when 'coffee_02' then 'center'
        when 'salon_high' then 'center'
        when 'taxi_yandex' then 'center'
        when 'minimarket_01' then 'center'
        when 'repair_01' then 'center'
        when 'casino_01' then 'center'
        when 'coffee_03' then 'residential'
        when 'coffee_04' then 'residential'
        when 'salon_low' then 'residential'
        when 'taxi_maxim' then 'residential'
        when 'minimarket_02' then 'residential'
        when 'minimarket_03' then 'residential'
        when 'repair_02' then 'residential'
        when 'minimarket_05' then 'residential'
        when 'coffee_05' then 'factory'
        when 'coffee_06' then 'factory'
        when 'salon_mid' then 'factory'
        when 'taxi_uber' then 'factory'
        when 'construction_01' then 'factory'
        when 'construction_02' then 'factory'
        when 'minimarket_04' then 'factory'
        when 'coffee_07' then 'factory'
        else 'center'
      end),
      'district_name', case coalesce(to_jsonb(bl)->>'district', case bl.location_key
        when 'coffee_03' then 'residential'
        when 'coffee_04' then 'residential'
        when 'salon_low' then 'residential'
        when 'taxi_maxim' then 'residential'
        when 'minimarket_02' then 'residential'
        when 'minimarket_03' then 'residential'
        when 'repair_02' then 'residential'
        when 'minimarket_05' then 'residential'
        when 'coffee_05' then 'factory'
        when 'coffee_06' then 'factory'
        when 'salon_mid' then 'factory'
        when 'taxi_uber' then 'factory'
        when 'construction_01' then 'factory'
        when 'construction_02' then 'factory'
        when 'minimarket_04' then 'factory'
        when 'coffee_07' then 'factory'
        else 'center'
      end)
        when 'residential' then 'Спальный район'
        when 'factory' then 'Заводской район'
        else 'Центр'
      end
    ) order by ordinality
  ), '[]'::jsonb)
  into shops
  from jsonb_array_elements(coalesce(result->'shops', '[]'::jsonb))
    with ordinality as shop_rows(shop, ordinality)
  left join public.business_locations bl
    on bl.business_id = nullif(shop->>'business_id', '')::uuid;

  return jsonb_set(coalesce(result, '{}'::jsonb), '{shops}', shops, true);
end;
$$;

revoke all on function public.business_shop_state_rpc(uuid)
  from public, anon, authenticated;
grant execute on function public.business_shop_state_rpc(uuid) to service_role;

notify pgrst, 'reload schema';
