-- Reminder delivery does not need five-minute precision. Run after the reminder
-- and log-volume migrations. This reduces scheduled Vercel calls while keeping
-- daily and return reminders enabled (maximum additional delivery delay: 10m).
create extension if not exists pg_cron;

do $$
declare
  reminder_command text;
  job record;
begin
  select command into reminder_command
  from cron.job
  where jobname = 'daily-reward-reminders'
  order by jobid
  limit 1;

  for job in select jobid from cron.job where jobname = 'daily-reward-reminders' loop
    perform cron.unschedule(job.jobid);
  end loop;

  -- Preserve the existing Vault-backed endpoint and authorization header.
  -- If reminders were never configured, do not create a new job.
  if reminder_command is not null then
    perform cron.schedule('daily-reward-reminders', '*/15 * * * *', reminder_command);
  end if;
end;
$$;
