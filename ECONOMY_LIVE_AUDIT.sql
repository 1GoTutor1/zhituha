-- Read-only checks for the live Supabase schema. This file contains SELECT statements only.

-- Current function definitions, including any wrappers created by later migrations.
select
  p.proname as function_name,
  p.oid::regprocedure as signature,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'work_rpc',
    'finish_profession_cycle_rpc',
    'sell_inventory_rpc',
    'business_shop_buy_rpc',
    'bank_open_deposit_rpc',
    'bank_market_tick_rpc',
    'place_bet_rpc',
    'settle_business_passive'
  )
order by p.proname, p.oid::regprocedure::text;

-- Scheduled economy jobs; requires pg_cron.
select jobid, jobname, schedule, command, active
from cron.job
where jobname ilike '%bank%'
   or jobname ilike '%casino%'
   or jobname ilike '%business%'
   or command ilike '%bank_market_tick_rpc%'
order by jobname, jobid;

-- Rates and balances already stored on deposits.
select term_hours, rate_bps, status, count(*) as deposit_count,
       sum(principal) as principal_total
from public.bank_deposits
group by term_hours, rate_bps, status
order by term_hours, rate_bps, status;

-- Presence of columns required by the proposed economy migrations.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('businesses', 'passive_level'),
    ('businesses', 'passive_balance'),
    ('businesses', 'passive_updated_at'),
    ('players', 'coffee_bonus_until'),
    ('players', 'tip_balance'),
    ('casino_business_upgrades', 'level')
  )
order by table_name, ordinal_position;
