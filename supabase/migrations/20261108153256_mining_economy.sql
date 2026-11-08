-- In-game mining economy: one GPU farm assembled from parts, fixed-price
-- standalone ASIC/industrial miners, one coin, power costs and taxed sales.

create table if not exists public.player_mining_accounts (
  player_id uuid primary key references public.players(id) on delete cascade,
  coin_balance numeric(24,8) not null default 0 check (coin_balance >= 0),
  site_slots integer not null default 1 check (site_slots >= 1),
  tax_remainder numeric(12,8) not null default 0 check (tax_remainder >= 0 and tax_remainder < 1),
  electricity_remainder numeric(12,8) not null default 0 check (electricity_remainder >= 0 and electricity_remainder < 1),
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists public.player_mining_inventory (
  player_id uuid not null references public.players(id) on delete cascade,
  item_id text not null,
  quantity integer not null default 0 check (quantity >= 0),
  primary key (player_id, item_id)
);

create table if not exists public.player_mining_rigs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  rig_type text not null check (rig_type in ('gpu_farm', 'asic', 'industrial')),
  gpu_count smallint not null default 0 check (gpu_count between 0 and 4),
  installed boolean not null default false,
  is_running boolean not null default false,
  last_settled_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint mining_rig_running_requires_install check (not is_running or installed),
  constraint mining_gpu_count_only_on_gpu_farm check (rig_type = 'gpu_farm' or gpu_count = 0)
);

create index if not exists player_mining_rigs_owner_idx
  on public.player_mining_rigs(player_id, created_at);

create table if not exists public.mining_market_state (
  id smallint primary key check (id = 1),
  coin_price bigint not null check (coin_price between 900000 and 1100000),
  price_date date not null,
  updated_at timestamptz not null default clock_timestamp()
);

insert into public.mining_market_state(id, coin_price, price_date)
values (1, 1000000, (clock_timestamp() at time zone 'Europe/Moscow')::date)
on conflict (id) do nothing;

create table if not exists public.mining_transactions (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('mine', 'sell')),
  coin_amount numeric(24,8) not null default 0,
  coin_price bigint not null,
  gross_money bigint not null default 0,
  tax_amount bigint not null default 0,
  net_money bigint not null default 0,
  electricity_paid bigint not null default 0,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists mining_transactions_player_time_idx
  on public.mining_transactions(player_id, created_at desc);

alter table public.player_mining_accounts enable row level security;
alter table public.player_mining_inventory enable row level security;
alter table public.player_mining_rigs enable row level security;
alter table public.mining_market_state enable row level security;
alter table public.mining_transactions enable row level security;

revoke all on public.player_mining_accounts, public.player_mining_inventory,
  public.player_mining_rigs, public.mining_market_state, public.mining_transactions
  from public, anon, authenticated;
grant all on public.player_mining_accounts, public.player_mining_inventory,
  public.player_mining_rigs, public.mining_market_state, public.mining_transactions
  to service_role;
grant usage, select on sequence public.mining_transactions_id_seq to service_role;

create or replace function public.mining_current_coin_price()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  market public.mining_market_state;
  v_today date := (clock_timestamp() at time zone 'Europe/Moscow')::date;
  v_next_price bigint;
begin
  select * into market from public.mining_market_state where id = 1;
  if not found then
    insert into public.mining_market_state(id, coin_price, price_date)
    values (1, 1000000, v_today)
    on conflict (id) do nothing;
    select * into market from public.mining_market_state where id = 1;
  end if;

  if market.price_date < v_today then
    update public.mining_market_state
    set coin_price = greatest(900000, least(1100000,
          coin_price + floor(random() * 100001)::bigint - 50000)),
        price_date = v_today, updated_at = clock_timestamp()
    where id = 1 and price_date < v_today
    returning coin_price into v_next_price;
    if found then return v_next_price; end if;
    select coin_price into v_next_price from public.mining_market_state where id = 1;
    return v_next_price;
  end if;
  return market.coin_price;
end;
$$;

create or replace function public.mining_settle_player(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_player public.players;
  v_rig public.player_mining_rigs;
  v_coin numeric(24,8) := 0;
  v_power numeric(18,4) := 0;
  v_coin_rate numeric;
  v_power_rate numeric;
  v_seconds numeric;
  v_idle_stop boolean := false;
  v_afford_ratio numeric := 1;
  v_power_paid bigint := 0;
  v_power_remainder numeric(12,8) := 0;
  v_price bigint;
begin
  select * into v_player from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;
  insert into public.player_mining_accounts(player_id) values (p_player_id)
  on conflict (player_id) do nothing;
  select electricity_remainder into v_power_remainder from public.player_mining_accounts where player_id = p_player_id for update;

  for v_rig in
    select * from public.player_mining_rigs
    where player_id = p_player_id and installed and is_running
    order by id for update
  loop
    v_seconds := greatest(0, least(43200, extract(epoch from (v_now - v_rig.last_settled_at))));
    if v_rig.rig_type = 'gpu_farm' then
      v_coin_rate := v_rig.gpu_count * 0.01775;
      v_power_rate := v_rig.gpu_count * 1500;
    elsif v_rig.rig_type = 'asic' then
      v_coin_rate := 0.142;
      v_power_rate := 10000;
    else
      v_coin_rate := 0.5325;
      v_power_rate := 36000;
    end if;
    v_coin := v_coin + (v_coin_rate * v_seconds / 86400);
    v_power := v_power + (v_power_rate * v_seconds / 86400);
    if extract(epoch from (v_now - v_rig.last_settled_at)) >= 43200 then
      v_idle_stop := true;
    end if;
  end loop;

  v_power_paid := floor(v_power + coalesce(v_power_remainder, 0))::bigint;
  if v_power_paid > coalesce(v_player.money, 0) then
    if v_power_paid > 0 then
      v_afford_ratio := coalesce(v_player.money, 0)::numeric / v_power_paid;
    else
      v_afford_ratio := 0;
    end if;
    v_coin := v_coin * v_afford_ratio;
    v_power_paid := coalesce(v_player.money, 0);
    v_idle_stop := true;
    v_power_remainder := 0;
  else
    v_power_remainder := v_power + coalesce(v_power_remainder, 0) - v_power_paid;
  end if;

  v_price := public.mining_current_coin_price();
  update public.player_mining_accounts
  set coin_balance = coin_balance + round(v_coin, 8), electricity_remainder = v_power_remainder
  where player_id = p_player_id;

  update public.players
  set money = greatest(0, coalesce(money, 0) - v_power_paid)
  where id = p_player_id
  returning * into v_player;

  update public.player_mining_rigs
  set last_settled_at = v_now,
      is_running = case when v_idle_stop then false else is_running end
  where player_id = p_player_id and installed and is_running;

  if v_coin > 0 or v_power_paid > 0 then
    insert into public.mining_transactions(
      player_id, transaction_type, coin_amount, coin_price,
      gross_money, tax_amount, net_money, electricity_paid
    ) values (
      p_player_id, 'mine', round(v_coin, 8), v_price, 0, 0, 0, v_power_paid
    );
  end if;

  return jsonb_build_object(
    'coin_added', round(v_coin, 8),
    'electricity_paid', v_power_paid,
    'money', v_player.money,
    'stopped', v_idle_stop
  );
end;
$$;

create or replace function public.mining_state_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_player public.players;
  v_account public.player_mining_accounts;
  v_price bigint;
  v_now timestamptz := clock_timestamp();
  v_used_slots integer;
begin
  select * into v_player from public.players where id = p_player_id;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;
  if coalesce(v_player.player_level, 1) < 10 then
    return jsonb_build_object('locked', true, 'level_required', 10, 'player_level', coalesce(v_player.player_level, 1));
  end if;

  insert into public.player_mining_accounts(player_id) values (p_player_id)
  on conflict (player_id) do nothing;
  select * into v_account from public.player_mining_accounts where player_id = p_player_id;
  v_price := public.mining_current_coin_price();
  select coalesce(sum(case when rig_type = 'industrial' then 4 else 1 end), 0)::integer
    into v_used_slots from public.player_mining_rigs where player_id = p_player_id and installed;

  return jsonb_build_object(
    'locked', false,
    'money', v_player.money,
    'coin_balance', v_account.coin_balance,
    'coin_price', v_price,
    'site_slots', v_account.site_slots,
    'used_slots', v_used_slots,
    'farm_slot_price', 250000,
    'components', coalesce((
      select jsonb_object_agg(item_id, quantity)
      from public.player_mining_inventory where player_id = p_player_id and quantity > 0
    ), '{}'::jsonb),
    'rigs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'rig_type', r.rig_type,
        'gpu_count', r.gpu_count,
        'gpu_slots', case when r.rig_type = 'gpu_farm' then 4 else 0 end,
        'installed', r.installed,
        'is_running', r.is_running,
        'site_slots', case when r.rig_type = 'industrial' then 4 else 1 end,
        'coin_per_day', case when r.rig_type = 'gpu_farm' then r.gpu_count * 0.01775
          when r.rig_type = 'asic' then 0.142 else 0.5325 end,
        'power_cost_per_day', case when r.rig_type = 'gpu_farm' then r.gpu_count * 1500
          when r.rig_type = 'asic' then 10000 else 36000 end,
        'pending_coin', case when r.is_running then round((case when r.rig_type = 'gpu_farm' then r.gpu_count * 0.01775
          when r.rig_type = 'asic' then 0.142 else 0.5325 end) * least(43200,
          greatest(0, extract(epoch from (v_now - r.last_settled_at)))) / 86400, 8) else 0 end,
        'pending_power', case when r.is_running then floor((case when r.rig_type = 'gpu_farm' then r.gpu_count * 1500
          when r.rig_type = 'asic' then 10000 else 36000 end) * least(43200,
          greatest(0, extract(epoch from (v_now - r.last_settled_at)))) / 86400) else 0 end,
        'last_settled_at', r.last_settled_at,
        'created_at', r.created_at
      ) order by r.created_at desc)
      from public.player_mining_rigs r where r.player_id = p_player_id
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'transaction_type', t.transaction_type,
        'coin_amount', t.coin_amount,
        'coin_price', t.coin_price,
        'gross_money', t.gross_money,
        'tax_amount', t.tax_amount,
        'net_money', t.net_money,
        'electricity_paid', t.electricity_paid,
        'created_at', t.created_at
      ) order by t.created_at desc)
      from (select * from public.mining_transactions where player_id = p_player_id order by created_at desc limit 10) t
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.mining_action_rpc(
  p_player_id uuid,
  p_action text,
  p_item_id text default null,
  p_rig_id uuid default null,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_player public.players;
  v_rig public.player_mining_rigs;
  v_quantity integer := greatest(1, least(coalesce(p_quantity, 1), 4));
  v_cost bigint;
  v_item text;
  v_used_slots integer;
  v_slot_cost integer;
  v_site_slots integer;
  v_gpu_count integer;
  v_action_result jsonb;
begin
  select * into v_player from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;
  if coalesce(v_player.is_banned, false) then return jsonb_build_object('error', 'Аккаунт заблокирован'); end if;
  if coalesce(v_player.player_level, 1) < 10 then return jsonb_build_object('error', 'Майнинг откроется с 10 уровня'); end if;
  insert into public.player_mining_accounts(player_id) values (p_player_id) on conflict (player_id) do nothing;

  if p_action = 'buy_component' then
    v_item := p_item_id;
    v_cost := case v_item
      when 'gpu_frame' then 40000
      when 'gpu_motherboard' then 55000
      when 'gpu_cpu_ram' then 40000
      when 'gpu_power' then 80000
      when 'gpu_cooling' then 35000
      when 'gpu_card' then 125000
      else null end;
    if v_cost is null then return jsonb_build_object('error', 'Такой детали нет в магазине'); end if;
    if v_item <> 'gpu_card' and v_quantity <> 1 then return jsonb_build_object('error', 'Эту деталь можно купить только по одной'); end if;
    v_cost := v_cost * v_quantity;
    if coalesce(v_player.money, 0) < v_cost then return jsonb_build_object('error', 'Недостаточно ₽'); end if;
    update public.players set money = money - v_cost where id = p_player_id returning * into v_player;
    insert into public.player_mining_inventory(player_id, item_id, quantity)
    values (p_player_id, v_item, v_quantity)
    on conflict (player_id, item_id) do update set quantity = player_mining_inventory.quantity + excluded.quantity;
    v_action_result := jsonb_build_object('purchased', v_item, 'quantity', v_quantity, 'cost', v_cost);

  elsif p_action in ('buy_asic', 'buy_industrial') then
    v_cost := case p_action when 'buy_asic' then 2000000 else 7700000 end;
    if coalesce(v_player.money, 0) < v_cost then return jsonb_build_object('error', 'Недостаточно ₽'); end if;
    update public.players set money = money - v_cost where id = p_player_id returning * into v_player;
    insert into public.player_mining_rigs(player_id, rig_type)
    values (p_player_id, case p_action when 'buy_asic' then 'asic' else 'industrial' end)
    returning * into v_rig;
    v_action_result := jsonb_build_object('rig_id', v_rig.id, 'cost', v_cost, 'purchased', v_rig.rig_type);

  elsif p_action = 'build_gpu_farm' then
    if exists (
      select 1 from (values ('gpu_frame'), ('gpu_motherboard'), ('gpu_cpu_ram'), ('gpu_power'), ('gpu_cooling')) required(item_id)
      where not exists (select 1 from public.player_mining_inventory i where i.player_id = p_player_id and i.item_id = required.item_id and i.quantity > 0)
    ) then return jsonb_build_object('error', 'Сначала купи все основные детали фермы'); end if;
    update public.player_mining_inventory set quantity = quantity - 1
    where player_id = p_player_id and item_id in ('gpu_frame','gpu_motherboard','gpu_cpu_ram','gpu_power','gpu_cooling');
    insert into public.player_mining_rigs(player_id, rig_type, gpu_count)
    values (p_player_id, 'gpu_farm', 0) returning * into v_rig;
    v_action_result := jsonb_build_object('rig_id', v_rig.id, 'built', true, 'gpu_slots', 4);

  elsif p_action = 'install_gpu' then
    select * into v_rig from public.player_mining_rigs where id = p_rig_id and player_id = p_player_id for update;
    if not found or v_rig.rig_type <> 'gpu_farm' then return jsonb_build_object('error', 'Ферма не найдена'); end if;
    if v_rig.gpu_count >= 4 then return jsonb_build_object('error', 'Все слоты видеокарт заняты'); end if;
    if v_rig.is_running then perform public.mining_settle_player(p_player_id); end if;
    update public.player_mining_inventory set quantity = quantity - 1
    where player_id = p_player_id and item_id = 'gpu_card' and quantity > 0;
    if not found then return jsonb_build_object('error', 'Купи видеокарту в магазине'); end if;
    update public.player_mining_rigs set gpu_count = gpu_count + 1 where id = v_rig.id returning * into v_rig;
    v_action_result := jsonb_build_object('rig_id', v_rig.id, 'gpu_count', v_rig.gpu_count);

  elsif p_action = 'install_rig' then
    select * into v_rig from public.player_mining_rigs where id = p_rig_id and player_id = p_player_id for update;
    if not found then return jsonb_build_object('error', 'Установка не найдена'); end if;
    if v_rig.installed then return jsonb_build_object('error', 'Установка уже размещена'); end if;
    if v_rig.rig_type = 'gpu_farm' and v_rig.gpu_count < 1 then return jsonb_build_object('error', 'Установи минимум одну видеокарту'); end if;
    if coalesce(v_player.money, 0) < (case when v_rig.rig_type = 'gpu_farm' then ceil(v_rig.gpu_count * 750)::bigint when v_rig.rig_type = 'asic' then 5000 else 18000 end) then
      return jsonb_build_object('error', 'Не хватит денег даже на 12 часов электричества');
    end if;
    v_slot_cost := case when v_rig.rig_type = 'industrial' then 4 else 1 end;
    select site_slots into v_site_slots from public.player_mining_accounts where player_id = p_player_id for update;
    select coalesce(sum(case when rig_type = 'industrial' then 4 else 1 end), 0)::integer
      into v_used_slots from public.player_mining_rigs where player_id = p_player_id and installed;
    if v_used_slots + v_slot_cost > v_site_slots then return jsonb_build_object('error', 'На площадке нет места. Расширь площадку в магазине'); end if;
    update public.player_mining_rigs set installed = true, is_running = true, last_settled_at = clock_timestamp() where id = v_rig.id;
    v_action_result := jsonb_build_object('rig_id', v_rig.id, 'installed', true, 'is_running', true);

  elsif p_action in ('turn_on', 'turn_off') then
    select * into v_rig from public.player_mining_rigs where id = p_rig_id and player_id = p_player_id for update;
    if not found or not v_rig.installed then return jsonb_build_object('error', 'Сначала установи ферму на площадке'); end if;
    if p_action = 'turn_off' then
      perform public.mining_settle_player(p_player_id);
      update public.player_mining_rigs set is_running = false, last_settled_at = clock_timestamp() where id = v_rig.id;
      v_action_result := jsonb_build_object('rig_id', v_rig.id, 'is_running', false);
    else
      if v_rig.rig_type = 'gpu_farm' and v_rig.gpu_count < 1 then return jsonb_build_object('error', 'Установи минимум одну видеокарту'); end if;
      if v_player.money < (case when v_rig.rig_type = 'gpu_farm' then ceil(v_rig.gpu_count * 750)::bigint when v_rig.rig_type = 'asic' then 5000 else 18000 end) then
        return jsonb_build_object('error', 'Не хватит ₽ даже на 12 часов электричества');
      end if;
      update public.player_mining_rigs set is_running = true, last_settled_at = clock_timestamp() where id = v_rig.id;
      v_action_result := jsonb_build_object('rig_id', v_rig.id, 'is_running', true);
    end if;

  elsif p_action = 'uninstall_rig' then
    select * into v_rig from public.player_mining_rigs where id = p_rig_id and player_id = p_player_id for update;
    if not found or not v_rig.installed then return jsonb_build_object('error', 'Установка не размещена'); end if;
    perform public.mining_settle_player(p_player_id);
    update public.player_mining_rigs set installed = false, is_running = false, last_settled_at = clock_timestamp() where id = v_rig.id;
    v_action_result := jsonb_build_object('rig_id', v_rig.id, 'installed', false);

  elsif p_action = 'expand_site' then
    if coalesce(v_player.money, 0) < 250000 then return jsonb_build_object('error', 'Расширение площадки стоит 250 000 ₽'); end if;
    update public.players set money = money - 250000 where id = p_player_id returning * into v_player;
    update public.player_mining_accounts set site_slots = site_slots + 1 where player_id = p_player_id returning site_slots into v_site_slots;
    v_action_result := jsonb_build_object('site_slots', v_site_slots, 'cost', 250000);

  elsif p_action = 'collect' then
    v_action_result := public.mining_settle_player(p_player_id);
    if v_action_result ? 'error' then return v_action_result; end if;

  else
    return jsonb_build_object('error', 'Неизвестное действие майнинга');
  end if;

  return public.mining_state_rpc(p_player_id) || coalesce(v_action_result, '{}'::jsonb);
end;
$$;

create or replace function public.mining_sell_coin_rpc(p_player_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_player public.players;
  v_account public.player_mining_accounts;
  v_price bigint;
  v_gross bigint;
  v_tax bigint;
  v_net bigint;
  v_tax_exact numeric;
begin
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 8) then
    return jsonb_build_object('error', 'Укажи количество монеты до 8 знаков после запятой');
  end if;
  select * into v_player from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;
  insert into public.player_mining_accounts(player_id) values (p_player_id) on conflict (player_id) do nothing;
  select * into v_account from public.player_mining_accounts where player_id = p_player_id for update;
  if p_amount > v_account.coin_balance then return jsonb_build_object('error', 'Недостаточно монеты'); end if;
  v_price := public.mining_current_coin_price();
  v_gross := floor(p_amount * v_price)::bigint;
  if v_gross <= 0 then return jsonb_build_object('error', 'Сумма продажи слишком мала'); end if;
  v_tax_exact := v_gross * 0.13 + v_account.tax_remainder;
  v_tax := floor(v_tax_exact)::bigint;
  v_net := v_gross - v_tax;
  update public.player_mining_accounts
  set coin_balance = coin_balance - p_amount,
      tax_remainder = v_tax_exact - v_tax
  where player_id = p_player_id;
  update public.players set money = coalesce(money, 0) + v_net where id = p_player_id returning * into v_player;
  insert into public.mining_transactions(
    player_id, transaction_type, coin_amount, coin_price, gross_money, tax_amount, net_money
  ) values (p_player_id, 'sell', -p_amount, v_price, v_gross, v_tax, v_net);

  return public.mining_state_rpc(p_player_id) || jsonb_build_object(
    'sold_coin', p_amount,
    'gross_money', v_gross,
    'tax_amount', v_tax,
    'net_money', v_net
  );
end;
$$;

revoke all on function public.mining_current_coin_price() from public, anon, authenticated;
revoke all on function public.mining_settle_player(uuid) from public, anon, authenticated;
revoke all on function public.mining_state_rpc(uuid) from public, anon, authenticated;
revoke all on function public.mining_action_rpc(uuid,text,text,uuid,integer) from public, anon, authenticated;
revoke all on function public.mining_sell_coin_rpc(uuid,numeric) from public, anon, authenticated;
grant execute on function public.mining_state_rpc(uuid), public.mining_action_rpc(uuid,text,text,uuid,integer),
  public.mining_sell_coin_rpc(uuid,numeric) to service_role;

notify pgrst, 'reload schema';
