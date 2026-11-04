-- Daily player-to-player transfer limits. Run after BANK_MIGRATION.sql and
-- PREMIUM_PASS_MIGRATION.sql.

create table if not exists public.bank_transfer_daily_totals (
  player_id uuid not null references public.players(id) on delete cascade,
  transfer_date date not null,
  amount_sent bigint not null default 0 check (amount_sent >= 0),
  updated_at timestamptz not null default now(),
  primary key (player_id, transfer_date)
);

alter table public.bank_transfer_daily_totals enable row level security;
revoke all on public.bank_transfer_daily_totals from public, anon, authenticated;
grant select, insert, update, delete on public.bank_transfer_daily_totals to service_role;

-- Count transfers already sent today, so installing the migration does not
-- reset the daily allowance for players who have already transferred money.
insert into public.bank_transfer_daily_totals (player_id, transfer_date, amount_sent)
select player_id,
       (created_at at time zone 'Europe/Moscow')::date,
       sum(amount)::bigint
from public.bank_transactions
where operation = 'transfer_out'
  and (created_at at time zone 'Europe/Moscow')::date = (clock_timestamp() at time zone 'Europe/Moscow')::date
group by player_id, (created_at at time zone 'Europe/Moscow')::date
on conflict (player_id, transfer_date) do update
set amount_sent = greatest(bank_transfer_daily_totals.amount_sent, excluded.amount_sent),
    updated_at = clock_timestamp();

do $$
begin
  if to_regprocedure('public.bank_transfer_rpc_before_daily_limit(uuid,text,bigint)') is null then
    if to_regprocedure('public.bank_transfer_rpc(uuid,text,bigint)') is null then
      raise exception 'Run BANK_MIGRATION.sql before BANK_TRANSFER_DAILY_LIMIT_MIGRATION.sql';
    end if;
    alter function public.bank_transfer_rpc(uuid,text,bigint)
      rename to bank_transfer_rpc_before_daily_limit;
  end if;
end;
$$;

create or replace function public.bank_transfer_rpc(
  p_player_id uuid,
  p_recipient_nickname text,
  p_amount bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_transfer_date date := (clock_timestamp() at time zone 'Europe/Moscow')::date;
  v_limit bigint;
  v_used bigint;
  v_premium_until timestamptz;
  v_result jsonb;
begin
  if p_player_id is null then
    return jsonb_build_object('error', 'Не удалось определить отправителя перевода');
  end if;
  if p_amount is null or p_amount < 1 then
    return jsonb_build_object('error', 'Сумма перевода должна быть больше нуля');
  end if;

  select premium_until into v_premium_until
  from public.players
  where id = p_player_id;

  if not found then
    return jsonb_build_object('error', 'Игрок не найден');
  end if;

  v_limit := case when v_premium_until > v_now then 250000 else 100000 end;

  insert into public.bank_transfer_daily_totals (player_id, transfer_date, amount_sent)
  values (p_player_id, v_transfer_date, 0)
  on conflict (player_id, transfer_date) do nothing;

  select amount_sent into v_used
  from public.bank_transfer_daily_totals
  where player_id = p_player_id and transfer_date = v_transfer_date
  for update;

  if v_used + p_amount > v_limit then
    return jsonb_build_object(
      'error', format(
        'Дневной лимит переводов — %s ₽. Уже переведено %s ₽, осталось %s ₽. С активной премкой лимит — 250 000 ₽.',
        to_char(v_limit, 'FM999G999G999'),
        to_char(v_used, 'FM999G999G999'),
        to_char(greatest(0, v_limit - v_used), 'FM999G999G999')
      ),
      'daily_limit', v_limit,
      'daily_used', v_used,
      'daily_remaining', greatest(0, v_limit - v_used)
    );
  end if;

  v_result := public.bank_transfer_rpc_before_daily_limit(
    p_player_id, p_recipient_nickname, p_amount
  );

  if v_result is null
     or v_result ? 'error'
     or coalesce((v_result->>'success')::boolean, false) is not true then
    return coalesce(v_result, jsonb_build_object('error', 'Не удалось выполнить перевод'));
  end if;

  update public.bank_transfer_daily_totals
  set amount_sent = v_used + p_amount,
      updated_at = v_now
  where player_id = p_player_id and transfer_date = v_transfer_date;

  return v_result || jsonb_build_object(
    'daily_limit', v_limit,
    'daily_used', v_used + p_amount,
    'daily_remaining', v_limit - v_used - p_amount
  );
end;
$$;

revoke all on function public.bank_transfer_rpc(uuid,text,bigint)
  from public, anon, authenticated;
grant execute on function public.bank_transfer_rpc(uuid,text,bigint) to service_role;

comment on table public.bank_transfer_daily_totals is
  'Moscow-calendar-day totals for outgoing player bank transfers; limits are 100000 RUB or 250000 RUB with active premium.';
