-- Allow collectible phone and vehicle numbers to be traded on the player market.
-- Prices are listed in market_items; the JSON payload preserves the number's state estimate.

create or replace function public.list_number_market_lot_rpc(
  p_seller_id uuid,
  p_number_type text,
  p_number_id uuid,
  p_price integer,
  p_bonus_slots integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  seller public.players;
  phone_row public.player_phone_numbers;
  car_row public.player_car_numbers;
  listing_payload jsonb;
  used_slots integer;
  max_slots integer;
  new_lot_id uuid;
begin
  if p_number_type not in ('phone_number', 'car_number') then
    return jsonb_build_object('error', 'Unsupported number type');
  end if;
  if p_price is null or p_price < 1 or p_price > 100000000 then
    return jsonb_build_object('error', 'Price must be between 1 and 100000000');
  end if;
  if coalesce(p_bonus_slots, 0) not between 0 and 2 then
    return jsonb_build_object('error', 'Invalid bonus market slots');
  end if;

  select * into seller from public.players where id = p_seller_id for update;
  if not found then return jsonb_build_object('error', 'Seller not found'); end if;

  select count(*) into used_slots from public.market_items where seller_id = p_seller_id;
  max_slots := coalesce(seller.market_slots, 3) + coalesce(p_bonus_slots, 0);
  if used_slots >= max_slots then return jsonb_build_object('error', 'No free market slots'); end if;

  if p_number_type = 'phone_number' then
    select * into phone_row from public.player_phone_numbers
      where id = p_number_id and player_id = p_seller_id for update;
    if not found then return jsonb_build_object('error', 'Phone number not in your collection'); end if;
    if phone_row.is_active then return jsonb_build_object('error', 'Deactivate this phone number before listing it'); end if;
    listing_payload := jsonb_build_object('number', phone_row.phone_number, 'estimated_value', phone_row.estimated_value);
    delete from public.player_phone_numbers where id = phone_row.id;
  else
    select * into car_row from public.player_car_numbers
      where id = p_number_id and player_id = p_seller_id for update;
    if not found then return jsonb_build_object('error', 'Car number not in your collection'); end if;
    listing_payload := jsonb_build_object('number', car_row.plate, 'estimated_value', car_row.estimated_value);
    delete from public.player_car_numbers where id = car_row.id;
  end if;

  insert into public.market_items(seller_id, seller_name, item_type, item_data, price, source_business_id)
  values (p_seller_id, seller.nickname, p_number_type, listing_payload::text, p_price, null)
  returning id into new_lot_id;

  return jsonb_build_object('success', true, 'item_id', new_lot_id, 'price', p_price);
end;
$$;

create or replace function public.buy_number_market_lot_rpc(p_buyer_id uuid, p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  listing public.market_items;
  buyer public.players;
  seller_premium boolean := false;
  commission_percent integer := 5;
  commission_amount integer;
  income_tax integer;
  seller_proceeds integer;
  listing_payload jsonb;
  number_value text;
  estimated_value bigint;
  updated_money integer;
begin
  select * into listing from public.market_items
    where id = p_item_id and item_type in ('phone_number', 'car_number') for update;
  if not found then return jsonb_build_object('error', 'Number listing not found'); end if;
  if listing.seller_id = p_buyer_id then return jsonb_build_object('error', 'You cannot buy your own listing'); end if;

  perform p.id from public.players p
    where p.id in (p_buyer_id, listing.seller_id)
    order by p.id for update;
  select * into buyer from public.players where id = p_buyer_id;
  if not found then return jsonb_build_object('error', 'Buyer not found'); end if;
  if coalesce(buyer.money, 0) < listing.price then return jsonb_build_object('error', 'Not enough money'); end if;

  begin
    listing_payload := listing.item_data::jsonb;
    number_value := listing_payload ->> 'number';
    estimated_value := (listing_payload ->> 'estimated_value')::bigint;
  exception when others then
    return jsonb_build_object('error', 'Invalid number listing data');
  end;
  if nullif(number_value, '') is null or coalesce(estimated_value, 0) < 1 then
    return jsonb_build_object('error', 'Invalid number listing data');
  end if;

  select coalesce(premium_until > statement_timestamp(), false) into seller_premium
    from public.players where id = listing.seller_id;
  if seller_premium or mod(timezone('Europe/Moscow', statement_timestamp())::date - date '1970-01-01', 7) = 6 then
    commission_percent := 0;
  end if;
  commission_amount := floor(listing.price * commission_percent / 100.0);
  income_tax := floor((listing.price - commission_amount) * 0.13);
  seller_proceeds := listing.price - commission_amount - income_tax;

  delete from public.market_items where id = listing.id;
  perform public.change_stats(p_buyer_id, -listing.price, 0);

  if listing.item_type = 'phone_number' then
    insert into public.player_phone_numbers(player_id, phone_number, estimated_value, is_active)
      values (p_buyer_id, number_value, estimated_value, false);
  else
    insert into public.player_car_numbers(player_id, plate, estimated_value)
      values (p_buyer_id, number_value, estimated_value);
  end if;

  if seller_proceeds > 0 then perform public.change_stats(listing.seller_id, seller_proceeds, 0); end if;
  select money into updated_money from public.players where id = p_buyer_id;

  return jsonb_build_object(
    'success', true,
    'item_type', listing.item_type,
    'number', number_value,
    'money', updated_money,
    'seller_proceeds', seller_proceeds,
    'market_commission', commission_amount,
    'income_tax', income_tax,
    'market_commission_percent', commission_percent
  );
end;
$$;

create or replace function public.cancel_number_market_lot_rpc(p_seller_id uuid, p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  listing public.market_items;
  listing_payload jsonb;
  number_value text;
  estimated_value bigint;
begin
  select * into listing from public.market_items
    where id = p_item_id and seller_id = p_seller_id
      and item_type in ('phone_number', 'car_number') for update;
  if not found then return jsonb_build_object('error', 'Number listing not found'); end if;
  begin
    listing_payload := listing.item_data::jsonb;
    number_value := listing_payload ->> 'number';
    estimated_value := (listing_payload ->> 'estimated_value')::bigint;
  exception when others then
    return jsonb_build_object('error', 'Invalid number listing data');
  end;
  if nullif(number_value, '') is null or coalesce(estimated_value, 0) < 1 then
    return jsonb_build_object('error', 'Invalid number listing data');
  end if;

  delete from public.market_items where id = listing.id;
  if listing.item_type = 'phone_number' then
    insert into public.player_phone_numbers(player_id, phone_number, estimated_value, is_active)
      values (p_seller_id, number_value, estimated_value, false);
  else
    insert into public.player_car_numbers(player_id, plate, estimated_value)
      values (p_seller_id, number_value, estimated_value);
  end if;
  return jsonb_build_object('success', true, 'item_type', listing.item_type, 'item_data', number_value);
end;
$$;

-- Route existing cancellation flows (including admin moderation) through number recovery.
alter function public.cancel_lot_rpc(uuid, uuid, boolean) rename to cancel_lot_rpc_legacy;
create or replace function public.cancel_lot_rpc(p_player_id uuid, p_item_id uuid, p_add_stock boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  listed_type text;
begin
  select item_type into listed_type from public.market_items
    where id = p_item_id and seller_id = p_player_id for update;
  if listed_type in ('phone_number', 'car_number') then
    return public.cancel_number_market_lot_rpc(p_player_id, p_item_id);
  end if;
  return public.cancel_lot_rpc_legacy(p_player_id, p_item_id, p_add_stock);
end;
$$;

revoke all on function public.list_number_market_lot_rpc(uuid, text, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.buy_number_market_lot_rpc(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_number_market_lot_rpc(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_lot_rpc(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.cancel_lot_rpc_legacy(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.list_number_market_lot_rpc(uuid, text, uuid, integer, integer) to service_role;
grant execute on function public.buy_number_market_lot_rpc(uuid, uuid) to service_role;
grant execute on function public.cancel_number_market_lot_rpc(uuid, uuid) to service_role;
grant execute on function public.cancel_lot_rpc(uuid, uuid, boolean) to service_role;
grant execute on function public.cancel_lot_rpc_legacy(uuid, uuid, boolean) to service_role;
notify pgrst, 'reload schema';
