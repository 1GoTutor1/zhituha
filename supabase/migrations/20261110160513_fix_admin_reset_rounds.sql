-- Keep the admin round reset helper aligned with the live casino_rounds schema.
create or replace function public.admin_reset_rounds()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  v_updated integer;
begin
  perform pg_advisory_xact_lock(hashtext('casino_cycle'));

  update public.casino_rounds
     set status = 'result',
         end_time = least(coalesce(end_time, 0), v_now_ms)
   where status in ('betting', 'spinning');

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

notify pgrst, 'reload schema';
