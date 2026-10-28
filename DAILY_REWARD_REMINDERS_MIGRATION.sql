-- Daily reward Telegram reminders.
-- Before running this migration, add these two entries in Supabase Vault:
--   daily_reminders_url = https://zhituha-ashen.vercel.app/api/daily-reminders
--   daily_reminders_cron_secret = the same random value as Vercel CRON_SECRET

alter table public.players
  add column if not exists daily_reminder_sent_for_claim bigint not null default 0,
  add column if not exists daily_reminder_attempted_at bigint not null default 0;

create extension if not exists pg_cron;
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;

create or replace function public.claim_daily_reminder_targets_rpc(p_limit integer default 25)
returns table (
  id uuid,
  telegram_id text,
  nickname text,
  daily_streak integer,
  last_claim bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with clock as (
    select floor(extract(epoch from clock_timestamp()) * 1000)::bigint as now_ms
  ), targets as (
    select p.id
    from public.players p
    cross join clock c
    where p.last_claim > 0
      and p.daily_reminder_sent_for_claim is distinct from p.last_claim
      and p.daily_reminder_attempted_at <= c.now_ms - 300000
      and (
        (coalesce(p.daily_streak, 0) < 7 and p.last_claim <= c.now_ms - 86400000)
        or (coalesce(p.daily_streak, 0) >= 7 and p.last_claim < c.now_ms - 172800000)
      )
    order by p.daily_reminder_attempted_at asc, p.last_claim asc
    for update of p skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 50)
  )
  update public.players p
  set daily_reminder_attempted_at = c.now_ms
  from targets t
  cross join clock c
  where p.id = t.id
  returning p.id, p.telegram_id, p.nickname, p.daily_streak, p.last_claim;
$$;

create or replace function public.mark_daily_reminder_sent_rpc(p_player_id uuid, p_last_claim bigint)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.players
  set daily_reminder_sent_for_claim = p_last_claim
  where id = p_player_id and last_claim = p_last_claim
    and daily_reminder_sent_for_claim is distinct from p_last_claim
  returning true;
$$;

revoke all on function public.claim_daily_reminder_targets_rpc(integer) from public, anon, authenticated;
revoke all on function public.mark_daily_reminder_sent_rpc(uuid, bigint) from public, anon, authenticated;
grant execute on function public.claim_daily_reminder_targets_rpc(integer) to service_role;
grant execute on function public.mark_daily_reminder_sent_rpc(uuid, bigint) to service_role;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'daily_reminders_url')
     or not exists (select 1 from vault.decrypted_secrets where name = 'daily_reminders_cron_secret') then
    raise exception 'Add daily_reminders_url and daily_reminders_cron_secret to Supabase Vault before scheduling reminders';
  end if;
end;
$$;

select cron.schedule(
  'daily-reward-reminders',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'daily_reminders_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'daily_reminders_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  $$
);
