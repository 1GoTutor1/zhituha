-- Fix apartment stock listings: construction uses stock.apartments, while the
-- market item identifier remains "apartment". Also return canceled listings
-- to the same stock key. Safe to run more than once.
begin;

create or replace function public.list_item_rpc(
  p_seller_id uuid,p_item_type text,p_item_data text,p_price bigint,
  p_source text,p_bonus_slots integer default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  p public.players;
  b public.businesses;
  used integer;
  cap integer;
  car_allowed boolean:=false;
  vehicle_base bigint;
  stock_key text;
begin
  if p_price is null or p_price<=0 or p_price>100000000 then
    return jsonb_build_object('error','Некорректная цена');
  end if;
  if p_source is null or p_source not in ('personal','stock') then
    return jsonb_build_object('error','Некорректный источник товара');
  end if;
  if coalesce(p_bonus_slots,0)<0 or p_bonus_slots>2 then
    return jsonb_build_object('error','Некорректный бонус слотов');
  end if;
  if p_item_type='car' then
    car_allowed:=p_item_data in ('lada','toyota')
      or exists(select 1 from public.business_vehicle_catalog where model_id=p_item_data);
  end if;
  if p_item_type is null or p_item_data is null or not (
    (p_item_type='phone' and ((p_source='stock' and p_item_data in ('button','smartphone'))
      or (p_source='personal' and p_item_data='phone')))
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
      and x.biz_type=case p_item_type when 'car' then 'salon' when 'house' then 'construction'
        when 'phone' then 'phone_factory' end
      and (p_item_type<>'car' or not exists(select 1 from public.business_vehicle_catalog v where v.model_id=p_item_data)
        or exists(select 1 from public.business_vehicle_catalog v where v.model_id=p_item_data
          and (v.salon_class=case x.location_key when 'salon_mid' then 'mid' when 'salon_high' then 'high' else 'low' end
            or coalesce((x.stock->>p_item_data)::integer,0)>0)))
      order by x.created_at limit 1 for update;
    if not found then return jsonb_build_object('error','Нет подходящего бизнеса-склада'); end if;

    stock_key:=p_item_data;
    if p_item_type='house' then
      -- Legacy rows may use the singular key; current construction uses "apartments".
      stock_key:=case when coalesce((b.stock->>'apartments')::integer,0)>0
          or not (coalesce(b.stock,'{}'::jsonb) ? 'apartment') then 'apartments' else 'apartment' end;
    end if;
    if coalesce((b.stock->>stock_key)::integer,0)<1 then
      return jsonb_build_object('error','На складе нет этого товара');
    end if;
    update public.businesses set stock=jsonb_set(coalesce(stock,'{}'::jsonb),array[stock_key],
      to_jsonb((stock->>stock_key)::integer-1)) where id=b.id;
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
    values(p_seller_id,p.nickname,p_item_type,p_source||':'||p_item_data,p_price,
      case when p_source='stock' then b.id else null end);
  return jsonb_build_object('success',true);
end $$;

create or replace function public.cancel_lot_rpc(
  p_player_id uuid,p_item_id uuid,p_add_stock boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  m public.market_items;
  b public.businesses;
  real_data text;
  source text;
  stock_key text;
begin
  select * into m from public.market_items where id=p_item_id and seller_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Лот не найден'); end if;
  source:=split_part(m.item_data,':',1);
  real_data:=split_part(m.item_data,':',2);

  if source='stock' and p_add_stock then
    if m.source_business_id is not null then
      select * into b from public.businesses where id=m.source_business_id and owner_id=p_player_id for update;
    else
      select * into b from public.businesses where owner_id=p_player_id
        and biz_type=case m.item_type when 'car' then 'salon' when 'house' then 'construction'
          when 'phone' then 'phone_factory' end order by created_at limit 1 for update;
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
    stock_key:=real_data;
    if m.item_type='house' then
      stock_key:=case when coalesce((b.stock->>'apartments')::integer,0)>0
          or not (coalesce(b.stock,'{}'::jsonb) ? 'apartment') then 'apartments' else 'apartment' end;
    end if;
    update public.businesses set stock=jsonb_set(coalesce(stock,'{}'::jsonb),array[stock_key],
      to_jsonb(coalesce((stock->>stock_key)::integer,0)+1)) where id=b.id;
  end if;
  return jsonb_build_object('success',true,'item_type',m.item_type,'item_data',real_data,
    'source_business_id',m.source_business_id);
end $$;

notify pgrst, 'reload schema';
commit;
