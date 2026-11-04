-- Reduce noisy scheduled runs without changing economy calculations.
-- Run once in Supabase SQL Editor after deploying the matching app code.
create extension if not exists pg_cron;

do $$
declare
  job record;
  reminder_command text;
begin
  -- Keep exactly one casino tick, now every five seconds instead of every second.
  for job in select jobid from cron.job where jobname = 'casino-live-tick' loop
    perform cron.unschedule(job.jobid);
  end loop;
  perform cron.schedule(
    'casino-live-tick',
    '5 seconds',
    'select public.casino_tick_rpc();'
  );

  -- Remove the obsolete one-minute market job and keep a single five-minute tick.
  for job in select jobid from cron.job
      where jobname in ('bank-market-minute-tick', 'bank-market-five-minute-tick') loop
    perform cron.unschedule(job.jobid);
  end loop;
  perform cron.schedule(
    'bank-market-five-minute-tick',
    '*/5 * * * *',
    'select public.bank_market_tick_rpc();'
  );

  -- Reminder scanning only needs five-minute precision. Preserve its configured
  -- HTTP command and do not create a job if reminders were never configured.
  select command into reminder_command
  from cron.job
  where jobname = 'daily-reward-reminders'
  order by jobid
  limit 1;
  for job in select jobid from cron.job where jobname = 'daily-reward-reminders' loop
    perform cron.unschedule(job.jobid);
  end loop;
  if reminder_command is not null then
    perform cron.schedule('daily-reward-reminders', '*/5 * * * *', reminder_command);
  end if;
end;
$$;
