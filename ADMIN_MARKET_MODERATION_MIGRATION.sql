-- Allow admins to remove stale player listings while returning the listed item.
create or replace function public.admin_delete_market_lot_rpc(p_admin_id uuid, p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  admin_role text;
  listing public.market_items;
  result jsonb;
begin
  select role into admin_role
  from public.players
  where id = p_admin_id
  for share;

  if admin_role not in ('admin', 'superadmin') then
    return jsonb_build_object('error', 'Недостаточно прав');
  end if;

  select * into listing
  from public.market_items
  where id = p_item_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Лот уже удалён или не найден');
  end if;

  result := public.cancel_lot_rpc(listing.seller_id, listing.id, true);
  if result ? 'error' then return result; end if;

  return result || jsonb_build_object('admin_removed', true, 'seller_id', listing.seller_id);
end;
$$;

revoke all on function public.admin_delete_market_lot_rpc(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_market_lot_rpc(uuid, uuid) to service_role;
