-- All-time leaderboard based only on successfully paid Telegram Stars invoices.
create or replace function public.donation_leaderboard_rpc(p_limit integer default 10)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'players', coalesce(jsonb_agg(to_jsonb(r) order by r.stars_total desc, lower(r.nickname), r.id), '[]'::jsonb)
  )
  from (
    select p.id,
           p.nickname,
           sum(o.stars_amount)::bigint as stars_total,
           count(*)::bigint as donation_count
      from public.donation_orders o
      join public.players p on p.id = o.player_id
     where o.status = 'paid'
     group by p.id, p.nickname
     order by sum(o.stars_amount) desc, lower(p.nickname), p.id
     limit least(greatest(coalesce(p_limit, 10), 1), 50)
  ) r;
$$;

revoke all on function public.donation_leaderboard_rpc(integer) from public, anon, authenticated;
grant execute on function public.donation_leaderboard_rpc(integer) to service_role;

create index if not exists donation_orders_paid_leaderboard
  on public.donation_orders(player_id, stars_amount)
  where status = 'paid';

notify pgrst, 'reload schema';
