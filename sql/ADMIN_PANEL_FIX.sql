-- Align SQL-backed admin actions with the admin and superadmin roles
-- already accepted by the authenticated admin API and interface.
create or replace function public.is_admin(p_player_id uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.players p
    where p.id = p_player_id
      and p.role in ('admin', 'superadmin')
  );
$$;
