-- Restrict direct PostgREST execution of the SECURITY DEFINER audit writer.
-- Internal SECURITY DEFINER game/admin RPCs still write logs as their owner;
-- the Telegram-authenticated /api/rpc gateway can call it with service_role.
revoke all on function public.log_action_rpc(uuid,text,jsonb,integer,integer)
  from public,anon,authenticated;
grant execute on function public.log_action_rpc(uuid,text,jsonb,integer,integer)
  to service_role;

notify pgrst,'reload schema';
