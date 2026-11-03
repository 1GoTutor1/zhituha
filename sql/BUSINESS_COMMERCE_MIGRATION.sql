-- Player-facing shops for coffee shops and minimarkets.
-- Apply after PROFESSIONS_INVENTORY_MIGRATION.sql and BUSINESS_LOCATIONS_MIGRATION.sql.

alter table public.players add column if not exists car_health smallint not null default 100
  check (car_health between 0 and 100);

create or replace function public.reset_personal_car_condition()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.has_car and (not coalesce(old.has_car,false) or new.car_model is distinct from old.car_model) then
    new.car_health:=100;
  end if;
  return new;
end $$;
drop trigger if exists players_reset_personal_car_condition on public.players;
create trigger players_reset_personal_car_condition before update of has_car,car_model on public.players
  for each row execute function public.reset_personal_car_condition();

-- Wear the player's personal car by 1% after each completed profession shift.
do $$
begin
  if to_regprocedure('public.finish_profession_cycle_rpc_before_commerce(uuid)') is null then
    execute 'alter function public.finish_profession_cycle_rpc(uuid) rename to finish_profession_cycle_rpc_before_commerce';
  end if;
end $$;
create or replace function public.finish_profession_cycle_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; p public.players;
begin
  result:=public.finish_profession_cycle_rpc_before_commerce(p_player_id);
  if result ? 'error' then return result; end if;
  update public.players set car_health=greatest(0,coalesce(car_health,100)-1)
    where id=p_player_id and coalesce(has_car,false);
  select * into p from public.players where id=p_player_id;
  return result||jsonb_build_object('personal_car_health',coalesce(p.car_health,100));
end $$;

create table if not exists public.business_shop_products (
  product_id text primary key,
  biz_type text not null check (biz_type in ('coffee','minimarket')),
  product_name text not null,
  base_price bigint not null check (base_price > 0),
  wholesale_price bigint not null check (wholesale_price > 0),
  energy_restore smallint not null default 0 check (energy_restore between 0 and 40),
  updated_at timestamptz not null default clock_timestamp()
);

insert into public.business_shop_products(product_id,biz_type,product_name,base_price,wholesale_price,energy_restore) values
  ('coffee_small','coffee','Эспрессо',250,125,10),
  ('coffee_medium','coffee','Капучино',500,250,25),
  ('coffee_large','coffee','Большой латте',800,400,40),
  ('market_snack','minimarket','Перекус',200,100,10),
  ('market_lunch','minimarket','Обед',450,225,25),
  ('market_energy','minimarket','Энергетический напиток',700,350,40)
on conflict (product_id) do update set
  biz_type=excluded.biz_type,product_name=excluded.product_name,
  base_price=excluded.base_price,wholesale_price=excluded.wholesale_price,
  energy_restore=excluded.energy_restore,updated_at=clock_timestamp();

-- Keep the existing database key "lada" for old player saves; in the UI this car is the Oka.
-- The accepted entry-level cost is 35,000 ₽, with a 15 minute supplier order.
create or replace function public.start_car_order_rpc(
  p_biz_id uuid,p_player_id uuid,p_model text,p_amount integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; price bigint; base_ms bigint; end_ms bigint; fine bigint:=0;
  now_ms bigint:=floor(extract(epoch from clock_timestamp())*1000); mech integer; seller integer;
begin
  if p_model not in ('lada','toyota') then return jsonb_build_object('error','bad model'); end if;
  if p_amount is null or p_amount<1 or p_amount>10 then return jsonb_build_object('error','amount 1-10'); end if;
  price:=(case p_model when 'lada' then 35000 else 50000 end)*p_amount;
  base_ms:=case p_model when 'lada' then 900000 else 2700000 end;
  b:=public.assert_owner(p_biz_id,p_player_id);
  if b.biz_type<>'salon' then return jsonb_build_object('error','не автосалон'); end if;
  if coalesce(b.car_order_end,0)>now_ms then return jsonb_build_object('error','уже едут'); end if;
  if public.money_of(p_player_id)<price then return jsonb_build_object('error','мало денег на партию'); end if;
  mech:=public.role_count(p_biz_id,'Механик'); seller:=public.role_count(p_biz_id,'Продавец');
  if mech=0 then return jsonb_build_object('error','Нет механика — заказ не оформить'); end if;
  if seller=0 then base_ms:=base_ms*3; fine:=floor(price*0.10); end if;
  end_ms:=now_ms+base_ms;
  update public.businesses set car_order_end=end_ms,
    stock=jsonb_set(jsonb_set(jsonb_set(coalesce(stock,'{}'::jsonb),'{current_model}',to_jsonb(p_model)),
      '{order_amount}',to_jsonb(p_amount)),'{order_fine}',to_jsonb(fine)) where id=p_biz_id;
  perform public.change_stats(p_player_id,-(price+fine),0);
  return jsonb_build_object('money',(select money from public.players where id=p_player_id),
    'car_order_end',end_ms,'fine',fine);
exception when others then return jsonb_build_object('error','бизнес не твой');
end $$;

create or replace function public.taxi_add_car_rpc(p_biz_id uuid,p_player_id uuid,p_model text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; price bigint; car jsonb; cars jsonb;
begin
  if p_model not in ('lada','toyota') then return jsonb_build_object('error','bad model'); end if;
  price:=case p_model when 'lada' then 35000 else 50000 end;
  b:=public.assert_owner(p_biz_id,p_player_id);
  if b.biz_type<>'taxi' then return jsonb_build_object('error','не таксопарк'); end if;
  cars:=case when jsonb_typeof(b.stock->'taxi_cars')='array' then b.stock->'taxi_cars' else '[]'::jsonb end;
  if jsonb_array_length(cars)>=2 then return jsonb_build_object('error','В таксопарке уже есть две машины'); end if;
  if public.money_of(p_player_id)<price then return jsonb_build_object('error','Не хватает денег на машину'); end if;
  car:=jsonb_build_object('model',p_model,'class',case p_model when 'toyota' then 'comfort' else 'economy' end,
    'health',100,'last_claim',floor(extract(epoch from clock_timestamp())*1000));
  perform public.settle_business_passive(p_biz_id,clock_timestamp());
  update public.businesses set stock=jsonb_set(coalesce(stock,'{}'::jsonb),'{taxi_cars}',cars||car),
    passive_updated_at=clock_timestamp() where id=p_biz_id;
  perform public.change_stats(p_player_id,-price,0);
  return jsonb_build_object('success',true,'money',(select money from public.players where id=p_player_id));
exception when others then return jsonb_build_object('error','не удалось купить машину');
end $$;

create or replace function public.validate_worker_role(
  p_biz_id uuid,p_player_id uuid,p_role text,p_salary integer)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; allowed integer; cnt integer;
begin
  if p_role is null or p_salary is null then return 'Некорректная роль'; end if;
  select * into b from public.businesses where id=p_biz_id and owner_id<>p_player_id;
  if not found then return 'Бизнес не найден'; end if;
  if exists(select 1 from public.business_workers where player_id=p_player_id) then return 'Уже работаешь'; end if;

  if b.biz_type='minimarket' then
    if p_role<>'Кассир' or p_salary<>5 then return 'Кассиру положено 5% с продаж'; end if;
    allowed:=1;
  elsif b.biz_type='auto_repair' then
    if p_role<>'Механик' or p_salary<>3 then return 'Механику положено 3% с ремонта'; end if;
    allowed:=1;
  elsif b.biz_type='coffee' then
    if p_role='Бариста' and p_salary=60 then allowed:=1;
    elsif p_role='Помощник бариста' and p_salary=30 then allowed:=1;
    else return 'Для кофейни выбери доступную вакансию'; end if;
  elsif b.biz_type='salon' then
    if p_role='Механик' and p_salary=3 then allowed:=2;
    elsif p_role='Продавец' and p_salary=5 then allowed:=1;
    else return 'Для автосалона выбери доступную вакансию'; end if;
  elsif b.biz_type='phone_factory' then
    if p_role='Сборщик' and p_salary=10000 then allowed:=2;
    elsif p_role='Инженер' and p_salary=15000 then allowed:=1;
    else return 'Для цеха выбери доступную вакансию'; end if;
  elsif b.biz_type='construction' then
    if p_role='Строитель' and p_salary=10000 then allowed:=3;
    elsif p_role='Прораб' and p_salary=20000 then allowed:=1;
    else return 'Для стройтреста выбери доступную вакансию'; end if;
  elsif b.biz_type='taxi' then
    if p_role='Водитель' and p_salary=10 then allowed:=2;
    elsif p_role='Механик' and p_salary=5 then allowed:=1;
    else return 'Для таксопарка выбери доступную вакансию'; end if;
  else return 'Для этого бизнеса вакансии пока недоступны'; end if;

  select count(*) into cnt from public.business_workers where business_id=p_biz_id and role=p_role;
  if cnt>=allowed then return 'Места заняты ('||allowed||')'; end if;
  return null;
end $$;

create table if not exists public.business_shop_stock (
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id text not null references public.business_shop_products(product_id),
  quantity integer not null default 0 check (quantity >= 0),
  retail_price bigint not null check (retail_price > 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (business_id,product_id)
);

create or replace function public.business_cash_transfer_rpc(
  p_player_id uuid,p_business_id uuid,p_amount bigint,p_direction text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; p public.players; next_cash bigint; next_money bigint;
begin
  if p_amount is null or p_amount<1 or p_amount>10000000 then return jsonb_build_object('error','Сумма должна быть от 1 до 10 000 000 ₽'); end if;
  if p_direction is null or p_direction not in ('deposit','withdraw') then return jsonb_build_object('error','Неизвестная операция'); end if;
  select * into b from public.businesses where id=p_business_id and owner_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Бизнес не найден'); end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if p_direction='deposit' then
    if coalesce(p.money,0)<p_amount then return jsonb_build_object('error','Не хватает личных денег'); end if;
    next_cash:=coalesce(b.cash_balance,0)+p_amount; next_money:=coalesce(p.money,0)-p_amount;
  else
    if coalesce(b.cash_balance,0)<p_amount then return jsonb_build_object('error','В кассе бизнеса не хватает денег'); end if;
    next_cash:=coalesce(b.cash_balance,0)-p_amount; next_money:=coalesce(p.money,0)+p_amount;
  end if;
  update public.businesses set cash_balance=next_cash where id=b.id;
  update public.players set money=next_money where id=p_player_id;
  return jsonb_build_object('success',true,'cash_balance',next_cash,'money',next_money);
end $$;

alter table public.business_shop_products enable row level security;
alter table public.business_shop_stock enable row level security;
revoke all on public.business_shop_products,public.business_shop_stock from public,anon,authenticated;
grant select on public.business_shop_products to service_role;
grant all on public.business_shop_stock to service_role;
drop policy if exists "read shop products" on public.business_shop_products;
create policy "read shop products" on public.business_shop_products for select using (true);
drop policy if exists "block shop product writes" on public.business_shop_products;
create policy "block shop product writes" on public.business_shop_products for all using (false) with check (false);
drop policy if exists "block shop stock access" on public.business_shop_stock;
create policy "block shop stock access" on public.business_shop_stock for all using (false) with check (false);

create or replace function public.business_shop_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return jsonb_build_object(
    'products',coalesce((select jsonb_agg(jsonb_build_object(
      'product_id',p.product_id,'biz_type',p.biz_type,'product_name',p.product_name,
      'base_price',p.base_price,'energy_restore',p.energy_restore)
      order by p.biz_type,p.base_price) from public.business_shop_products p),'[]'::jsonb),
    'shops',coalesce((select jsonb_agg(jsonb_build_object(
      'business_id',b.id,'business_name',b.business_name,'biz_type',b.biz_type,
      'owner_id',b.owner_id,'owner_name',b.owner_name,
      'status',case when not exists(select 1 from public.business_workers w where w.business_id=b.id
          and ((b.biz_type='coffee' and w.role='Бариста') or (b.biz_type='minimarket' and w.role='Кассир')))
        then 'closed_staff' when not exists(select 1 from public.business_shop_stock s where s.business_id=b.id and s.quantity>0)
        then 'closed_stock' else 'open' end,
      'products',coalesce((select jsonb_agg(jsonb_build_object(
        'product_id',p.product_id,'product_name',p.product_name,'base_price',p.base_price,
        'energy_restore',p.energy_restore,
        'quantity',coalesce(s.quantity,0),'retail_price',coalesce(s.retail_price,p.base_price),
        'min_price',ceil(p.base_price*0.75),'max_price',floor(p.base_price*1.25))
        || case when b.owner_id=p_player_id then jsonb_build_object('wholesale_price',p.wholesale_price) else '{}'::jsonb end
        order by p.base_price)
        from public.business_shop_products p left join public.business_shop_stock s
          on s.business_id=b.id and s.product_id=p.product_id
        where p.biz_type=b.biz_type),'[]'::jsonb))
      order by b.business_name)
      from public.businesses b where b.biz_type in ('coffee','minimarket')),'[]'::jsonb),
    'repair_shops',coalesce((select jsonb_agg(jsonb_build_object(
      'business_id',b.id,'business_name',b.business_name,'owner_id',b.owner_id,'owner_name',b.owner_name,
      'status',case when exists(select 1 from public.business_workers w where w.business_id=b.id and w.role='Механик') then 'open' else 'closed_staff' end)
      order by b.business_name) from public.businesses b where b.biz_type='auto_repair'),'[]'::jsonb),
    'personal_car_health',(select car_health from public.players where id=p_player_id)
  );
end $$;

create or replace function public.business_repair_personal_car_rpc(p_player_id uuid,p_shop_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare shop public.businesses; mechanic public.business_workers; p public.players; cost bigint; commission bigint;
begin
  select * into shop from public.businesses where id=p_shop_id and biz_type='auto_repair' for update;
  if not found then return jsonb_build_object('error','Автомастерская не найдена'); end if;
  if shop.owner_id=p_player_id then return jsonb_build_object('error','Нельзя обслуживать собственную машину в своём бизнесе'); end if;
  select * into mechanic from public.business_workers where business_id=shop.id and role='Механик' order by created_at limit 1 for update;
  if not found then return jsonb_build_object('error','Автомастерская закрыта: нет механика'); end if;
  select * into p from public.players where id=p_player_id for update;
  if not found or not coalesce(p.has_car,false) then return jsonb_build_object('error','У тебя нет личной машины'); end if;
  if coalesce(p.car_health,100)>=100 then return jsonb_build_object('error','Машина уже полностью исправна'); end if;
  cost:=coalesce((select v.repair_price from public.business_vehicle_catalog v where v.model_id=p.car_model),case p.car_model when 'lada' then 3000 when 'toyota' then 10000 else 10000 end);
  if coalesce(p.money,0)<cost then return jsonb_build_object('error','Не хватает денег на ремонт'); end if;
  commission:=floor(cost*3/100.0);
  update public.players set money=coalesce(money,0)-cost,car_health=100 where id=p_player_id;
  update public.players set money=coalesce(money,0)+commission where id=mechanic.player_id;
  update public.businesses set cash_balance=coalesce(cash_balance,0)+cost-commission where id=shop.id;
  return jsonb_build_object('success',true,'cost',cost,'commission',commission,'money',p.money-cost,'car_health',100);
end $$;

create or replace function public.business_repair_taxi_car_rpc(
  p_player_id uuid,p_shop_id uuid,p_taxi_business_id uuid,p_car_index integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare shop public.businesses; fleet public.businesses; mechanic public.business_workers; cars jsonb; car jsonb;
  cost bigint; commission bigint; next_cash bigint;
begin
  if p_car_index is null or p_car_index<0 then return jsonb_build_object('error','Некорректная машина'); end if;
  select * into shop from public.businesses where id=p_shop_id and biz_type='auto_repair' for update;
  if not found then return jsonb_build_object('error','Автомастерская не найдена'); end if;
  if shop.owner_id=p_player_id then return jsonb_build_object('error','Выбери чужую автомастерскую'); end if;
  select * into mechanic from public.business_workers where business_id=shop.id and role='Механик' order by created_at limit 1 for update;
  if not found then return jsonb_build_object('error','Автомастерская закрыта: нет механика'); end if;
  select * into fleet from public.businesses where id=p_taxi_business_id and owner_id=p_player_id and biz_type='taxi' for update;
  if not found then return jsonb_build_object('error','Таксопарк не найден'); end if;
  cars:=coalesce(fleet.stock->'taxi_cars','[]'::jsonb);
  if p_car_index>=jsonb_array_length(cars) then return jsonb_build_object('error','Машина не найдена'); end if;
  car:=cars->p_car_index;
  if coalesce((car->>'health')::integer,0)>=100 then return jsonb_build_object('error','Машина уже полностью исправна'); end if;
  cost:=coalesce((select v.repair_price from public.business_vehicle_catalog v where v.model_id=car->>'model'),case car->>'model' when 'lada' then 3000 when 'toyota' then 10000 else 10000 end);
  if coalesce(fleet.cash_balance,0)<cost then return jsonb_build_object('error','В кассе таксопарка не хватает денег'); end if;
  commission:=floor(cost*3/100.0); next_cash:=coalesce(fleet.cash_balance,0)-cost;
  cars:=jsonb_set(cars,array[p_car_index::text],jsonb_set(car,'{health}','100'::jsonb));
  update public.businesses set stock=jsonb_set(coalesce(stock,'{}'::jsonb),'{taxi_cars}',cars),cash_balance=next_cash where id=fleet.id;
  update public.players set money=coalesce(money,0)+commission where id=mechanic.player_id;
  update public.businesses set cash_balance=coalesce(cash_balance,0)+cost-commission where id=shop.id;
  return jsonb_build_object('success',true,'cost',cost,'commission',commission,'cash_balance',next_cash,'cars',cars);
end $$;

create or replace function public.business_shop_restock_rpc(
  p_player_id uuid,p_business_id uuid,p_product_id text,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; product public.business_shop_products; cost bigint; new_quantity integer;
begin
  if p_quantity not between 1 and 500 then return jsonb_build_object('error','За один раз можно закупить от 1 до 500 единиц'); end if;
  select * into b from public.businesses where id=p_business_id and owner_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Бизнес не найден'); end if;
  select * into product from public.business_shop_products where product_id=p_product_id and biz_type=b.biz_type;
  if not found then return jsonb_build_object('error','Товар не продаётся в этом типе бизнеса'); end if;
  cost:=product.wholesale_price*p_quantity;
  if coalesce(b.cash_balance,0)<cost then return jsonb_build_object('error','В кассе бизнеса не хватает денег на оптовую закупку'); end if;
  insert into public.business_shop_stock(business_id,product_id,quantity,retail_price)
    values(b.id,product.product_id,p_quantity,product.base_price)
    on conflict(business_id,product_id) do update set
      quantity=public.business_shop_stock.quantity+excluded.quantity,updated_at=clock_timestamp();
  update public.businesses set cash_balance=coalesce(cash_balance,0)-cost where id=b.id;
  select quantity into new_quantity from public.business_shop_stock where business_id=b.id and product_id=product.product_id;
  return jsonb_build_object('success',true,'cost',cost,'quantity',new_quantity,'cash_balance',b.cash_balance-cost);
end $$;

create or replace function public.business_shop_set_price_rpc(
  p_player_id uuid,p_business_id uuid,p_product_id text,p_price bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; product public.business_shop_products; new_price bigint;
begin
  select * into b from public.businesses where id=p_business_id and owner_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Бизнес не найден'); end if;
  select * into product from public.business_shop_products where product_id=p_product_id and biz_type=b.biz_type;
  if not found then return jsonb_build_object('error','Товар не найден'); end if;
  if p_price<ceil(product.base_price*0.75) or p_price>floor(product.base_price*1.25) then
    return jsonb_build_object('error',format('Цена должна быть от %s до %s ₽',ceil(product.base_price*0.75),floor(product.base_price*1.25)));
  end if;
  insert into public.business_shop_stock(business_id,product_id,quantity,retail_price)
    values(b.id,product.product_id,0,p_price)
    on conflict(business_id,product_id) do update set retail_price=excluded.retail_price,updated_at=clock_timestamp();
  return jsonb_build_object('success',true,'retail_price',p_price);
end $$;

create or replace function public.business_shop_buy_rpc(
  p_player_id uuid,p_business_id uuid,p_product_id text,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; product public.business_shop_products; s public.business_shop_stock; p public.players;
  clerk public.business_workers; clerk_rate integer:=5; commission bigint; total bigint; restored integer; new_energy integer;
begin
  if p_quantity not between 1 and 20 then return jsonb_build_object('error','Выбери количество от 1 до 20'); end if;
  select * into b from public.businesses where id=p_business_id for update;
  if not found then return jsonb_build_object('error','Магазин не найден'); end if;
  if b.owner_id=p_player_id then return jsonb_build_object('error','Нельзя покупать товар в собственном магазине'); end if;
  select * into product from public.business_shop_products where product_id=p_product_id and biz_type=b.biz_type;
  if not found then return jsonb_build_object('error','Товар не продаётся в этом магазине'); end if;
  select * into s from public.business_shop_stock where business_id=b.id and product_id=product.product_id for update;
  if not found or s.quantity<p_quantity then return jsonb_build_object('error','В магазине не хватает товара'); end if;
  select * into clerk from public.business_workers where business_id=b.id and
    ((b.biz_type='coffee' and role='Бариста') or (b.biz_type='minimarket' and role='Кассир'))
    order by created_at limit 1 for update;
  if not found then return jsonb_build_object('error','Магазин закрыт: нужен бариста или кассир'); end if;
  total:=s.retail_price*p_quantity;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if coalesce(p.money,0)<total then return jsonb_build_object('error','Не хватает денег'); end if;
  commission:=floor(total*clerk_rate/100.0);
  restored:=product.energy_restore*p_quantity;
  new_energy:=least(case when coalesce(p.has_house,false) then 150 else 100 end,coalesce(p.energy,0)+restored);
  update public.players set money=coalesce(money,0)-total,energy=new_energy where id=p_player_id;
  update public.players set money=coalesce(money,0)+commission where id=clerk.player_id;
  update public.business_shop_stock set quantity=quantity-p_quantity,updated_at=clock_timestamp()
    where business_id=b.id and product_id=product.product_id;
  update public.businesses set cash_balance=coalesce(cash_balance,0)+total-commission where id=b.id;
  return jsonb_build_object('success',true,'product_name',product.product_name,'quantity',p_quantity,
    'total',total,'commission',commission,'money',p.money-total,'energy',new_energy,'energy_restored',new_energy-coalesce(p.energy,0),
    'business_name',b.business_name);
end $$;

revoke all on function public.business_shop_state_rpc(uuid),
  public.validate_worker_role(uuid,uuid,text,integer),
  public.business_cash_transfer_rpc(uuid,uuid,bigint,text),
  public.business_shop_restock_rpc(uuid,uuid,text,integer),
  public.business_shop_set_price_rpc(uuid,uuid,text,bigint),
  public.business_shop_buy_rpc(uuid,uuid,text,integer),
  public.business_repair_personal_car_rpc(uuid,uuid),
  public.business_repair_taxi_car_rpc(uuid,uuid,uuid,integer),
  public.finish_profession_cycle_rpc_before_commerce(uuid) from public,anon,authenticated,service_role;
revoke all on function public.taxi_repair_rpc(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.business_shop_state_rpc(uuid),
  public.validate_worker_role(uuid,uuid,text,integer),
  public.business_cash_transfer_rpc(uuid,uuid,bigint,text),
  public.business_shop_restock_rpc(uuid,uuid,text,integer),
  public.business_shop_set_price_rpc(uuid,uuid,text,bigint),
  public.business_shop_buy_rpc(uuid,uuid,text,integer),
  public.business_repair_personal_car_rpc(uuid,uuid),
  public.business_repair_taxi_car_rpc(uuid,uuid,uuid,integer),
  public.finish_profession_cycle_rpc(uuid) to service_role;
