-- Site-wide maintenance switch. Run once in the Supabase SQL Editor.
create table if not exists public.site_settings (
  setting_key text primary key,
  maintenance_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.players(id) on delete set null
);

insert into public.site_settings (setting_key, maintenance_enabled)
values ('main', false)
on conflict (setting_key) do nothing;

alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select, insert, update, delete on public.site_settings to service_role;
