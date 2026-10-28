-- Bank: account, deposits, shares, secured loans, and shared market quotes.
-- Run once in Supabase SQL Editor after deploying the matching application code.

create table if not exists public.bank_accounts (
  player_id uuid primary key references public.players(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bank_deposits (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  principal bigint not null check (principal > 0),
  rate_bps int not null,
  term_hours int not null,
  maturity_at timestamptz not null,
  status text not null default 'active' check (status in ('active','claimed','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists bank_deposits_player_status_idx on public.bank_deposits(player_id, status, maturity_at);

create table if not exists public.bank_stock_quotes (
  symbol text primary key check (symbol in ('coffee_beans','auto_parts','building_materials')),
  title text not null,
  price bigint not null default 500 check (price >= 100),
  previous_price bigint not null default 500,
  updated_at timestamptz not null default now()
);

create table if not exists public.bank_stock_ticks (
  id bigint generated always as identity primary key,
  symbol text not null references public.bank_stock_quotes(symbol) on delete cascade,
  price bigint not null check (price >= 100),
  created_at timestamptz not null default now()
);
create index if not exists bank_stock_ticks_symbol_time_idx on public.bank_stock_ticks(symbol, created_at desc);

create table if not exists public.bank_stock_holdings (
  player_id uuid not null references public.players(id) on delete cascade,
  symbol text not null references public.bank_stock_quotes(symbol),
  shares bigint not null default 0 check (shares >= 0),
  cost_basis numeric(30,6) not null default 0 check (cost_basis >= 0),
  realized_profit numeric(30,6) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (player_id, symbol)
);

create table if not exists public.bank_loans (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  collateral_type text not null check (collateral_type in ('car','house')),
  collateral_model text not null,
  collateral_value bigint not null check (collateral_value > 0),
  principal bigint not null check (principal > 0),
  amount_due bigint not null check (amount_due >= 0),
  due_at timestamptz not null,
  grace_until timestamptz not null,
  status text not null default 'active' check (status in ('active','paid','foreclosed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists bank_loans_player_status_idx on public.bank_loans(player_id, status, due_at);

create table if not exists public.bank_transactions (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  operation text not null,
  amount bigint not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists bank_transactions_player_time_idx on public.bank_transactions(player_id, created_at desc);

create table if not exists public.bank_sector_events (
  id bigint generated always as identity primary key,
  sector text not null check (sector in ('coffee_beans','auto_parts','building_materials')),
  quantity numeric not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);
create index if not exists bank_sector_events_time_idx on public.bank_sector_events(sector, created_at desc);

alter table public.bank_accounts enable row level security;
alter table public.bank_deposits enable row level security;
alter table public.bank_stock_quotes enable row level security;
alter table public.bank_stock_ticks enable row level security;
alter table public.bank_stock_holdings enable row level security;
alter table public.bank_loans enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.bank_sector_events enable row level security;
revoke all on public.bank_accounts, public.bank_deposits, public.bank_stock_quotes,
  public.bank_stock_ticks, public.bank_stock_holdings, public.bank_loans,
  public.bank_transactions, public.bank_sector_events from public, anon, authenticated;
grant all on public.bank_accounts, public.bank_deposits, public.bank_stock_quotes,
  public.bank_stock_ticks, public.bank_stock_holdings, public.bank_loans,
  public.bank_transactions, public.bank_sector_events to service_role;

insert into public.bank_stock_quotes(symbol, title, price, previous_price) values
  ('coffee_beans','Кофейные зёрна',500,500),
  ('auto_parts','Автозапчасти',500,500),
  ('building_materials','Стройматериалы',500,500)
on conflict (symbol) do nothing;
insert into public.bank_stock_ticks(symbol, price)
select q.symbol, q.price from public.bank_stock_quotes q
where not exists (select 1 from public.bank_stock_ticks t where t.symbol = q.symbol);

create or replace function public.bank_log_business_activity()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare old_stock jsonb; new_stock jsonb; delta numeric;
begin
  old_stock := coalesce(old.stock, '{}'::jsonb);
  new_stock := coalesce(new.stock, '{}'::jsonb);
  if new.biz_type = 'coffee' and coalesce(new.coffee_balance,0) > coalesce(old.coffee_balance,0) then
    delta := coalesce(new.coffee_balance,0) - coalesce(old.coffee_balance,0);
    insert into public.bank_sector_events(sector, quantity)
      values ('coffee_beans', greatest(1, delta / 410.0));
  elsif new.biz_type = 'salon' and coalesce(new.car_order_end,0) > coalesce(old.car_order_end,0) then
    insert into public.bank_sector_events(sector, quantity)
      values ('auto_parts', greatest(1, coalesce((new_stock->>'order_amount')::numeric,1)));
  elsif new.biz_type = 'construction' and coalesce(new.build_end,0) > coalesce(old.build_end,0) then
    insert into public.bank_sector_events(sector, quantity) values ('building_materials', 10);
  end if;
  return new;
end $$;
drop trigger if exists bank_business_activity_log on public.businesses;
create trigger bank_business_activity_log after update on public.businesses
for each row execute function public.bank_log_business_activity();

create or replace function public.bank_reject_pledged_asset_listing()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare source_name text;
begin
  source_name := split_part(new.item_data, ':', 1);
  if source_name='personal' and exists(
    select 1 from public.bank_loans l where l.player_id=new.seller_id and l.amount_due>0
      and l.status in ('active','foreclosed')
      and ((new.item_type='car' and l.collateral_type='car') or (new.item_type='house' and l.collateral_type='house'))
  ) then
    raise exception 'Заложенное имущество нельзя выставить на рынок';
  end if;
  return new;
end $$;
drop trigger if exists bank_pledged_asset_listing_guard on public.market_items;
create trigger bank_pledged_asset_listing_guard before insert on public.market_items
for each row execute function public.bank_reject_pledged_asset_listing();

create or replace function public.bank_get_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare result jsonb;
begin
  if not exists (select 1 from public.players where id = p_player_id) then
    return jsonb_build_object('error','player not found');
  end if;
  insert into public.bank_accounts(player_id) values (p_player_id) on conflict (player_id) do nothing;
  result := jsonb_build_object(
    'wallet', (select money from public.players where id = p_player_id),
    'balance', (select balance from public.bank_accounts where player_id = p_player_id),
    'deposits', coalesce((select jsonb_agg(jsonb_build_object(
      'id',d.id,'principal',d.principal,'rate_bps',d.rate_bps,'term_hours',d.term_hours,
      'maturity_at',d.maturity_at,'status',d.status,'created_at',d.created_at
    ) order by d.created_at desc) from public.bank_deposits d where d.player_id=p_player_id and d.status='active'),'[]'::jsonb),
    'loan', (select to_jsonb(l) from public.bank_loans l where l.player_id=p_player_id and l.status in ('active','foreclosed') and l.amount_due > 0 order by l.created_at desc limit 1),
    'holdings', coalesce((select jsonb_agg(jsonb_build_object(
      'symbol',h.symbol,'shares',h.shares,'price',q.price,'value',h.shares*q.price,
      'cost_basis',h.cost_basis,'realized_profit',h.realized_profit,
      'liquidation_value',floor(h.shares*q.price*0.95)
    ) order by h.symbol) from public.bank_stock_holdings h join public.bank_stock_quotes q using(symbol)
      where h.player_id=p_player_id and (h.shares>0 or h.realized_profit<>0)),'[]'::jsonb),
    'stocks', coalesce((select jsonb_agg(jsonb_build_object(
      'symbol',q.symbol,'title',q.title,'price',q.price,'previous_price',q.previous_price,
      'updated_at',q.updated_at,'history',coalesce((select jsonb_agg(jsonb_build_object('price',t.price,'at',t.created_at) order by t.created_at)
        from (select price,created_at from public.bank_stock_ticks where symbol=q.symbol order by created_at desc limit 60) t),'[]'::jsonb)
    ) order by q.symbol) from public.bank_stock_quotes q),'[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(jsonb_build_object(
      'id',t.id,'operation',t.operation,'amount',t.amount,'details',t.details,'created_at',t.created_at
    ) order by t.created_at desc) from (select * from public.bank_transactions where player_id=p_player_id order by created_at desc limit 30) t),'[]'::jsonb),
    'server_now', clock_timestamp()
  );
  return result;
end $$;

create or replace function public.bank_move_cash_rpc(p_player_id uuid, p_amount bigint, p_direction text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare p public.players; a public.bank_accounts; new_balance bigint; new_wallet bigint;
begin
  if p_amount is null or p_amount < 1 or p_amount > 100000000 then return jsonb_build_object('error','Сумма должна быть от 1 до 100 000 000 ₽'); end if;
  if p_direction is null or p_direction not in ('deposit','withdraw') then return jsonb_build_object('error','Некорректная операция'); end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  insert into public.bank_accounts(player_id) values (p_player_id) on conflict (player_id) do nothing;
  select * into a from public.bank_accounts where player_id=p_player_id for update;
  if p_direction='deposit' then
    if coalesce(p.money,0)<p_amount then return jsonb_build_object('error','Недостаточно наличных'); end if;
    update public.players set money=money-p_amount where id=p_player_id returning money into new_wallet;
    update public.bank_accounts set balance=balance+p_amount,updated_at=now() where player_id=p_player_id returning balance into new_balance;
    insert into public.bank_transactions(player_id,operation,amount) values(p_player_id,'cash_deposit',p_amount);
  else
    if a.balance<p_amount then return jsonb_build_object('error','Недостаточно денег на счёте'); end if;
    update public.players set money=money+p_amount where id=p_player_id returning money into new_wallet;
    update public.bank_accounts set balance=balance-p_amount,updated_at=now() where player_id=p_player_id returning balance into new_balance;
    insert into public.bank_transactions(player_id,operation,amount) values(p_player_id,'cash_withdraw',p_amount);
  end if;
  return jsonb_build_object('balance',new_balance,'wallet',new_wallet);
end $$;

create or replace function public.bank_transfer_rpc(p_player_id uuid, p_recipient_nickname text, p_amount bigint)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare recipient_id uuid; sender_account public.bank_accounts; recipient_account public.bank_accounts;
begin
  if p_amount is null or p_amount < 1 or p_amount > 10000000 then return jsonb_build_object('error','Сумма перевода должна быть от 1 до 10 000 000 ₽'); end if;
  select id into recipient_id from public.players where lower(nickname)=lower(trim(p_recipient_nickname)) limit 1;
  if recipient_id is null then return jsonb_build_object('error','Игрок с таким ником не найден'); end if;
  if recipient_id=p_player_id then return jsonb_build_object('error','Нельзя перевести деньги самому себе'); end if;
  insert into public.bank_accounts(player_id) values(p_player_id),(recipient_id) on conflict (player_id) do nothing;
  perform 1 from public.bank_accounts where player_id in (p_player_id,recipient_id) order by player_id for update;
  select * into sender_account from public.bank_accounts where player_id=p_player_id;
  select * into recipient_account from public.bank_accounts where player_id=recipient_id;
  if sender_account.balance<p_amount then return jsonb_build_object('error','Недостаточно денег на счёте'); end if;
  update public.bank_accounts set balance=balance-p_amount,updated_at=now() where player_id=p_player_id;
  update public.bank_accounts set balance=balance+p_amount,updated_at=now() where player_id=recipient_id;
  insert into public.bank_transactions(player_id,operation,amount,details)
    values (p_player_id,'transfer_out',p_amount,jsonb_build_object('nickname',p_recipient_nickname)),
           (recipient_id,'transfer_in',p_amount,jsonb_build_object('from_player',p_player_id));
  return jsonb_build_object('success',true,'balance',sender_account.balance-p_amount);
end $$;

create or replace function public.bank_open_deposit_rpc(p_player_id uuid, p_amount bigint, p_term_hours int)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare rate int; account public.bank_accounts; deposit_id uuid; maturity timestamptz; active_principal bigint;
begin
  rate := case p_term_hours when 1 then 10 when 6 then 30 when 12 then 50 when 24 then 100 when 72 then 400 when 168 then 1000 else null end;
  if rate is null then return jsonb_build_object('error','Выберите срок от 1 часа: 1, 6, 12, 24, 72 или 168 часов'); end if;
  if p_amount is null or p_amount<1000 or p_amount>1000000 then return jsonb_build_object('error','Вклад должен быть от 1 000 до 1 000 000 ₽'); end if;
  insert into public.bank_accounts(player_id) values(p_player_id) on conflict (player_id) do nothing;
  select * into account from public.bank_accounts where player_id=p_player_id for update;
  if account.balance<p_amount then return jsonb_build_object('error','Недостаточно денег на счёте'); end if;
  select coalesce(sum(principal),0) into active_principal from public.bank_deposits where player_id=p_player_id and status='active';
  if active_principal+p_amount>1000000 then return jsonb_build_object('error','Общий лимит активных вкладов — 1 000 000 ₽'); end if;
  maturity := now()+make_interval(hours=>p_term_hours);
  update public.bank_accounts set balance=balance-p_amount,updated_at=now() where player_id=p_player_id;
  insert into public.bank_deposits(player_id,principal,rate_bps,term_hours,maturity_at)
    values(p_player_id,p_amount,rate,p_term_hours,maturity) returning id into deposit_id;
  insert into public.bank_transactions(player_id,operation,amount,details)
    values(p_player_id,'deposit_open',-p_amount,jsonb_build_object('deposit_id',deposit_id,'term_hours',p_term_hours,'rate_bps',rate));
  return jsonb_build_object('success',true,'deposit_id',deposit_id,'maturity_at',maturity);
end $$;

create or replace function public.bank_close_deposit_rpc(p_player_id uuid, p_deposit_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare d public.bank_deposits; payout bigint; interest bigint; early boolean;
begin
  select * into d from public.bank_deposits where id=p_deposit_id and player_id=p_player_id for update;
  if not found or d.status<>'active' then return jsonb_build_object('error','Активный вклад не найден'); end if;
  early := now()<d.maturity_at;
  interest := case when early then 0 else floor(d.principal*d.rate_bps/10000.0)::bigint end;
  payout := d.principal+interest;
  update public.bank_deposits set status=case when early then 'closed' else 'claimed' end,closed_at=now() where id=d.id;
  update public.bank_accounts set balance=balance+payout,updated_at=now() where player_id=p_player_id;
  insert into public.bank_transactions(player_id,operation,amount,details)
    values(p_player_id,case when early then 'deposit_early_close' else 'deposit_payout' end,payout,jsonb_build_object('deposit_id',d.id,'interest',interest));
  return jsonb_build_object('success',true,'payout',payout,'interest',interest,'early',early);
end $$;

create or replace function public.bank_buy_stock_rpc(p_player_id uuid, p_symbol text, p_shares int)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare q public.bank_stock_quotes; a public.bank_accounts; total bigint;
begin
  if p_shares is null or p_shares<1 or p_shares>10000 then return jsonb_build_object('error','Можно купить от 1 до 10 000 акций'); end if;
  select * into q from public.bank_stock_quotes where symbol=p_symbol for update;
  if not found then return jsonb_build_object('error','Акция не найдена'); end if;
  total := q.price*p_shares;
  select * into a from public.bank_accounts where player_id=p_player_id for update;
  if not found or a.balance<total then return jsonb_build_object('error','Недостаточно денег на банковском счёте'); end if;
  update public.bank_accounts set balance=balance-total,updated_at=now() where player_id=p_player_id;
  insert into public.bank_stock_holdings(player_id,symbol,shares,cost_basis) values(p_player_id,p_symbol,p_shares,total)
    on conflict(player_id,symbol) do update set shares=bank_stock_holdings.shares+excluded.shares,
      cost_basis=bank_stock_holdings.cost_basis+excluded.cost_basis,updated_at=now();
  insert into public.bank_transactions(player_id,operation,amount,details)
    values(p_player_id,'stock_buy',-total,jsonb_build_object('symbol',p_symbol,'shares',p_shares,'price',q.price));
  return jsonb_build_object('success',true,'balance',a.balance-total,'price',q.price,'total',total);
end $$;

create or replace function public.bank_sell_stock_rpc(p_player_id uuid, p_symbol text, p_shares int)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare q public.bank_stock_quotes; h public.bank_stock_holdings; proceeds bigint; sold_cost numeric(30,6);
begin
  if p_shares is null or p_shares<1 or p_shares>10000 then return jsonb_build_object('error','Некорректное количество акций'); end if;
  select * into q from public.bank_stock_quotes where symbol=p_symbol for update;
  if not found then return jsonb_build_object('error','Акция не найдена'); end if;
  select * into h from public.bank_stock_holdings where player_id=p_player_id and symbol=p_symbol for update;
  if not found or h.shares<p_shares then return jsonb_build_object('error','Недостаточно акций'); end if;
  proceeds := floor(q.price*p_shares*0.95)::bigint;
  sold_cost := h.cost_basis*p_shares/h.shares;
  update public.bank_stock_holdings set shares=shares-p_shares,cost_basis=greatest(0,cost_basis-sold_cost),
    realized_profit=realized_profit+proceeds-sold_cost,updated_at=now() where player_id=p_player_id and symbol=p_symbol;
  update public.bank_accounts set balance=balance+proceeds,updated_at=now() where player_id=p_player_id;
  insert into public.bank_transactions(player_id,operation,amount,details)
    values(p_player_id,'stock_sell',proceeds,jsonb_build_object('symbol',p_symbol,'shares',p_shares,'price',q.price,'payout_percent',95));
  return jsonb_build_object('success',true,'proceeds',proceeds,'price',q.price);
end $$;

create or replace function public.bank_apply_loan_rpc(p_player_id uuid, p_collateral_type text, p_amount bigint)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare p public.players; collateral text; collateral_value bigint; loan_id uuid; due timestamptz; loan_total bigint;
begin
  if p_amount is null or p_amount<1000 then return jsonb_build_object('error','Минимальная сумма кредита — 1 000 ₽'); end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if exists(select 1 from public.bank_loans where player_id=p_player_id and status in ('active','foreclosed') and amount_due>0) then
    return jsonb_build_object('error','Сначала погаси текущий кредит');
  end if;
  if p_collateral_type='car' and coalesce(p.has_car,false) then
    collateral := coalesce(p.car_model,'lada');
    collateral_value := coalesce((select v.base_price from public.business_vehicle_catalog v where v.model_id=collateral),case collateral when 'toyota' then 65000 else 35000 end);
  elsif p_collateral_type='house' and coalesce(p.has_house,false) then
    collateral := coalesce(p.house_type,'apartment'); collateral_value := 50000;
  else return jsonb_build_object('error','Выбранное имущество нельзя заложить');
  end if;
  if exists(select 1 from public.market_items where seller_id=p_player_id and
      ((p_collateral_type='car' and item_type='car' and item_data like 'personal:%') or
       (p_collateral_type='house' and item_type='house' and item_data like 'personal:%'))) then
    return jsonb_build_object('error','Сначала сними имущество с рынка');
  end if;
  if p_amount>floor(collateral_value*0.70) then
    return jsonb_build_object('error',format('Под это имущество можно получить максимум %s ₽',floor(collateral_value*0.70)));
  end if;
  insert into public.bank_accounts(player_id) values(p_player_id) on conflict(player_id) do nothing;
  loan_total := p_amount + ceil(p_amount*0.10);
  due := now()+interval '72 hours';
  insert into public.bank_loans(player_id,collateral_type,collateral_model,collateral_value,principal,amount_due,due_at,grace_until)
    values(p_player_id,p_collateral_type,collateral,collateral_value,p_amount,loan_total,due,due+interval '24 hours') returning id into loan_id;
  update public.bank_accounts set balance=balance+p_amount,updated_at=now() where player_id=p_player_id;
  insert into public.bank_transactions(player_id,operation,amount,details)
    values(p_player_id,'loan_issued',p_amount,jsonb_build_object('loan_id',loan_id,'collateral_type',p_collateral_type,'collateral_model',collateral,'amount_due',loan_total));
  return jsonb_build_object('success',true,'loan_id',loan_id,'balance',(select balance from public.bank_accounts where player_id=p_player_id),
    'amount_due',loan_total,'due_at',due,'grace_until',due+interval '24 hours','collateral_value',collateral_value);
end $$;

create or replace function public.bank_repay_loan_rpc(p_player_id uuid, p_loan_id uuid, p_amount bigint)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare l public.bank_loans; a public.bank_accounts; paid bigint; new_due bigint; new_status text;
begin
  if p_amount is null or p_amount<1 then return jsonb_build_object('error','Укажи сумму погашения'); end if;
  select * into l from public.bank_loans where id=p_loan_id and player_id=p_player_id for update;
  if not found or l.amount_due<=0 or l.status='paid' then return jsonb_build_object('error','Активный долг не найден'); end if;
  select * into a from public.bank_accounts where player_id=p_player_id for update;
  paid := least(p_amount,l.amount_due);
  if a.balance<paid then return jsonb_build_object('error','Недостаточно денег на счёте'); end if;
  new_due := l.amount_due-paid;
  new_status := case when new_due=0 then 'paid' else l.status end;
  update public.bank_accounts set balance=balance-paid,updated_at=now() where player_id=p_player_id;
  update public.bank_loans set amount_due=new_due,status=new_status,closed_at=case when new_due=0 then now() else null end where id=l.id;
  insert into public.bank_transactions(player_id,operation,amount,details)
    values(p_player_id,'loan_repayment',-paid,jsonb_build_object('loan_id',l.id,'remaining',new_due));
  return jsonb_build_object('success',true,'paid',paid,'amount_due',new_due,'status',new_status);
end $$;

create or replace function public.bank_market_tick_rpc()
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare q public.bank_stock_quotes; recent numeric; previous numeric; signal numeric; noise numeric; move_pct numeric; next_price bigint;
  l public.bank_loans; recovered bigint; surplus bigint; p public.players;
begin
  perform pg_advisory_xact_lock(733014522::bigint);
  for q in select * from public.bank_stock_quotes order by symbol for update loop
    select coalesce(sum(quantity),0) into recent from public.bank_sector_events
      where sector=q.symbol and created_at>=now()-interval '60 minutes';
    select coalesce(sum(quantity),0) into previous from public.bank_sector_events
      where sector=q.symbol and created_at>=now()-interval '120 minutes' and created_at<now()-interval '60 minutes';
    signal := greatest(-0.40,least(0.40,((recent-previous)/greatest(previous,5))*0.20));
    noise := 0.20 + random()*49.80;
    move_pct := noise * case when random() < 0.50 + signal then 1 else -1 end;
    next_price := greatest(100,round(q.price*(1+move_pct/100.0))::bigint);
    update public.bank_stock_quotes set previous_price=q.price,price=next_price,updated_at=now() where symbol=q.symbol;
    insert into public.bank_stock_ticks(symbol,price) values(q.symbol,next_price);
  end loop;

  for l in select * from public.bank_loans where status='active' and amount_due>0 and grace_until<=now() for update skip locked loop
    select * into p from public.players where id=l.player_id for update;
    recovered := least(l.collateral_value,l.amount_due);
    surplus := greatest(0,l.collateral_value-recovered);
    if l.collateral_type='car' then
      update public.players set has_car=false,car_model='none' where id=l.player_id;
    else
      update public.players set has_house=false,house_type='none' where id=l.player_id;
    end if;
    if surplus>0 then
      insert into public.bank_accounts(player_id) values(l.player_id) on conflict(player_id) do nothing;
      update public.bank_accounts set balance=balance+surplus,updated_at=now() where player_id=l.player_id;
    end if;
    update public.bank_loans set amount_due=greatest(0,amount_due-l.collateral_value),status='foreclosed',closed_at=now() where id=l.id;
    insert into public.bank_transactions(player_id,operation,amount,details)
      values(l.player_id,'loan_foreclosure',surplus,jsonb_build_object('loan_id',l.id,'collateral_type',l.collateral_type,'recovered',recovered));
  end loop;
  delete from public.bank_sector_events where created_at<now()-interval '7 days';
  delete from public.bank_stock_ticks where created_at<now()-interval '30 days';
  return jsonb_build_object('success',true);
end $$;

create extension if not exists pg_cron;
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='bank-market-minute-tick';
    perform cron.schedule('bank-market-minute-tick','* * * * *','select public.bank_market_tick_rpc();');
  end if;
end $$;

revoke all on function public.bank_get_state_rpc(uuid), public.bank_move_cash_rpc(uuid,bigint,text),
  public.bank_transfer_rpc(uuid,text,bigint), public.bank_open_deposit_rpc(uuid,bigint,int),
  public.bank_close_deposit_rpc(uuid,uuid), public.bank_buy_stock_rpc(uuid,text,int),
  public.bank_sell_stock_rpc(uuid,text,int), public.bank_apply_loan_rpc(uuid,text,bigint),
  public.bank_repay_loan_rpc(uuid,uuid,bigint), public.bank_market_tick_rpc()
  from public, anon, authenticated;
grant execute on function public.bank_get_state_rpc(uuid), public.bank_move_cash_rpc(uuid,bigint,text),
  public.bank_transfer_rpc(uuid,text,bigint), public.bank_open_deposit_rpc(uuid,bigint,int),
  public.bank_close_deposit_rpc(uuid,uuid), public.bank_buy_stock_rpc(uuid,text,int),
  public.bank_sell_stock_rpc(uuid,text,int), public.bank_apply_loan_rpc(uuid,text,bigint),
  public.bank_repay_loan_rpc(uuid,uuid,bigint), public.bank_market_tick_rpc() to service_role;
