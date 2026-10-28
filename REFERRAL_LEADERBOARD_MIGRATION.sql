-- Efficient, read-only aggregate used by the referral leaderboard API.
create index if not exists idx_players_referred_by
  on public.players (referred_by)
  where referred_by is not null;

create or replace view public.referral_leaderboard
with (security_invoker = true)
as
select
  inviter.nickname,
  count(invited.id)::bigint as referral_count,
  inviter.id as player_id
from public.players as invited
join public.players as inviter
  on inviter.telegram_id::text = invited.referred_by
where invited.referred_by is not null
  and coalesce(inviter.is_banned, false) = false
  and coalesce(invited.is_banned, false) = false
group by inviter.id, inviter.nickname
having count(invited.id) > 0;

revoke all on public.referral_leaderboard from public, anon, authenticated;
grant select on public.referral_leaderboard to service_role;
