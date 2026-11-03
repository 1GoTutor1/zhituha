-- Apply after DISTRICTS_ENERGY_MIGRATION.sql.
-- Coffee is consumed on purchase: it restores energy and keeps the existing
-- +10% profession-income timer. Non-coffee shop products do not restore energy.

update public.business_shop_products
set energy_restore = case product_id
      when 'coffee_small' then 10
      when 'coffee_medium' then 25
      when 'coffee_large' then 40
      else 0
    end,
    updated_at = clock_timestamp()
where product_id in (
  'coffee_small','coffee_medium','coffee_large',
  'market_snack','market_lunch','market_energy'
);

-- Remove the old free-rest path. Energy now comes back through coffee only.
create or replace function public.district_rest_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  return jsonb_build_object('error','Энергия восстанавливается после покупки кофе в кофейне');
end;
$$;

revoke all on function public.district_rest_rpc(uuid) from public, anon, authenticated;
grant execute on function public.district_rest_rpc(uuid) to service_role;

notify pgrst, 'reload schema';
