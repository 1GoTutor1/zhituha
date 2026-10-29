-- Let admins remove stale player listings. Return stock to the seller's current business
-- when possible; clean orphaned stock listings if the source business no longer exists.
create or replace function public.admin_delete_market_lot_rpc(p_admin_id uuid, p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  admin_role text;
  listing public.market_items;
  stock_business public.businesses;
  business_type text;
  result jsonb;
begin
  select role into admin_role
  from public.players
  where id = p_admin_id
  for share;

  if coalesce(admin_role, '') not in ('admin', 'superadmin') then
    return jsonb_build_object('error', 'Недостаточно прав');
  end if;

  select * into listing
  from public.market_items
  where id = p_item_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Лот уже удалён или не найден');
  end if;

  if split_part(listing.item_data, ':', 1) = 'stock' then
    business_type := case listing.item_type
      when 'car' then 'salon'
      when 'house' then 'construction'
      when 'phone' then 'phone_factory'
      else null
    end;

    select * into stock_business
    from public.businesses b
    where b.owner_id = listing.seller_id
      and b.biz_type = business_type
    order by (b.id = listing.source_business_id) desc, b.created_at
    limit 1
    for update;

    if not found then
      delete from public.market_items where id = listing.id;
      return jsonb_build_object(
        'success', true,
        'admin_removed', true,
        'seller_id', listing.seller_id,
        'item_returned', false,
        'warning', 'Лот удалён: склад продавца закрыт или больше ему не принадлежит, вернуть товар некуда.'
      );
    end if;

    if listing.source_business_id is distinct from stock_business.id then
      update public.market_items
      set source_business_id = stock_business.id
      where id = listing.id;
    end if;
  end if;

  result := public.cancel_lot_rpc(listing.seller_id, listing.id, true);
  if result ? 'error' then return result; end if;

  return result || jsonb_build_object(
    'admin_removed', true,
    'seller_id', listing.seller_id,
    'item_returned', true
  );
end;
$$;

revoke all on function public.admin_delete_market_lot_rpc(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_market_lot_rpc(uuid, uuid) to service_role;
