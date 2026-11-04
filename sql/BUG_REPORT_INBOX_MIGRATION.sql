-- Persistent inbox for in-game bug reports, browsed by admins in the Telegram bot.
create table if not exists public.bug_reports (
  id bigint generated always as identity primary key,
  telegram_id text not null,
  player_name text not null default 'Player',
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

create index if not exists bug_reports_open_created_idx
  on public.bug_reports (created_at desc, id desc)
  where status = 'open';

alter table public.bug_reports enable row level security;
revoke all on public.bug_reports from public, anon, authenticated;
grant select, insert, update on public.bug_reports to service_role;
grant usage, select on sequence public.bug_reports_id_seq to service_role;

notify pgrst, 'reload schema';
