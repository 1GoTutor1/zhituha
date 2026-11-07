-- Small quantity discounts for manual and automatic business restocking.
create or replace function public.business_shop_restock_discount_percent(p_quantity integer)
returns integer
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_quantity >= 500 then 5
    when p_quantity >= 250 then 4
    when p_quantity >= 100 then 2
    else 0
  end
$$;

revoke all on function public.business_shop_restock_discount_percent(integer) from public, anon, authenticated;
grant execute on function public.business_shop_restock_discount_percent(integer) to service_role;

create or replace function public.business_shop_restock_rpc(
  p_player_id uuid, p_business_id uuid, p_product_id text, p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.businesses;
  product public.business_shop_products;
  base_cost bigint;
  discount_percent integer;
  discount_amount bigint;
  cost bigint;
  new_quantity integer;
begin
  if p_quantity not between 1 and 500 then
    return jsonb_build_object('error', 'Quantity must be between 1 and 500');
  end if;

  select * into b
    from public.businesses
   where id = p_business_id and owner_id = p_player_id
   for update;
  if not found then return jsonb_build_object('error', 'Business not found'); end if;

  select * into product
    from public.business_shop_products
   where product_id = p_product_id and biz_type = b.biz_type;
  if not found then return jsonb_build_object('error', 'Product is not sold by this business type'); end if;

  base_cost := product.wholesale_price * p_quantity;
  discount_percent := public.business_shop_restock_discount_percent(p_quantity);
  discount_amount := floor(base_cost * discount_percent / 100.0)::bigint;
  cost := base_cost - discount_amount;

  if coalesce(b.cash_balance, 0) < cost then
    return jsonb_build_object('error', 'Insufficient business cash for wholesale purchase');
  end if;

  insert into public.business_shop_stock(business_id, product_id, quantity, retail_price)
  values (b.id, product.product_id, p_quantity, product.base_price)
  on conflict (business_id, product_id) do update
    set quantity = public.business_shop_stock.quantity + excluded.quantity,
        updated_at = clock_timestamp();

  update public.businesses
     set cash_balance = coalesce(cash_balance, 0) - cost
   where id = b.id;

  select quantity into new_quantity
    from public.business_shop_stock
   where business_id = b.id and product_id = product.product_id;

  return jsonb_build_object(
    'success', true,
    'cost', cost,
    'base_cost', base_cost,
    'discount_percent', discount_percent,
    'discount_amount', discount_amount,
    'quantity', new_quantity,
    'cash_balance', b.cash_balance - cost
  );
end
$$;

create or replace function public.business_autostock_tick_rpc()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  r record;
  b public.businesses;
  p public.business_shop_products;
  s public.business_shop_stock;
  base_cost bigint;
  discount_percent integer;
  discount_amount bigint;
  cost bigint;
  changed integer := 0;
begin
  for r in
    select * from public.business_autostock_rules where enabled order by business_id, product_id
  loop
    select * into b from public.businesses where id = r.business_id for update skip locked;
    if not found then continue; end if;

    select * into p from public.business_shop_products
     where product_id = r.product_id and biz_type = b.biz_type;
    if not found then continue; end if;

    select * into s from public.business_shop_stock
     where business_id = b.id and product_id = r.product_id for update;
    if not found then
      insert into public.business_shop_stock(business_id, product_id, quantity, retail_price)
      values (b.id, p.product_id, 0, p.base_price)
      on conflict (business_id, product_id) do nothing;
      select * into s from public.business_shop_stock
       where business_id = b.id and product_id = r.product_id for update;
    end if;

    if s.quantity > r.threshold then continue; end if;

    base_cost := p.wholesale_price * r.refill_quantity;
    discount_percent := public.business_shop_restock_discount_percent(r.refill_quantity);
    discount_amount := floor(base_cost * discount_percent / 100.0)::bigint;
    cost := base_cost - discount_amount;
    if coalesce(b.cash_balance, 0) < cost then continue; end if;

    insert into public.business_shop_stock(business_id, product_id, quantity, retail_price)
    values (b.id, p.product_id, r.refill_quantity, p.base_price)
    on conflict (business_id, product_id) do update
      set quantity = public.business_shop_stock.quantity + excluded.quantity,
          updated_at = clock_timestamp();

    update public.businesses
       set cash_balance = coalesce(cash_balance, 0) - cost
     where id = b.id;
    changed := changed + 1;
  end loop;

  return changed;
end
$$;

notify pgrst, 'reload schema';
