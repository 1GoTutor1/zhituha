-- Player professions, XP progression, durable work cycles and stacked inventory.
-- Apply once in Supabase SQL Editor before deploying the matching frontend.

alter table public.players
  add column if not exists player_level integer not null default 1,
  add column if not exists player_xp bigint not null default 0,
  add column if not exists active_profession text not null default 'miner',
  add column if not exists unlocked_professions text[] not null default array['miner']::text[];

alter table public.businesses
  add column if not exists cash_balance bigint not null default 0,
  add column if not exists taxi_owner_cut_percent smallint not null default 30;
alter table public.businesses drop constraint if exists businesses_taxi_owner_cut_percent_check;
alter table public.businesses add constraint businesses_taxi_owner_cut_percent_check
  check (taxi_owner_cut_percent between 0 and 50);

create table if not exists public.profession_items (
  item_id text primary key,
  profession text not null,
  item_name text not null,
  rarity text not null check (rarity in ('common','uncommon','rare','epic')),
  drop_weight integer not null check (drop_weight > 0),
  sell_price bigint not null check (sell_price > 0),
  icon text not null default '📦',
  updated_at timestamptz not null default clock_timestamp()
);

insert into public.profession_items(item_id, profession, item_name, rarity, drop_weight, sell_price, icon) values
  ('stone','miner','Камень','common',55,200,'🪨'),
  ('coal','miner','Уголь','uncommon',30,400,'⚫'),
  ('iron_ore','miner','Железная руда','rare',12,900,'🧱'),
  ('emerald','miner','Изумруд','epic',3,3000,'💎'),
  ('branch','lumberjack','Ветка','common',55,200,'🌿'),
  ('softwood','lumberjack','Мягкая древесина','uncommon',30,400,'🪵'),
  ('hardwood','lumberjack','Твёрдая древесина','rare',12,900,'🪓'),
  ('amber_wood','lumberjack','Янтарное дерево','epic',3,3000,'🌳'),
  ('roach','fisherman','Плотва','common',55,200,'🐟'),
  ('perch','fisherman','Окунь','uncommon',30,400,'🐠'),
  ('pike','fisherman','Щука','rare',12,900,'🐟'),
  ('sturgeon','fisherman','Осётр','epic',3,3000,'🦈'),
  ('potato','farmer','Картофель','common',40,200,'🥔'),
  ('carrot','farmer','Морковь','common',30,300,'🥕'),
  ('corn','farmer','Кукуруза','uncommon',18,550,'🌽'),
  ('strawberry','farmer','Клубника','rare',10,1000,'🍓'),
  ('watermelon','farmer','Арбуз','epic',2,4000,'🍉')
on conflict (item_id) do update set
  profession = excluded.profession, item_name = excluded.item_name,
  rarity = excluded.rarity, drop_weight = excluded.drop_weight,
  sell_price = excluded.sell_price, icon = excluded.icon,
  updated_at = clock_timestamp();

create table if not exists public.player_inventory (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  item_id text not null references public.profession_items(item_id),
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(player_id, item_id)
);
create index if not exists player_inventory_player_idx on public.player_inventory(player_id);

create table if not exists public.profession_cycles (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  profession text not null,
  started_at timestamptz not null default clock_timestamp(),
  completes_at timestamptz not null,
  actions_done smallint not null default 0 check (actions_done between 0 and 3),
  status text not null default 'active' check (status in ('active','completed_pending','completed','cancelled')),
  result jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create unique index if not exists profession_one_active_cycle_per_player
  on public.profession_cycles(player_id) where status = 'active';
create index if not exists profession_cycles_player_created_idx
  on public.profession_cycles(player_id, created_at desc);

-- Drivers choose a car before a shift; it is reserved only during an active cycle.
create table if not exists public.taxi_driver_assignments (
  player_id uuid primary key references public.players(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  car_index integer not null check (car_index >= 0),
  active_cycle_id uuid references public.profession_cycles(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp()
);
create unique index if not exists taxi_car_one_active_driver
  on public.taxi_driver_assignments(business_id, car_index) where active_cycle_id is not null;
alter table public.taxi_driver_assignments enable row level security;
drop policy if exists "no direct taxi driver assignments" on public.taxi_driver_assignments;
create policy "no direct taxi driver assignments" on public.taxi_driver_assignments for all using (false) with check (false);

alter table public.profession_items enable row level security;
alter table public.player_inventory enable row level security;
alter table public.profession_cycles enable row level security;
drop policy if exists "read profession item catalog" on public.profession_items;
create policy "read profession item catalog" on public.profession_items for select using (true);
drop policy if exists "no direct inventory access" on public.player_inventory;
create policy "no direct inventory access" on public.player_inventory for all using (false) with check (false);
drop policy if exists "no direct profession cycle access" on public.profession_cycles;
create policy "no direct profession cycle access" on public.profession_cycles for all using (false) with check (false);

create or replace function public.profession_xp_to_next(p_level integer)
returns bigint language sql immutable as $$
  select (100 + greatest(0, p_level - 1) * 30 + floor(power(greatest(0, p_level - 1)::numeric, 1.5) * 5))::bigint
$$;

create or replace function public.profession_sync_level(p_player_id uuid)
returns public.players language plpgsql security definer as $$
declare p public.players; next_level integer; earned bigint; unlocks text[] := array[]::text[];
begin
  select * into p from public.players where id = p_player_id for update;
  if not found then return null; end if;
  next_level := greatest(1, coalesce(p.player_level, 1));
  earned := greatest(0, coalesce(p.player_xp, 0));
  while earned >= public.profession_xp_to_next(next_level) loop
    earned := earned - public.profession_xp_to_next(next_level);
    next_level := next_level + 1;
  end loop;
  if next_level >= 3 then unlocks := unlocks || 'lumberjack'; end if;
  if next_level >= 5 then unlocks := unlocks || 'fisherman'; end if;
  if next_level >= 7 then unlocks := unlocks || 'farmer'; end if;
  if next_level >= 9 then unlocks := unlocks || 'courier'; end if;
  if next_level >= 12 then unlocks := unlocks || 'taxi'; end if;
  update public.players set player_level = next_level, player_xp = earned,
    unlocked_professions = (array['miner']::text[] || unlocks)
    where id = p_player_id returning * into p;
  return p;
end $$;

create or replace function public.profession_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare p public.players; c public.profession_cycles;
begin
  select * into p from public.players where id = p_player_id;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  select * into c from public.profession_cycles where player_id = p_player_id and status = 'active'
    order by created_at desc limit 1;
  return jsonb_build_object(
    'level', p.player_level, 'xp', p.player_xp,
    'xp_to_next', public.profession_xp_to_next(p.player_level),
    'profession', p.active_profession, 'unlocked', p.unlocked_professions,
    'active_cycle', case when c.id is null then null else jsonb_build_object(
      'id', c.id, 'profession', c.profession, 'started_at', c.started_at,
      'completes_at', c.completes_at, 'actions_done', c.actions_done) end,
    'pending_reward', (select result from public.profession_cycles where player_id=p_player_id and status='completed_pending' order by created_at desc limit 1),
    'inventory', coalesce((select jsonb_agg(jsonb_build_object(
      'item_id', i.item_id, 'item_name', d.item_name, 'rarity', d.rarity,
      'quantity', i.quantity, 'sell_price', d.sell_price, 'icon', d.icon)
      order by case d.rarity when 'epic' then 4 when 'rare' then 3 when 'uncommon' then 2 else 1 end desc, d.item_name)
      from public.player_inventory i join public.profession_items d using(item_id)
      where i.player_id = p_player_id and i.quantity > 0), '[]'::jsonb),
    'inventory_slots', (select count(*)::int from public.player_inventory where player_id = p_player_id and quantity > 0),
    'inventory_capacity', 200);
end $$;

create or replace function public.select_profession_rpc(p_player_id uuid, p_profession text)
returns jsonb language plpgsql security definer as $$
declare p public.players;
begin
  if p_profession not in ('miner','lumberjack','fisherman','farmer','courier','taxi') then
    return jsonb_build_object('error','Неизвестная профессия');
  end if;
  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if exists(select 1 from public.profession_cycles where player_id=p_player_id and status='completed_pending') then
    return jsonb_build_object('error','Сначала выбери, что сделать с выпавшим предметом','pending_reward',
      (select result from public.profession_cycles where player_id=p_player_id and status='completed_pending' order by created_at desc limit 1));
  end if;
  if not p_profession = any(coalesce(p.unlocked_professions, array['miner']::text[])) then
    return jsonb_build_object('error','Профессия ещё не открыта');
  end if;
  if p_profession = 'taxi' and not exists (
    select 1 from public.business_workers w join public.businesses b on b.id = w.business_id
    where w.player_id = p_player_id and w.role = 'Водитель' and b.biz_type = 'taxi'
  ) then return jsonb_build_object('error','Чтобы работать таксистом, устройся водителем в таксопарк'); end if;
  update public.players set active_profession = p_profession where id = p_player_id;
  return jsonb_build_object('success',true,'profession',p_profession);
end $$;

create or replace function public.taxi_fleet_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare b public.businesses; cars jsonb; selected integer;
begin
  select x.* into b from public.business_workers w join public.businesses x on x.id=w.business_id
    where w.player_id=p_player_id and w.role='Водитель' and x.biz_type='taxi' limit 1;
  if not found then return jsonb_build_object('business_id',null,'cars','[]'::jsonb,'selected_car_index',null); end if;
  cars := case when jsonb_typeof(b.stock->'taxi_cars')='array' then b.stock->'taxi_cars' else '[]'::jsonb end;
  select car_index into selected from public.taxi_driver_assignments where player_id=p_player_id;
  return jsonb_build_object('business_id',b.id,'selected_car_index',selected,
    'cars',coalesce((select jsonb_agg(jsonb_build_object('car_index',v.position-1,
      'model',v.car->>'model','health',coalesce((v.car->>'health')::int,0),
      'busy',a.active_cycle_id is not null and a.player_id<>p_player_id,
      'selected',v.position-1=selected) order by v.position)
      from jsonb_array_elements(cars) with ordinality v(car,position)
      left join public.taxi_driver_assignments a on a.business_id=b.id and a.car_index=v.position-1),'[]'::jsonb));
end $$;

create or replace function public.select_taxi_car_rpc(p_player_id uuid, p_car_index integer)
returns jsonb language plpgsql security definer as $$
declare b public.businesses; car jsonb;
begin
  if p_car_index<0 then return jsonb_build_object('error','Некорректная машина'); end if;
  if exists(select 1 from public.profession_cycles where player_id=p_player_id and status='active') then
    return jsonb_build_object('error','Сначала заверши текущую смену');
  end if;
  select x.* into b from public.business_workers w join public.businesses x on x.id=w.business_id
    where w.player_id=p_player_id and w.role='Водитель' and x.biz_type='taxi' limit 1;
  if not found then return jsonb_build_object('error','Сначала устройся водителем в таксопарк'); end if;
  car := b.stock->'taxi_cars'->p_car_index;
  if car is null or coalesce((car->>'health')::int,0)<=0 then
    return jsonb_build_object('error','Эта машина недоступна или требует ремонта'); end if;
  if exists(select 1 from public.taxi_driver_assignments a where a.business_id=b.id and a.car_index=p_car_index
      and a.active_cycle_id is not null and a.player_id<>p_player_id) then
    return jsonb_build_object('error','Эта машина сейчас занята'); end if;
  insert into public.taxi_driver_assignments(player_id,business_id,car_index)
    values(p_player_id,b.id,p_car_index)
    on conflict(player_id) do update set business_id=excluded.business_id,car_index=excluded.car_index,
      updated_at=clock_timestamp();
  return jsonb_build_object('success',true,'fleet',public.taxi_fleet_rpc(p_player_id));
end $$;

create or replace function public.start_profession_cycle_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare p public.players; active public.profession_cycles; slots integer;
begin
  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if exists(select 1 from public.profession_cycles where player_id=p_player_id and status='completed_pending') then
    return jsonb_build_object('error','Сначала выбери, что сделать с выпавшим предметом','pending_reward',
      (select result from public.profession_cycles where player_id=p_player_id and status='completed_pending' order by created_at desc limit 1));
  end if;
  select * into active from public.profession_cycles where player_id = p_player_id and status = 'active'
    order by created_at desc limit 1;
  if found then return jsonb_build_object('error','Сначала заверши текущее действие','active_cycle',jsonb_build_object(
    'id',active.id,'profession',active.profession,'started_at',active.started_at,
    'completes_at',active.completes_at,'actions_done',active.actions_done)); end if;
  if not p.active_profession = any(coalesce(p.unlocked_professions,array['miner']::text[])) then
    return jsonb_build_object('error','Эта профессия ещё не открыта'); end if;
  if p.active_profession = 'taxi' and not exists (
    select 1 from public.business_workers w join public.businesses b on b.id = w.business_id
    where w.player_id = p_player_id and w.role = 'Водитель' and b.biz_type = 'taxi'
  ) then return jsonb_build_object('error','Нужно устроиться водителем в таксопарк'); end if;
  if p.active_profession in ('miner','lumberjack','fisherman','farmer') then
    select count(*) into slots from public.player_inventory where player_id = p_player_id and quantity > 0;
    if slots >= 200 then return jsonb_build_object('error','Инвентарь заполнен (200/200). Освободи слот перед работой','inventory_full',true); end if;
  end if;
  insert into public.profession_cycles(player_id,profession,completes_at)
    values(p_player_id,p.active_profession,clock_timestamp()+interval '30 seconds') returning * into active;
  return jsonb_build_object('success',true,'active_cycle',jsonb_build_object(
    'id',active.id,'profession',active.profession,'started_at',active.started_at,
    'completes_at',active.completes_at,'actions_done',active.actions_done));
end $$;

create or replace function public.profession_step_rpc(p_player_id uuid, p_step smallint)
returns jsonb language plpgsql security definer as $$
declare c public.profession_cycles;
begin
  if p_step not between 1 and 3 then return jsonb_build_object('error','Недопустимый этап'); end if;
  select * into c from public.profession_cycles where player_id = p_player_id and status = 'active'
    order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('error','Активное действие не найдено'); end if;
  if p_step <> c.actions_done + 1 then return jsonb_build_object('error','Этап уже пройден или нарушен порядок'); end if;
  update public.profession_cycles set actions_done = p_step where id = c.id;
  return jsonb_build_object('success',true,'actions_done',p_step,'completes_at',c.completes_at);
end $$;

create or replace function public.finish_profession_cycle_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare p public.players; c public.profession_cycles; d public.profession_items;
  total_weight integer; roll integer; reward_cash bigint := 0; xp_gain bigint := 25;
  next_state public.players; slots integer; result_json jsonb;
  taxi_worker public.business_workers; taxi_biz public.businesses; taxi_car jsonb;
  taxi_fare bigint; taxi_cut bigint;
begin
  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  select * into c from public.profession_cycles where player_id = p_player_id and status = 'active'
    order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('error','Нет действия для завершения'); end if;
  if c.actions_done < 3 then return jsonb_build_object('error','Заверши все три этапа'); end if;
  if clock_timestamp() < c.completes_at then return jsonb_build_object('error','Работа ещё выполняется',
    'remaining_seconds',greatest(0,ceil(extract(epoch from (c.completes_at-clock_timestamp())))::int)); end if;

  if c.profession in ('miner','lumberjack','fisherman','farmer') then
    select count(*) into slots from public.player_inventory where player_id = p_player_id and quantity > 0;
    if slots >= 200 then return jsonb_build_object('error','Инвентарь заполнен (200/200). Освободи слот, чтобы забрать результат','inventory_full',true); end if;
    select sum(drop_weight)::int into total_weight from public.profession_items where profession = c.profession;
    roll := floor(random()*total_weight)::int;
    select * into d from (
      select di.*, sum(di.drop_weight) over(order by di.item_id) - di.drop_weight as lower_bound
      from public.profession_items di where di.profession = c.profession
    ) weighted where roll >= lower_bound order by lower_bound desc limit 1;
  elsif c.profession = 'courier' then
    reward_cash := 380 + floor(random()*121)::bigint;
  elsif c.profession = 'taxi' then
    select w.* into taxi_worker from public.business_workers w
      join public.businesses b on b.id=w.business_id
      where w.player_id=p_player_id and w.role in ('Водитель','Р’РѕРґРёС‚РµР»СЊ') and b.biz_type='taxi'
      order by w.created_at limit 1;
    if taxi_worker.id is null then return jsonb_build_object('error','Нужно устроиться водителем в таксопарк'); end if;
    select * into taxi_biz from public.businesses where id=taxi_worker.business_id for update;
    select c.car into taxi_car from jsonb_array_elements(coalesce(taxi_biz.stock->'taxi_cars','[]'::jsonb)) with ordinality as c(car,position)
      where coalesce((c.car->>'health')::int,0)>0 order by c.position limit 1;
    if taxi_car is null then return jsonb_build_object('error','В таксопарке нет исправной машины'); end if;
    taxi_fare := case when coalesce(taxi_car->>'class', taxi_car->>'model') in ('business','bmw','mercedes') then 900
      when coalesce(taxi_car->>'class', taxi_car->>'model') in ('comfort','toyota','camry') then 700 else 500 end;
    taxi_cut := floor(taxi_fare * coalesce(taxi_biz.taxi_owner_cut_percent,30) / 100.0);
    reward_cash := taxi_fare-taxi_cut;
    update public.businesses set cash_balance=coalesce(cash_balance,0)+taxi_cut where id=taxi_biz.id;
  end if;

  update public.players set money = coalesce(money,0)+reward_cash,
    player_xp = coalesce(player_xp,0)+xp_gain where id = p_player_id;
  next_state := public.profession_sync_level(p_player_id);
  result_json := jsonb_build_object('profession',c.profession,'money',next_state.money,
    'cash_reward',reward_cash,'xp_gained',xp_gain,'level',next_state.player_level,
    'xp',next_state.player_xp,'xp_to_next',public.profession_xp_to_next(next_state.player_level),
    'unlocked',next_state.unlocked_professions,
    'item',case when d.item_id is null then null else jsonb_build_object(
      'item_id',d.item_id,'item_name',d.item_name,'rarity',d.rarity,'sell_price',d.sell_price,'icon',d.icon) end);
  update public.profession_cycles set status=case when d.item_id is null then 'completed' else 'completed_pending' end,
    result=result_json where id=c.id;
  return result_json || jsonb_build_object('pending_reward',d.item_id is not null,'inventory_slots',
    (select count(*)::int from public.player_inventory where player_id=p_player_id and quantity>0));
end $$;

create or replace function public.claim_profession_reward_rpc(p_player_id uuid, p_choice text)
returns jsonb language plpgsql security definer as $$
declare p public.players; c public.profession_cycles; item jsonb; item_key text; d public.profession_items; proceeds bigint:=0;
  slots integer; next_money bigint;
begin
  if p_choice not in ('inventory','sell') then return jsonb_build_object('error','Выбери инвентарь или продажу'); end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  select * into c from public.profession_cycles where player_id=p_player_id and status='completed_pending'
    order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('error','Нет предмета для получения'); end if;
  item := c.result->'item';
  item_key := item->>'item_id';
  select * into d from public.profession_items where item_id=item_key;
  if not found then return jsonb_build_object('error','Предмет больше недоступен'); end if;
  if p_choice='inventory' then
    select count(*) into slots from public.player_inventory where player_id=p_player_id and quantity>0;
    if slots >= 200 and not exists(select 1 from public.player_inventory where player_id=p_player_id and item_id=item_key and quantity>0) then
      return jsonb_build_object('error','Инвентарь заполнен (200/200). Продай предмет или освободи слот');
    end if;
    insert into public.player_inventory(player_id,item_id,quantity) values(p_player_id,item_key,1)
      on conflict(player_id,item_id) do update set quantity=public.player_inventory.quantity+1,updated_at=clock_timestamp();
  else
    proceeds := d.sell_price;
    update public.players set money=coalesce(money,0)+proceeds where id=p_player_id returning money into next_money;
  end if;
  update public.profession_cycles set status='completed' where id=c.id;
  return jsonb_build_object('success',true,'choice',p_choice,'item',item,'proceeds',proceeds,
    'money',coalesce(next_money,p.money),'inventory_slots',
    (select count(*)::int from public.player_inventory where player_id=p_player_id and quantity>0));
end $$;

create or replace function public.sell_inventory_rpc(p_player_id uuid, p_item_id text, p_quantity integer)
returns jsonb language plpgsql security definer as $$
declare p public.players; i public.player_inventory; d public.profession_items; proceeds bigint;
begin
  if p_quantity < 1 or p_quantity > 200 then return jsonb_build_object('error','Некорректное количество'); end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  select * into i from public.player_inventory where player_id=p_player_id and item_id=p_item_id for update;
  if not found or i.quantity < p_quantity then return jsonb_build_object('error','Предмета в инвентаре недостаточно'); end if;
  select * into d from public.profession_items where item_id=p_item_id;
  proceeds := d.sell_price * p_quantity;
  update public.player_inventory set quantity=quantity-p_quantity, updated_at=clock_timestamp() where id=i.id;
  delete from public.player_inventory where id=i.id and quantity=0;
  update public.players set money=coalesce(money,0)+proceeds where id=p_player_id returning * into p;
  return jsonb_build_object('success',true,'money',p.money,'sold',p_quantity,'proceeds',proceeds,
    'inventory_slots',(select count(*)::int from public.player_inventory where player_id=p_player_id and quantity>0));
end $$;

revoke all on function public.profession_state_rpc(uuid) from public, anon, authenticated;
revoke all on function public.select_profession_rpc(uuid,text) from public, anon, authenticated;
revoke all on function public.start_profession_cycle_rpc(uuid) from public, anon, authenticated;
revoke all on function public.profession_step_rpc(uuid,smallint) from public, anon, authenticated;
revoke all on function public.finish_profession_cycle_rpc(uuid) from public, anon, authenticated;
revoke all on function public.sell_inventory_rpc(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.claim_profession_reward_rpc(uuid,text) from public, anon, authenticated;
grant execute on function public.profession_state_rpc(uuid) to service_role;
grant execute on function public.select_profession_rpc(uuid,text) to service_role;
grant execute on function public.start_profession_cycle_rpc(uuid) to service_role;
grant execute on function public.profession_step_rpc(uuid,smallint) to service_role;
grant execute on function public.finish_profession_cycle_rpc(uuid) to service_role;
grant execute on function public.sell_inventory_rpc(uuid,text,integer) to service_role;
grant execute on function public.claim_profession_reward_rpc(uuid,text) to service_role;

create or replace function public.reserve_taxi_car_for_cycle()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.taxi_driver_assignments;
begin
  if new.profession <> 'taxi' then return new; end if;
  select * into a from public.taxi_driver_assignments where player_id=new.player_id for update;
  if not found then raise exception 'Перед сменой выбери машину в таксопарке'; end if;
  update public.taxi_driver_assignments set active_cycle_id=new.id,updated_at=clock_timestamp()
    where player_id=new.player_id;
  return new;
end $$;
drop trigger if exists profession_reserve_taxi_car on public.profession_cycles;
create trigger profession_reserve_taxi_car after insert on public.profession_cycles
  for each row execute function public.reserve_taxi_car_for_cycle();

-- Keep the selected car's fare and the visible car in sync with the legacy payout routine.
do $$
begin
  if to_regprocedure('public.finish_profession_cycle_rpc_legacy(uuid)') is null then
    execute 'alter function public.finish_profession_cycle_rpc(uuid) rename to finish_profession_cycle_rpc_legacy';
  end if;
end $$;
create or replace function public.finish_profession_cycle_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.profession_cycles; a public.taxi_driver_assignments; b public.businesses;
  original_cars jsonb; result jsonb;
begin
  select * into c from public.profession_cycles where player_id=p_player_id and status='active'
    order by created_at desc limit 1;
  if not found or c.profession<>'taxi' then
    return public.finish_profession_cycle_rpc_legacy(p_player_id);
  end if;
  select * into a from public.taxi_driver_assignments where player_id=p_player_id and active_cycle_id=c.id for update;
  if not found then return jsonb_build_object('error','Выбранная машина больше не закреплена за сменой'); end if;
  select * into b from public.businesses where id=a.business_id for update;
  original_cars := case when jsonb_typeof(b.stock->'taxi_cars')='array' then b.stock->'taxi_cars' else '[]'::jsonb end;
  if a.car_index>=jsonb_array_length(original_cars) then return jsonb_build_object('error','Выбранная машина больше недоступна'); end if;
  update public.businesses set stock=jsonb_set(coalesce(stock,'{}'::jsonb),'{taxi_cars}',(
    select jsonb_agg(x.car order by (x.position=a.car_index+1) desc,x.position)
    from jsonb_array_elements(original_cars) with ordinality x(car,position))) where id=b.id;
  result := public.finish_profession_cycle_rpc_legacy(p_player_id);
  if not coalesce(result ? 'error',false) then
    original_cars := (select jsonb_agg(
      case when x.position=a.car_index+1 then jsonb_set(x.car,'{health}',
        to_jsonb(greatest(0,coalesce((x.car->>'health')::int,100)-1))) else x.car end
      order by x.position)
      from jsonb_array_elements(original_cars) with ordinality x(car,position));
  end if;
  update public.businesses set stock=jsonb_set(coalesce(stock,'{}'::jsonb),'{taxi_cars}',coalesce(original_cars,'[]'::jsonb)) where id=b.id;
  if not coalesce(result ? 'error',false) then
    update public.taxi_driver_assignments set active_cycle_id=null,updated_at=clock_timestamp()
      where player_id=p_player_id and active_cycle_id=c.id;
  end if;
  return result;
end $$;

revoke all on function public.taxi_fleet_rpc(uuid),public.select_taxi_car_rpc(uuid,integer),
  public.reserve_taxi_car_for_cycle() from public,anon,authenticated;
revoke all on function public.finish_profession_cycle_rpc_legacy(uuid) from public,anon,authenticated;
revoke all on function public.finish_profession_cycle_rpc(uuid) from public,anon,authenticated;
grant execute on function public.taxi_fleet_rpc(uuid),public.select_taxi_car_rpc(uuid,integer),
  public.finish_profession_cycle_rpc(uuid) to service_role;

-- Keep the existing employee wage action, but award the same fixed XP as a profession cycle.
do $$
begin
  if to_regprocedure('public.work_rpc_legacy(uuid)') is null then
    execute 'alter function public.work_rpc(uuid) rename to work_rpc_legacy';
  end if;
end $$;
create or replace function public.work_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; p public.players;
begin
  result := public.work_rpc_legacy(p_player_id);
  if result ? 'error' then return result; end if;
  update public.players set player_xp=coalesce(player_xp,0)+25 where id=p_player_id;
  p := public.profession_sync_level(p_player_id);
  return result || jsonb_build_object('xp_gained',25,'level',p.player_level,'xp',p.player_xp,
    'xp_to_next',public.profession_xp_to_next(p.player_level),'unlocked',p.unlocked_professions);
end $$;
revoke all on function public.work_rpc_legacy(uuid) from public,anon,authenticated;
revoke all on function public.work_rpc(uuid) from public,anon,authenticated;
grant execute on function public.work_rpc(uuid) to service_role;
