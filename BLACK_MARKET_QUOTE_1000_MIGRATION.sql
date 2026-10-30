-- Round every black-market buy quote to a whole thousand.
-- Apply after BLACK_MARKET_FAMILY_EVENT_MIGRATION.sql.

update public.black_market_windows
set buy_price = greatest(8000, least(16000, round(buy_price / 1000.0)::integer * 1000))
where mod(buy_price, 1000) <> 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'black_market_windows_buy_price_1000_check'
      and conrelid = 'public.black_market_windows'::regclass
  ) then
    alter table public.black_market_windows
      add constraint black_market_windows_buy_price_1000_check
      check (buy_price between 8000 and 16000 and mod(buy_price, 1000) = 0);
  end if;
end $$;

create or replace function public.black_market_get_window(p_now timestamptz default clock_timestamp())
returns public.black_market_windows
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  ln timestamp;
  d date;
  sl smallint;
  sh integer;
  eh integer;
  w public.black_market_windows;
begin
  ln := timezone('Europe/Moscow', p_now);
  d := ln::date;
  if ln::time >= time '07:00' and ln::time < time '11:00' then
    sl := 1; sh := 7; eh := 11;
  elsif ln::time >= time '15:00' and ln::time < time '19:00' then
    sl := 2; sh := 15; eh := 19;
  else
    return null;
  end if;

  insert into public.black_market_windows(window_key, market_day, slot, starts_at, ends_at, buy_price)
  values (
    to_char(d, 'YYYYMMDD') || '-' || sl,
    d,
    sl,
    (d + make_time(sh, 0, 0)) at time zone 'Europe/Moscow',
    (d + make_time(eh, 0, 0)) at time zone 'Europe/Moscow',
    8000 + floor(random() * 9)::integer * 1000
  )
  on conflict (market_day, slot) do nothing;

  select * into w
  from public.black_market_windows
  where market_day = d and slot = sl;
  return w;
end $$;

revoke all on function public.black_market_get_window(timestamptz) from public, anon, authenticated;
grant execute on function public.black_market_get_window(timestamptz) to service_role;

notify pgrst, 'reload schema';
