-- State business lease-to-own: 25% down, then 50% of eligible sales.
-- Apply after BUSINESS_LOCATIONS_MIGRATION.sql, BUSINESS_COMMERCE_MIGRATION.sql,
-- BUSINESS_PASSIVE_INCOME.sql, BUSINESS_SALES_HISTORY_MIGRATION.sql,
-- DEALERSHIP_FLEET_MIGRATION.sql, and BANK_BUSINESS_COLLATERAL_MIGRATION.sql.

create table if not exists public.business_lease_contracts (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  lessee_id uuid not null references public.players(id) on delete cascade,
  location_key text not null unique references public.business_locations(location_key),
  purchase_price bigint not null check (purchase_price > 0),
  down_payment bigint not null check (down_payment > 0),
  paid_from_sales bigint not null default 0 check (paid_from_sales >= 0),
  paid_manually bigint not null default 0 check (paid_manually >= 0),
  repayment_percent integer not null default 50 check (repayment_percent between 1 and 100),
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  check (down_payment + paid_from_sales + paid_manually <= purchase_price),
  check ((status = 'active' and completed_at is null) or (status = 'completed' and completed_at is not null))
);
create index if not exists business_lease_contracts_lessee_idx
  on public.business_lease_contracts(lessee_id, status);
alter table public.business_lease_contracts enable row level security;
revoke all on public.business_lease_contracts from public, anon, authenticated;
grant all on public.business_lease_contracts to service_role;

create or replace function public.start_business_lease_rpc(p_player_id uuid, p_location_key text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  p public.players;
  l public.business_locations;
  b public.businesses;
  owned_count integer;
  down_payment bigint;
begin
  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;

  select * into l from public.business_locations where location_key = p_location_key for update;
  if not found then
    return jsonb_build_object('error', 'Такая точка не найдена');
  end if;
  if l.purchase_price is null or l.purchase_price <= 0 then
    return jsonb_build_object('error', 'Цена бизнеса не настроена');
  end if;
  if l.biz_type not in ('coffee', 'minimarket', 'salon', 'taxi', 'auto_repair') then
    return jsonb_build_object('error', 'Для этого бизнеса аренда с выкупом пока недоступна');
  end if;

  select count(*) into owned_count from public.businesses where owner_id = p_player_id;
  if owned_count >= 3 then return jsonb_build_object('error', 'Можно владеть не более чем тремя бизнесами'); end if;
  down_payment := ceil(l.purchase_price * 0.25)::bigint;
  if coalesce(p.money, 0) < down_payment then
    return jsonb_build_object('error', format('Для аренды нужен взнос %s ₽', down_payment));
  end if;

  if l.business_id is null then
    insert into public.businesses(owner_id, owner_name, biz_type, business_name, location_key)
      values (p_player_id, p.nickname, l.biz_type, l.business_name, l.location_key)
      returning * into b;
  else
    select * into b from public.businesses where id = l.business_id for update;
    if not found or b.owner_id is not null or b.location_key is distinct from l.location_key
      or b.biz_type not in ('coffee', 'minimarket', 'salon', 'taxi', 'auto_repair') then
      return jsonb_build_object('error', 'Эта точка уже занята');
    end if;
    if exists (select 1 from public.business_auctions where business_id = b.id and status = 'active') then
      return jsonb_build_object('error', 'Бизнес выставлен на торги');
    end if;
    update public.businesses
      set owner_id = p_player_id, owner_name = p.nickname,
          cash_balance = 0, coffee_balance = 0, passive_balance = 0,
          passive_level = -1, passive_updated_at = clock_timestamp(), stock = '{}'::jsonb
      where id = b.id
      returning * into b;
    delete from public.business_shop_stock where business_id = b.id;
  end if;
  update public.players set money = coalesce(money, 0) - down_payment where id = p_player_id returning * into p;
  insert into public.business_lease_contracts(
    business_id, lessee_id, location_key, purchase_price, down_payment
  ) values (
    b.id, p_player_id, l.location_key, l.purchase_price, down_payment
  );
  update public.business_locations set business_id = b.id where location_key = l.location_key;

  return jsonb_build_object(
    'success', true, 'business_id', b.id, 'biz_type', b.biz_type,
    'business_name', b.business_name, 'purchase_price', l.purchase_price,
    'down_payment', down_payment, 'remaining', l.purchase_price - down_payment,
    'repayment_percent', 50, 'money', p.money, 'owned_count', owned_count + 1
  );
end;
$$;

create or replace function public.finish_business_lease_rpc(p_player_id uuid, p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  p public.players;
  b public.businesses;
  lease public.business_lease_contracts;
  remaining bigint;
begin
  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;
  select * into b from public.businesses where id = p_business_id and owner_id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Бизнес не найден'); end if;
  select * into lease from public.business_lease_contracts
    where business_id = p_business_id and lessee_id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Договор аренды не найден'); end if;
  if lease.status = 'completed' then
    return jsonb_build_object('success', true, 'remaining', 0, 'money', p.money);
  end if;

  remaining := lease.purchase_price - lease.down_payment - lease.paid_from_sales - lease.paid_manually;
  if remaining <= 0 then return jsonb_build_object('error', 'Бизнес уже выкуплен'); end if;
  if coalesce(p.money, 0) < remaining then
    return jsonb_build_object('error', format('Для полного выкупа нужно %s ₽', remaining));
  end if;

  update public.players set money = coalesce(money, 0) - remaining
    where id = p_player_id returning * into p;
  update public.business_lease_contracts
    set paid_manually = paid_manually + remaining,
        status = 'completed', completed_at = clock_timestamp()
    where business_id = p_business_id;
  return jsonb_build_object('success', true, 'paid', remaining, 'remaining', 0, 'money', p.money);
end;
$$;

create or replace function public.apply_business_lease_sale()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  lease public.business_lease_contracts;
  payment bigint;
  remaining bigint;
  wallet_balance bigint;
begin
  if new.event_type not in (
    'coffee_sale', 'retail_sale', 'vehicle_sale', 'repair_sale', 'taxi_sale',
    'business_sale', 'taxi_fleet_income'
  ) then
    return new;
  end if;

  select * into lease
  from public.business_lease_contracts
  where business_id = new.business_id and status = 'active'
  for update;
  if not found then return new; end if;

  remaining := lease.purchase_price - lease.down_payment - lease.paid_from_sales - lease.paid_manually;
  if remaining <= 0 then return new; end if;
  payment := least(remaining, floor(new.amount * lease.repayment_percent / 100.0)::bigint);
  if payment <= 0 then return new; end if;

  if new.event_type = 'taxi_fleet_income' then
    -- This income is paid directly to the owner's wallet by the taxi collector.
    update public.players
      set money = coalesce(money, 0) - payment
      where id = lease.lessee_id and coalesce(money, 0) >= payment
      returning money into wallet_balance;
    if not found then return new; end if;
  elsif new.event_type = 'coffee_sale' then
    update public.businesses
      set coffee_balance = greatest(0, coalesce(coffee_balance, 0) - payment)
      where id = lease.business_id;
  else
    update public.businesses
      set cash_balance = greatest(0, coalesce(cash_balance, 0) - payment)
      where id = lease.business_id;
  end if;

  update public.business_lease_contracts
  set paid_from_sales = paid_from_sales + payment,
      status = case
        when down_payment + paid_from_sales + paid_manually + payment >= purchase_price then 'completed'
        else 'active'
      end,
      completed_at = case
        when down_payment + paid_from_sales + paid_manually + payment >= purchase_price then clock_timestamp()
        else null
      end
  where business_id = lease.business_id;
  return new;
end;
$$;

drop trigger if exists business_lease_apply_sales on public.business_sales_history;
create trigger business_lease_apply_sales
after insert on public.business_sales_history
for each row execute function public.apply_business_lease_sale();

create or replace function public.protect_active_business_lease()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if exists (
    select 1 from public.business_lease_contracts
    where business_id = old.id and status = 'active'
  ) then
    if tg_op = 'DELETE' then
      raise exception 'Бизнес ещё не выкуплен';
    elsif new.owner_id is distinct from old.owner_id then
      raise exception 'Бизнес ещё не выкуплен';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists business_lease_protect_owner on public.businesses;
create trigger business_lease_protect_owner
before update of owner_id or delete on public.businesses
for each row execute function public.protect_active_business_lease();

-- Prevent leased businesses from entering player auctions.
create or replace function public.protect_leased_business_auction()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if exists (
    select 1 from public.business_lease_contracts
    where business_id = new.business_id and status = 'active'
  ) then
    raise exception 'Сначала заверши выкуп бизнеса';
  end if;
  return new;
end;
$$;
drop trigger if exists business_lease_protect_auction on public.business_auctions;
create trigger business_lease_protect_auction
before insert or update of business_id on public.business_auctions
for each row execute function public.protect_leased_business_auction();

-- Leased businesses cannot be pledged as collateral.
create or replace function public.protect_leased_business_loan_collateral()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.collateral_business_id is not null and exists (
    select 1 from public.business_lease_contracts
    where business_id = new.collateral_business_id and status = 'active'
  ) then
    raise exception 'Бизнес в аренде с выкупом нельзя заложить';
  end if;
  return new;
end;
$$;
drop trigger if exists business_lease_protect_loan_collateral on public.bank_loans;
create trigger business_lease_protect_loan_collateral
before insert or update of collateral_business_id on public.bank_loans
for each row execute function public.protect_leased_business_loan_collateral();

-- Extend the existing catalog result with lease progress without replacing its
-- current auction and availability logic.
do $$
begin
  if to_regprocedure('public.business_catalog_rpc_before_lease(uuid)') is null then
    execute 'alter function public.business_catalog_rpc(uuid) rename to business_catalog_rpc_before_lease';
  end if;
end;
$$;

create or replace function public.business_catalog_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  catalog jsonb;
  locations jsonb;
begin
  catalog := public.business_catalog_rpc_before_lease(p_player_id);
  select coalesce(jsonb_agg(
    case
      when lease.business_id is not null and lease.status = 'active'
        then location || jsonb_build_object(
          'status', case when lease.lessee_id = p_player_id then 'leased' else 'leased_elsewhere' end,
          'lease_active', true,
          'lease_price', lease.purchase_price,
          'lease_down_payment', lease.down_payment,
          'lease_paid_from_sales', lease.paid_from_sales,
          'lease_paid_manually', lease.paid_manually,
          'lease_remaining', lease.purchase_price - lease.down_payment - lease.paid_from_sales - lease.paid_manually,
          'lease_repayment_percent', lease.repayment_percent
        )
      when location->>'business_id' is not null
        and location->>'owner_id' is null
        and location->>'biz_type' in ('coffee', 'minimarket', 'salon', 'taxi', 'auto_repair')
        then location || jsonb_build_object('status', 'available', 'state_owned', true, 'lease_active', false)
      else location || jsonb_build_object('lease_active', false)
    end order by ordinality
  ), '[]'::jsonb)
  into locations
  from jsonb_array_elements(coalesce(catalog->'locations', '[]'::jsonb)) with ordinality as locrow(location, ordinality)
  left join public.business_lease_contracts lease
    on lease.business_id = nullif(locrow.location->>'business_id', '')::uuid;

  return jsonb_set(catalog, '{locations}', locations, true);
end;
$$;

revoke all on function public.start_business_lease_rpc(uuid, text),
  public.finish_business_lease_rpc(uuid, uuid),
  public.apply_business_lease_sale(), public.protect_active_business_lease(),
  public.protect_leased_business_auction(), public.protect_leased_business_loan_collateral(),
  public.business_catalog_rpc_before_lease(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.business_catalog_rpc(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.start_business_lease_rpc(uuid, text),
  public.finish_business_lease_rpc(uuid, uuid),
  public.business_catalog_rpc(uuid) to service_role;

notify pgrst, 'reload schema';
