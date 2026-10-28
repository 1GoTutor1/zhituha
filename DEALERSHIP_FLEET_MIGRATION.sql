-- 15 vehicle models across the three state-owned dealership classes.
-- Apply after BUSINESS_LOCATIONS_MIGRATION.sql and BUSINESS_COMMERCE_MIGRATION.sql.

create table if not exists public.business_vehicle_catalog (
  model_id text primary key,
  model_name text not null,
  salon_class text not null check (salon_class in ('low','mid','high')),
  base_price bigint not null check (base_price > 0),
  order_ms bigint not null check (order_ms > 0),
  taxi_class text not null check (taxi_class in ('economy','comfort','business')),
  fare bigint not null check (fare > 0),
  taxi_income_per_hour bigint not null check (taxi_income_per_hour > 0),
  repair_price bigint not null check (repair_price > 0)
);

insert into public.business_vehicle_catalog
  (model_id,model_name,salon_class,base_price,order_ms,taxi_class,fare,taxi_income_per_hour,repair_price) values
  ('lada','Ока','low',35000,900000,'economy',500,1000,3000),
  ('matiz','Daewoo Matiz','low',80000,900000,'economy',500,1000,4500),
  ('vaz_2107','ВАЗ-2107','low',140000,900000,'economy',500,1000,6000),
  ('renault_logan','Renault Logan','low',280000,900000,'economy',500,1000,9000),
  ('volkswagen_polo','Volkswagen Polo','low',450000,900000,'economy',500,1000,12000),
  ('ford_focus','Ford Focus','mid',650000,1800000,'comfort',700,1500,16000),
  ('toyota','Toyota Corolla','mid',850000,1800000,'comfort',700,1500,20000),
  ('skoda_octavia','Skoda Octavia','mid',1100000,1800000,'comfort',700,1500,24000),
  ('kia_optima','Kia Optima','mid',1400000,1800000,'comfort',700,1500,28000),
  ('bmw_3','BMW 3 Series','mid',1800000,1800000,'comfort',700,1500,35000),
  ('bmw_5','BMW 5 Series','high',3000000,2700000,'business',900,2200,45000),
  ('mercedes_e','Mercedes-Benz E-Class','high',4200000,2700000,'business',900,2200,55000),
  ('lexus_es','Lexus ES','high',5500000,2700000,'business',900,2200,65000),
  ('porsche_panamera','Porsche Panamera','high',8500000,2700000,'business',900,2200,80000),
  ('range_rover','Range Rover','high',12000000,2700000,'business',900,2200,100000)
on conflict (model_id) do update set
  model_name=excluded.model_name,salon_class=excluded.salon_class,
  base_price=excluded.base_price,order_ms=excluded.order_ms,taxi_class=excluded.taxi_class,
  fare=excluded.fare,taxi_income_per_hour=excluded.taxi_income_per_hour,repair_price=excluded.repair_price;

alter table public.business_vehicle_catalog enable row level security;
revoke all on public.business_vehicle_catalog from public,anon,authenticated;
grant select on public.business_vehicle_catalog to service_role;
alter table public.market_items add column if not exists source_business_id uuid
  references public.businesses(id) on delete set null;

create or replace function public.business_vehicle_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return jsonb_build_object(
    'models',coalesce((select jsonb_agg(jsonb_build_object(
      'model_id',c.model_id,'model_name',c.model_name,'salon_class',c.salon_class,
      'base_price',c.base_price,'order_ms',c.order_ms,'taxi_class',c.taxi_class,
      'fare',c.fare,'taxi_income_per_hour',c.taxi_income_per_hour,'repair_price',c.repair_price)
      order by case c.salon_class when 'low' then 1 when 'mid' then 2 else 3 end,c.base_price)
      from public.business_vehicle_catalog c),'[]'::jsonb),
    'dealers',coalesce((select jsonb_agg(jsonb_build_object(
      'business_id',b.id,'business_name',b.business_name,'owner_id',b.owner_id,
      'owner_name',b.owner_name,'salon_class',case b.location_key when 'salon_mid' then 'mid'
        when 'salon_high' then 'high' else 'low' end,
      'models',(select jsonb_agg(jsonb_build_object('model_id',c.model_id,'model_name',c.model_name,
        'base_price',c.base_price,'quantity',greatest(0,coalesce((b.stock->>c.model_id)::integer,0)))
        order by c.base_price)
        from public.business_vehicle_catalog c where c.salon_class=case b.location_key
          when 'salon_mid' then 'mid' when 'salon_high' then 'high' else 'low' end
          or coalesce((b.stock->>c.model_id)::integer,0)>0))
      order by b.business_name) from public.businesses b where b.biz_type='salon'),'[]'::jsonb)
  );
end $$;

create or replace function public.start_car_order_rpc(
  p_biz_id uuid,p_player_id uuid,p_model text,p_amount integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; v public.business_vehicle_catalog; v_salon_class text;
  price bigint; fine bigint:=0; duration bigint; finish_at bigint;
  mech integer; seller integer; now_ms bigint:=floor(extract(epoch from clock_timestamp())*1000);
begin
  if p_amount is null or p_amount<1 or p_amount>10 then return jsonb_build_object('error','За заказ можно взять от 1 до 10 машин'); end if;
  perform public.assert_owner(p_biz_id,p_player_id);
  select * into b from public.businesses where id=p_biz_id for update;
  if b.biz_type<>'salon' then return jsonb_build_object('error','Это не автосалон'); end if;
  v_salon_class:=case b.location_key when 'salon_mid' then 'mid' when 'salon_high' then 'high' else 'low' end;
  select * into v from public.business_vehicle_catalog vc where vc.model_id=p_model and vc.salon_class=v_salon_class;
  if not found then return jsonb_build_object('error','Эта модель не продаётся в данном классе автосалона'); end if;
  if coalesce(b.car_order_end,0)>now_ms then return jsonb_build_object('error','Сначала дождись текущей поставки'); end if;
  price:=v.base_price*p_amount;
  mech:=public.role_count(p_biz_id,'Механик'); seller:=public.role_count(p_biz_id,'Продавец');
  if mech=0 then return jsonb_build_object('error','Для заказа нужен механик'); end if;
  duration:=v.order_ms;
  if seller=0 then duration:=duration*3; fine:=floor(price*0.10); end if;
  if coalesce(b.cash_balance,0)<price+fine then return jsonb_build_object('error','В кассе бизнеса не хватает денег на заказ и штраф'); end if;
  finish_at:=now_ms+duration;
  update public.businesses set car_order_end=finish_at,
    stock=jsonb_set(jsonb_set(jsonb_set(coalesce(stock,'{}'::jsonb),'{current_model}',to_jsonb(v.model_id)),
      '{order_amount}',to_jsonb(p_amount)),'{order_fine}',to_jsonb(fine)) where id=b.id;
  update public.businesses set cash_balance=coalesce(cash_balance,0)-(price+fine) where id=b.id;
  return jsonb_build_object('success',true,'cash_balance',coalesce(b.cash_balance,0)-(price+fine),
    'car_order_end',finish_at,'fine',fine,'model',v.model_id,'model_name',v.model_name,'amount',p_amount);
exception when others then return jsonb_build_object('error','Не удалось оформить поставку');
end $$;

do $$
begin
  if to_regprocedure('public.finish_business_timer_rpc_before_vehicle_catalog(uuid,uuid)') is null then
    execute 'alter function public.finish_business_timer_rpc(uuid,uuid) rename to finish_business_timer_rpc_before_vehicle_catalog';
  end if;
end $$;
create or replace function public.finish_business_timer_rpc(p_biz_id uuid,p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; s jsonb; v_model_id text; amount integer; now_ms bigint;
begin
  select * into b from public.businesses where id=p_biz_id and owner_id=p_player_id for update;
  if not found then return jsonb_build_object('success',false,'error','Бизнес не найден'); end if;
  if b.biz_type<>'salon' then return public.finish_business_timer_rpc_before_vehicle_catalog(p_biz_id,p_player_id); end if;
  now_ms:=floor(extract(epoch from clock_timestamp())*1000);
  if coalesce(b.car_order_end,0)=0 or b.car_order_end>now_ms then return jsonb_build_object('success',false); end if;
  s:=coalesce(b.stock,'{}'::jsonb); v_model_id:=s->>'current_model'; amount:=coalesce((s->>'order_amount')::integer,0);
  if v_model_id is null or amount<1 or amount>10 or not exists(select 1 from public.business_vehicle_catalog vc where vc.model_id=v_model_id) then
    return jsonb_build_object('success',false,'error','Некорректная поставка автомобилей');
  end if;
  s:=jsonb_set(s,array[v_model_id],to_jsonb(greatest(0,coalesce((s->>v_model_id)::integer,0))+amount));
  s:=jsonb_set(jsonb_set(s,'{current_model}','"none"'::jsonb),'{order_amount}','0'::jsonb);
  update public.businesses set stock=s,car_order_end=0 where id=b.id;
  return jsonb_build_object('success',true,'model',v_model_id,'amount',amount);
end $$;

create or replace function public.taxi_purchase_vehicle_rpc(
  p_player_id uuid,p_taxi_business_id uuid,p_dealer_id uuid,p_model_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare taxi public.businesses; dealer public.businesses; v public.business_vehicle_catalog;
  cars jsonb; count_drivers integer; price bigint; mech_count integer; seller_count integer;
  mechanic_pool bigint; seller_pool bigint; owner_revenue bigint;
begin
  select * into taxi from public.businesses where id=p_taxi_business_id and owner_id=p_player_id and biz_type='taxi' for update;
  if not found then return jsonb_build_object('error','Таксопарк не найден'); end if;
  select * into dealer from public.businesses where id=p_dealer_id and biz_type='salon' for update;
  if not found then return jsonb_build_object('error','Автосалон не найден'); end if;
  if dealer.owner_id=p_player_id then return jsonb_build_object('error','Нельзя покупать машину в собственном автосалоне'); end if;
  select * into v from public.business_vehicle_catalog where model_id=p_model_id;
  if not found then return jsonb_build_object('error','Модель не найдена'); end if;
  if v.salon_class<>(case dealer.location_key when 'salon_mid' then 'mid' when 'salon_high' then 'high' else 'low' end)
    and coalesce((dealer.stock->>v.model_id)::integer,0)<1 then
    return jsonb_build_object('error','Эта модель не подходит автосалону'); end if;
  if coalesce((dealer.stock->>v.model_id)::integer,0)<1 then return jsonb_build_object('error','Автомобиль закончился'); end if;
  cars:=case when jsonb_typeof(taxi.stock->'taxi_cars')='array' then taxi.stock->'taxi_cars' else '[]'::jsonb end;
  if jsonb_array_length(cars)>=2 then
    return jsonb_build_object('error','Сначала найми водителя: парк может иметь по одной машине на водителя'); end if;
  price:=v.base_price;
  if coalesce(taxi.cash_balance,0)<price then return jsonb_build_object('error','В кассе таксопарка не хватает денег'); end if;
  select count(*) into mech_count from public.business_workers where business_id=dealer.id and role='Механик';
  select count(*) into seller_count from public.business_workers where business_id=dealer.id and role='Продавец';
  mechanic_pool:=floor(price*0.03)*mech_count;
  seller_pool:=case when seller_count>0 then floor(price*0.05) else 0 end;
  owner_revenue:=price-mechanic_pool-seller_pool;
  update public.businesses set cash_balance=coalesce(cash_balance,0)-price where id=taxi.id;
  update public.businesses set cash_balance=coalesce(cash_balance,0)+owner_revenue,
    stock=jsonb_set(coalesce(stock,'{}'::jsonb),array[v.model_id],to_jsonb((coalesce((stock->>v.model_id)::integer,0)-1)))
    where id=dealer.id;
  if mech_count>0 then
    update public.players p set money=coalesce(p.money,0)+floor(price*0.03)
      from public.business_workers w where w.business_id=dealer.id and w.role='Механик' and w.player_id=p.id;
  end if;
  if seller_count>0 then
    update public.players p set money=coalesce(p.money,0)+floor(price*0.05/seller_count)
      from public.business_workers w where w.business_id=dealer.id and w.role='Продавец' and w.player_id=p.id;
  end if;
  cars:=cars||jsonb_build_object('model',v.model_id,'model_name',v.model_name,'class',v.taxi_class,
    'fare',v.fare,'health',100,'last_claim',floor(extract(epoch from clock_timestamp())*1000));
  update public.businesses set stock=jsonb_set(coalesce(stock,'{}'::jsonb),'{taxi_cars}',cars)
    where id=taxi.id;
  return jsonb_build_object('success',true,'model',v.model_id,'model_name',v.model_name,'price',price,
    'cars',cars,'taxi_cash',coalesce(taxi.cash_balance,0)-price);
end $$;

create or replace function public.taxi_add_car_rpc(p_biz_id uuid,p_player_id uuid,p_model text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return jsonb_build_object('error','Покупай машину в наличии через автосалон');
end $$;

create or replace function public.list_item_rpc(
  p_seller_id uuid,p_item_type text,p_item_data text,p_price bigint,
  p_source text,p_bonus_slots integer default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.players; b public.businesses; used integer; cap integer; car_allowed boolean:=false; vehicle_base bigint;
begin
  if p_price is null or p_price<=0 or p_price>100000000 then return jsonb_build_object('error','Некорректная цена'); end if;
  if p_source is null or p_source not in ('personal','stock') then return jsonb_build_object('error','Некорректный источник товара'); end if;
  if coalesce(p_bonus_slots,0)<0 or p_bonus_slots>2 then return jsonb_build_object('error','Некорректный бонус слотов'); end if;
  if p_item_type='car' then
    car_allowed:=p_item_data in ('lada','toyota') or exists(select 1 from public.business_vehicle_catalog where model_id=p_item_data);
  end if;
  if p_item_type is null or p_item_data is null or not (
    (p_item_type='phone' and ((p_source='stock' and p_item_data in ('button','smartphone')) or (p_source='personal' and p_item_data='phone')))
    or (p_item_type='car' and car_allowed)
    or (p_item_type='house' and p_item_data='apartment')) then
    return jsonb_build_object('error','Этот предмет нельзя выставить на рынок');
  end if;
  if p_item_type='car' and p_source='stock' then
    select base_price into vehicle_base from public.business_vehicle_catalog where model_id=p_item_data;
    if vehicle_base is not null and (p_price<ceil(vehicle_base*0.75) or p_price>floor(vehicle_base*1.25)) then
      return jsonb_build_object('error',format('Цена машины от бизнеса должна быть от %s до %s ₽',ceil(vehicle_base*0.75),floor(vehicle_base*1.25)));
    end if;
  end if;
  select * into p from public.players where id=p_seller_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  select count(*) into used from public.market_items where seller_id=p_seller_id;
  cap:=coalesce(p.market_slots,3)+coalesce(p_bonus_slots,0);
  if used>=cap then return jsonb_build_object('error','Нет свободных слотов рынка'); end if;
  if p_source='stock' then
    select * into b from public.businesses x where x.owner_id=p_seller_id
      and x.biz_type=case p_item_type when 'car' then 'salon' when 'house' then 'construction' when 'phone' then 'phone_factory' end
      and (p_item_type<>'car' or not exists(select 1 from public.business_vehicle_catalog v where v.model_id=p_item_data)
        or exists(select 1 from public.business_vehicle_catalog v where v.model_id=p_item_data and (v.salon_class=case x.location_key when 'salon_mid' then 'mid' when 'salon_high' then 'high' else 'low' end
          or coalesce((x.stock->>p_item_data)::integer,0)>0)))
      order by x.created_at limit 1 for update;
    if not found then return jsonb_build_object('error','Нет подходящего бизнеса-склада'); end if;
    if coalesce((b.stock->>p_item_data)::integer,0)<1 then return jsonb_build_object('error','На складе нет этого товара'); end if;
    update public.businesses set stock=jsonb_set(coalesce(stock,'{}'::jsonb),array[p_item_data],to_jsonb((stock->>p_item_data)::integer-1)) where id=b.id;
  else
    if p_item_type='phone' and coalesce(p.phone_count,0)<1 then return jsonb_build_object('error','У тебя нет телефона'); end if;
    if p_item_type='car' and not coalesce(p.has_car,false) then return jsonb_build_object('error','У тебя нет машины'); end if;
    if p_item_type='house' and not coalesce(p.has_house,false) then return jsonb_build_object('error','У тебя нет квартиры'); end if;
    update public.players set
      phone_count=case when p_item_type='phone' then greatest(0,coalesce(phone_count,0)-1) else phone_count end,
      has_car=case when p_item_type='car' then false else has_car end,
      car_model=case when p_item_type='car' then 'none' else car_model end,
      has_house=case when p_item_type='house' then false else has_house end,
      house_type=case when p_item_type='house' then 'none' else house_type end where id=p_seller_id;
  end if;
  insert into public.market_items(seller_id,seller_name,item_type,item_data,price,source_business_id)
    values(p_seller_id,p.nickname,p_item_type,p_source||':'||p_item_data,p_price,case when p_source='stock' then b.id else null end);
  return jsonb_build_object('success',true);
end $$;

create or replace function public.buy_market_item(
  p_buyer_id uuid,p_item_id uuid,p_commission_percent integer default 5)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.market_items; buyer public.players; real_data text; source text; seller_business public.businesses;
  payout bigint; mech_count integer:=0; seller_count integer:=0; mech_pool bigint:=0; seller_pool bigint:=0;
  owner_payout bigint; car_allowed boolean:=false;
begin
  if p_commission_percent is null or p_commission_percent not in (0,5) then return jsonb_build_object('error','Некорректная комиссия рынка'); end if;
  select * into m from public.market_items where id=p_item_id for update;
  if not found then return jsonb_build_object('error','Лот не найден'); end if;
  if m.seller_id=p_buyer_id then return jsonb_build_object('error','Нельзя купить собственный лот'); end if;
  select * into buyer from public.players where id=p_buyer_id for update;
  if not found then return jsonb_build_object('error','Покупатель не найден'); end if;
  if coalesce(buyer.money,0)<m.price then return jsonb_build_object('error','Не хватает денег'); end if;
  real_data:=split_part(m.item_data,':',2); source:=split_part(m.item_data,':',1);
  if m.item_type='car' then car_allowed:=real_data in ('lada','toyota') or exists(select 1 from public.business_vehicle_catalog where model_id=real_data); end if;
  if source not in ('stock','personal') or not (
    (m.item_type='phone' and ((source='stock' and real_data in ('button','smartphone')) or (source='personal' and real_data='phone')))
    or (m.item_type='car' and car_allowed)
    or (m.item_type='house' and real_data='apartment')) then return jsonb_build_object('error','Некорректный лот'); end if;
  if (m.item_type='phone' and coalesce(buyer.phone_count,0)>0) or (m.item_type='car' and coalesce(buyer.has_car,false))
      or (m.item_type='house' and coalesce(buyer.has_house,false)) then return jsonb_build_object('error','У тебя уже есть такой предмет'); end if;
  if source='stock' then
    if m.source_business_id is not null then
      select * into seller_business from public.businesses b where b.id=m.source_business_id and b.owner_id=m.seller_id for update;
    else
      select * into seller_business from public.businesses b where b.owner_id=m.seller_id
        and b.biz_type=case m.item_type when 'car' then 'salon' when 'house' then 'construction' when 'phone' then 'phone_factory' end
        order by b.created_at limit 1 for update;
    end if;
    if not found then return jsonb_build_object('error','Бизнес-продавец больше не найден'); end if;
  end if;
  delete from public.market_items where id=m.id;
  perform public.change_stats(p_buyer_id,-m.price,0);
  update public.players set phone_count=case when m.item_type='phone' then coalesce(phone_count,0)+1 else phone_count end,
    has_car=case when m.item_type='car' then true else has_car end,
    car_model=case when m.item_type='car' then real_data else car_model end,
    car_health=case when m.item_type='car' then 100 else car_health end,
    has_house=case when m.item_type='house' then true else has_house end,
    house_type=case when m.item_type='house' then real_data else house_type end where id=p_buyer_id;
  payout:=m.price-floor(m.price*p_commission_percent/100.0);
  owner_payout:=payout;
  if m.item_type='car' and source='stock' then
    select count(*) into mech_count from public.business_workers where business_id=seller_business.id and role='Механик';
    select count(*) into seller_count from public.business_workers where business_id=seller_business.id and role='Продавец';
    mech_pool:=floor(m.price*0.03)*mech_count;
    seller_pool:=case when seller_count>0 then floor(m.price*0.05) else 0 end;
    owner_payout:=payout-mech_pool-seller_pool;
    if mech_count>0 then
      update public.players p set money=coalesce(p.money,0)+floor(m.price*0.03)
        from public.business_workers w where w.business_id=seller_business.id and w.role='Механик' and w.player_id=p.id;
    end if;
    if seller_count>0 then
      update public.players p set money=coalesce(p.money,0)+floor(m.price*0.05/seller_count)
        from public.business_workers w where w.business_id=seller_business.id and w.role='Продавец' and w.player_id=p.id;
    end if;
  end if;
  if source='stock' then
    update public.businesses set cash_balance=coalesce(cash_balance,0)+owner_payout where id=seller_business.id;
  else
    perform public.change_stats(m.seller_id,owner_payout,0);
  end if;
  return jsonb_build_object('success',true,'item_type',m.item_type,'item_data',real_data,
    'money',buyer.money-m.price,'seller_proceeds',owner_payout,'business_id',seller_business.id);
end $$;

create or replace function public.cancel_lot_rpc(p_player_id uuid,p_item_id uuid,p_add_stock boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.market_items; b public.businesses; real_data text; source text;
begin
  select * into m from public.market_items where id=p_item_id and seller_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Лот не найден'); end if;
  source:=split_part(m.item_data,':',1); real_data:=split_part(m.item_data,':',2);
  if source='stock' and p_add_stock then
    if m.source_business_id is not null then
      select * into b from public.businesses where id=m.source_business_id and owner_id=p_player_id for update;
    else
      select * into b from public.businesses where owner_id=p_player_id
        and biz_type=case m.item_type when 'car' then 'salon' when 'house' then 'construction' when 'phone' then 'phone_factory' end
        order by created_at limit 1 for update;
    end if;
    if not found then return jsonb_build_object('error','Бизнес-склад больше не найден'); end if;
  end if;
  delete from public.market_items where id=m.id;
  if source='personal' then
    update public.players set
      phone_count=case when m.item_type='phone' then coalesce(phone_count,0)+1 else phone_count end,
      has_car=case when m.item_type='car' then true else has_car end,
      car_model=case when m.item_type='car' then real_data else car_model end,
      car_health=case when m.item_type='car' then 100 else car_health end,
      has_house=case when m.item_type='house' then true else has_house end,
      house_type=case when m.item_type='house' then real_data else house_type end where id=p_player_id;
  elsif p_add_stock then
    update public.businesses set stock=jsonb_set(coalesce(stock,'{}'::jsonb),array[real_data],
      to_jsonb(coalesce((stock->>real_data)::integer,0)+1)) where id=b.id;
  end if;
  return jsonb_build_object('success',true,'item_type',m.item_type,'item_data',real_data,'source_business_id',m.source_business_id);
end $$;

create or replace function public.taxi_collect_rpc(p_biz_id uuid,p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; cars jsonb; car jsonb; mech public.business_workers;
  now_ms bigint:=floor(extract(epoch from clock_timestamp())*1000); gross bigint:=0; total bigint;
  hours numeric; income integer; wear integer; drivers integer; updated_cars jsonb:='[]'::jsonb;
  driver_share integer; mechanic_share integer;
begin
  b:=public.assert_owner(p_biz_id,p_player_id);
  if b.biz_type<>'taxi' then return jsonb_build_object('error','Это не таксопарк'); end if;
  select count(*) into drivers from public.business_workers where business_id=b.id and role='Водитель';
  if drivers=0 then return jsonb_build_object('error','Нет водителей — машины стоят'); end if;
  select * into mech from public.business_workers where business_id=b.id and role='Механик' limit 1;
  wear:=case when mech.player_id is null then 50 else 8 end;
  cars:=case when jsonb_typeof(b.stock->'taxi_cars')='array' then b.stock->'taxi_cars' else '[]'::jsonb end;
  for car in select value from jsonb_array_elements(cars) loop
    if coalesce((car->>'health')::integer,0)<=0 then updated_cars:=updated_cars||car; continue; end if;
    hours:=least(greatest(0,(now_ms-coalesce((car->>'last_claim')::bigint,now_ms))/3600000.0),8);
    income:=floor(hours*coalesce((select v.taxi_income_per_hour from public.business_vehicle_catalog v where v.model_id=car->>'model'),
      case car->>'model' when 'lada' then 1000 else 1500 end))::integer;
    gross:=gross+income;
    updated_cars:=updated_cars||jsonb_set(jsonb_set(car,'{health}',to_jsonb(greatest(0,coalesce((car->>'health')::integer,100)-floor(hours*wear)::integer))),
      '{last_claim}',to_jsonb(now_ms));
  end loop;
  if gross=0 then return jsonb_build_object('error','Ещё рано собирать доход'); end if;
  driver_share:=floor(gross*0.10); mechanic_share:=case when mech.player_id is null then 0 else floor(gross*0.05) end;
  total:=gross-driver_share-mechanic_share;
  if driver_share>0 then
    update public.players p set tip_balance=coalesce(p.tip_balance,0)+floor(driver_share/drivers)
      where p.id in (select player_id from public.business_workers where business_id=b.id and role='Водитель');
  end if;
  if mechanic_share>0 then update public.players set tip_balance=coalesce(tip_balance,0)+mechanic_share where id=mech.player_id; end if;
  update public.businesses set stock=jsonb_set(coalesce(stock,'{}'::jsonb),'{taxi_cars}',updated_cars) where id=b.id;
  perform public.change_stats(p_player_id,total,0);
  return jsonb_build_object('income',total,'gross',gross,'money',(select money from public.players where id=p_player_id),
    'stock',jsonb_set(coalesce(b.stock,'{}'::jsonb),'{taxi_cars}',updated_cars));
exception when others then return jsonb_build_object('error','Не удалось собрать доход таксопарка');
end $$;

create or replace function public.taxi_fleet_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; cars jsonb; selected integer;
begin
  select x.* into b from public.business_workers w join public.businesses x on x.id=w.business_id
    where w.player_id=p_player_id and w.role='Водитель' and x.biz_type='taxi' limit 1;
  if not found then return jsonb_build_object('business_id',null,'cars','[]'::jsonb,'selected_car_index',null); end if;
  cars:=case when jsonb_typeof(b.stock->'taxi_cars')='array' then b.stock->'taxi_cars' else '[]'::jsonb end;
  select car_index into selected from public.taxi_driver_assignments where player_id=p_player_id;
  return jsonb_build_object('business_id',b.id,'selected_car_index',selected,
    'cars',coalesce((select jsonb_agg(jsonb_build_object(
      'car_index',v.position-1,'model',v.car->>'model',
      'model_name',coalesce(c.model_name,v.car->>'model'),
      'class',coalesce(v.car->>'class',c.taxi_class),
      'health',coalesce((v.car->>'health')::integer,0),
      'busy',a.active_cycle_id is not null and a.player_id<>p_player_id,
      'selected',v.position-1=selected) order by v.position)
      from jsonb_array_elements(cars) with ordinality v(car,position)
      left join public.business_vehicle_catalog c on c.model_id=v.car->>'model'
      left join public.taxi_driver_assignments a on a.business_id=b.id and a.car_index=v.position-1),'[]'::jsonb));
end $$;

revoke all on function public.business_vehicle_state_rpc(uuid),
  public.taxi_fleet_rpc(uuid),
  public.start_car_order_rpc(uuid,uuid,text,integer),
  public.finish_business_timer_rpc_before_vehicle_catalog(uuid,uuid),
  public.taxi_purchase_vehicle_rpc(uuid,uuid,uuid,text),public.taxi_collect_rpc(uuid,uuid),
  public.taxi_add_car_rpc(uuid,uuid,text),
  public.list_item_rpc(uuid,text,text,bigint,text,integer),
  public.buy_market_item(uuid,uuid,integer),public.cancel_lot_rpc(uuid,uuid,boolean)
  from public,anon,authenticated,service_role;
grant execute on function public.business_vehicle_state_rpc(uuid),
  public.taxi_fleet_rpc(uuid),
  public.start_car_order_rpc(uuid,uuid,text,integer),public.finish_business_timer_rpc(uuid,uuid),
  public.taxi_purchase_vehicle_rpc(uuid,uuid,uuid,text),public.taxi_collect_rpc(uuid,uuid),
  public.list_item_rpc(uuid,text,text,bigint,text,integer),public.buy_market_item(uuid,uuid,integer),
  public.cancel_lot_rpc(uuid,uuid,boolean) to service_role;
