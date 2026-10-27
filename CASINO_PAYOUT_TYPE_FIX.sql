-- Fix casino payout dispatch: floor(numeric) is numeric, while change_stats accepts bigint.
-- Run once in the Supabase SQL Editor. The next Cron tick will retry the pending settlement.
create or replace function public.change_stats(
  p_player_id uuid,
  p_money_diff numeric,
  p_energy_diff integer
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.change_stats(p_player_id, p_money_diff::bigint, p_energy_diff);
$$;

revoke execute on function public.change_stats(uuid, numeric, integer) from public, anon, authenticated;
grant execute on function public.change_stats(uuid, numeric, integer) to service_role;
