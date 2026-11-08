-- The application proxies this RPC through the authenticated server role.
-- Keep the SECURITY DEFINER function away from direct anonymous/client calls.
revoke all on function public.list_item_rpc(uuid, text, text, bigint, text, integer)
  from public, anon, authenticated;
grant execute on function public.list_item_rpc(uuid, text, text, bigint, text, integer)
  to service_role;
