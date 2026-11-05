-- Reduce idle casino cron checks from every 5s to every 10s.
-- Round transitions remain server-owned; the maximum transition delay becomes 10s.
-- Re-running this named job updates the existing schedule.
select cron.schedule(
  'casino-live-tick',
  '10 seconds',
  $$select public.casino_tick_rpc();$$
);
