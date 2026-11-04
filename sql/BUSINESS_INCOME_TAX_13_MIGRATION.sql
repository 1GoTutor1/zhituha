-- Run after the current business commerce, business sales history,
-- passive income, dealership fleet, and referral/return-bonus migrations.
-- Taxes only newly earned business income. Owner deposits and old balances
-- are not taxed retroactively.

alter table public.businesses
  add column if not exists business_tax_cash_remainder numeric(12,8) not null default 0,
  add column if not exists business_tax_coffee_remainder numeric(12,8) not null default 0,
  add column if not exists business_tax_passive_remainder numeric(12,8) not null default 0;

create table if not exists public.business_income_tax_history (
  id bigint generated always as identity primary key,
  business_id uuid not null,
  owner_id uuid not null,
  income_type text not null,
  gross_income bigint not null,
  tax_amount bigint not null,
  net_income bigint not null,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists business_income_tax_history_owner_time_idx
  on public.business_income_tax_history(owner_id, created_at desc);
alter table public.business_income_tax_history enable row level security;
revoke all on public.business_income_tax_history from public, anon, authenticated;
grant all on public.business_income_tax_history to service_role;

create or replace function public.apply_business_income_tax_13()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  gross bigint;
  tax bigint;
  exact_tax numeric;
  remainder numeric;
  income_type text;
begin
  -- Cash deposited by the owner is capital, not business income.
  if current_setting('zhituha.business_income_tax_skip', true) = 'on'
     or new.owner_id is null then
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    new.business_tax_cash_remainder := 0;
    new.business_tax_coffee_remainder := 0;
    new.business_tax_passive_remainder := 0;
  end if;

  if coalesce(new.cash_balance, 0) > coalesce(old.cash_balance, 0) then
    gross := new.cash_balance - old.cash_balance;
    exact_tax := gross * 0.13 + coalesce(old.business_tax_cash_remainder, 0);
    tax := floor(exact_tax)::bigint;
    remainder := exact_tax - tax;
    new.cash_balance := new.cash_balance - tax;
    new.business_tax_cash_remainder := remainder;
    income_type := 'business_cash';
    insert into public.business_income_tax_history(
      business_id, owner_id, income_type, gross_income, tax_amount, net_income
    ) values (new.id, new.owner_id, income_type, gross, tax, gross - tax);
  end if;

  if coalesce(new.coffee_balance, 0) > coalesce(old.coffee_balance, 0) then
    gross := new.coffee_balance - old.coffee_balance;
    exact_tax := gross * 0.13 + coalesce(old.business_tax_coffee_remainder, 0);
    tax := floor(exact_tax)::bigint;
    remainder := exact_tax - tax;
    new.coffee_balance := new.coffee_balance - tax;
    new.business_tax_coffee_remainder := remainder;
    income_type := 'coffee_sales';
    insert into public.business_income_tax_history(
      business_id, owner_id, income_type, gross_income, tax_amount, net_income
    ) values (new.id, new.owner_id, income_type, gross, tax, gross - tax);
  end if;

  if coalesce(new.passive_balance, 0) > coalesce(old.passive_balance, 0) then
    gross := new.passive_balance - old.passive_balance;
    exact_tax := gross * 0.13 + coalesce(old.business_tax_passive_remainder, 0);
    tax := floor(exact_tax)::bigint;
    remainder := exact_tax - tax;
    new.passive_balance := new.passive_balance - tax;
    new.business_tax_passive_remainder := remainder;
    income_type := 'passive_income';
    insert into public.business_income_tax_history(
      business_id, owner_id, income_type, gross_income, tax_amount, net_income
    ) values (new.id, new.owner_id, income_type, gross, tax, gross - tax);
  end if;
  return new;
end;
$$;

drop trigger if exists business_income_tax_13 on public.businesses;
create trigger business_income_tax_13
before update of cash_balance, coffee_balance, passive_balance on public.businesses
for each row execute function public.apply_business_income_tax_13();

-- Keep deposits tax-free while preserving the installed cash-history wrapper.
do $$
begin
  if to_regprocedure('public.business_cash_transfer_rpc_before_income_tax(uuid,uuid,bigint,text)') is null then
    if to_regprocedure('public.business_cash_transfer_rpc(uuid,uuid,bigint,text)') is null then
      raise exception 'Apply BUSINESS_COMMERCE_MIGRATION.sql before this migration';
    end if;
    alter function public.business_cash_transfer_rpc(uuid,uuid,bigint,text)
      rename to business_cash_transfer_rpc_before_income_tax;
  end if;
end;
$$;

create or replace function public.business_cash_transfer_rpc(
  p_player_id uuid, p_business_id uuid, p_amount bigint, p_direction text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  previous_skip text;
  result_json jsonb;
begin
  previous_skip := current_setting('zhituha.business_income_tax_skip', true);
  if p_direction = 'deposit' then
    perform set_config('zhituha.business_income_tax_skip', 'on', true);
  end if;
  result_json := public.business_cash_transfer_rpc_before_income_tax(
    p_player_id, p_business_id, p_amount, p_direction
  );
  perform set_config('zhituha.business_income_tax_skip', coalesce(previous_skip, ''), true);
  return result_json;
end;
$$;

-- Taxi-fleet collection credits the owner directly, bypassing business balances.
do $$
begin
  if to_regprocedure('public.taxi_collect_rpc_before_business_income_tax(uuid,uuid)') is null then
    if to_regprocedure('public.taxi_collect_rpc(uuid,uuid)') is null then
      raise exception 'Apply the taxi fleet and return-bonus migrations before this migration';
    end if;
    alter function public.taxi_collect_rpc(uuid,uuid)
      rename to taxi_collect_rpc_before_business_income_tax;
  end if;
end;
$$;

create or replace function public.taxi_collect_rpc(p_biz_id uuid, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  result_json jsonb;
  gross_owner_income bigint;
  return_bonus bigint;
  tax_amount bigint;
  tax_remainder numeric;
  exact_tax numeric;
  new_money bigint;
begin
  result_json := public.taxi_collect_rpc_before_business_income_tax(p_biz_id, p_player_id);
  if result_json is null or result_json ? 'error' or not (result_json ? 'income') then
    return result_json;
  end if;

  gross_owner_income := greatest(0, coalesce((result_json->>'income')::bigint, 0));
  return_bonus := greatest(0, coalesce((result_json->>'return_bonus_income')::bigint, 0));
  gross_owner_income := greatest(0, gross_owner_income - return_bonus);
  select coalesce(business_tax_cash_remainder, 0) into tax_remainder
  from public.businesses
  where id = p_biz_id and owner_id = p_player_id and biz_type = 'taxi'
  for update;
  if not found then return result_json; end if;
  exact_tax := gross_owner_income * 0.13 + tax_remainder;
  tax_amount := floor(exact_tax)::bigint;
  tax_remainder := exact_tax - tax_amount;
  update public.businesses set business_tax_cash_remainder = tax_remainder where id = p_biz_id;

  if tax_amount > 0 then
    update public.players
    set money = coalesce(money, 0) - tax_amount
    where id = p_player_id
    returning money into new_money;
  else
    select money into new_money from public.players where id = p_player_id;
  end if;

  if tax_amount > 0 then
    insert into public.business_income_tax_history(
      business_id, owner_id, income_type, gross_income, tax_amount, net_income
    ) values (p_biz_id, p_player_id, 'taxi_fleet', gross_owner_income, tax_amount, gross_owner_income - tax_amount);
  end if;

  return result_json || jsonb_build_object(
    'income', gross_owner_income - tax_amount + return_bonus,
    'taxable_income', gross_owner_income,
    'business_tax', tax_amount,
    'business_tax_rate', 13,
    'money', new_money
  );
end;
$$;

revoke all on function public.apply_business_income_tax_13() from public, anon, authenticated;
revoke all on function public.business_cash_transfer_rpc_before_income_tax(uuid,uuid,bigint,text) from public, anon, authenticated;
revoke all on function public.business_cash_transfer_rpc(uuid,uuid,bigint,text) from public, anon, authenticated;
revoke all on function public.taxi_collect_rpc_before_business_income_tax(uuid,uuid) from public, anon, authenticated;
revoke all on function public.taxi_collect_rpc(uuid,uuid) from public, anon, authenticated;
grant execute on function public.business_cash_transfer_rpc(uuid,uuid,bigint,text) to service_role;
grant execute on function public.taxi_collect_rpc(uuid,uuid) to service_role;

notify pgrst, 'reload schema';
