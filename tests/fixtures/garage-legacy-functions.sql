-- Function definitions inspected in the connected database on 2026-11-20.
-- No player data. Kept to exercise the real pre-migration market and triggers.
CREATE OR REPLACE FUNCTION public.archive_previous_car_plate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
begin
  if coalesce(old.has_car,false) and nullif(old.car_plate,'') is not null
     and old.car_plate is distinct from new.car_plate then
    insert into public.player_car_numbers(player_id,plate,estimated_value)
    values(old.id,old.car_plate,public.car_plate_value(old.car_plate))
    on conflict (plate) do nothing;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.buy_market_item(p_buyer_id uuid, p_item_id uuid, p_commission_percent integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION public.cancel_lot_rpc(p_player_id uuid, p_item_id uuid, p_add_stock boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  listing public.market_items;
  result jsonb;
  saved_health smallint;
  saved_plate text;
  current_health smallint;
  current_has_car boolean;
  current_model text;
  generated_plate text;
  plate_is_still_owned boolean := false;
begin
  select * into listing
    from public.market_items
   where id = p_item_id and seller_id = p_player_id
   for update;

  if not found then
    return jsonb_build_object('error', 'Лот не найден');
  end if;

  if listing.item_type in ('phone_number', 'car_number') then
    return public.cancel_number_market_lot_rpc(p_player_id, p_item_id);
  end if;

  if listing.item_type <> 'car'
     or split_part(listing.item_data, ':', 1) <> 'personal' then
    return public.cancel_lot_rpc_legacy(p_player_id, p_item_id, p_add_stock);
  end if;

  select p.car_health, p.has_car, p.car_model, s.car_health, s.car_plate
    into current_health, current_has_car, current_model, saved_health, saved_plate
    from public.players p
    left join private.market_personal_car_snapshots s
      on s.market_item_id = listing.id and s.player_id = p.id
   where p.id = p_player_id
   for update of p;

  if not found then
    return jsonb_build_object('error', 'Игрок не найден');
  end if;

  if coalesce(current_has_car, false) then
    return jsonb_build_object(
      'error', 'В гараже уже есть машина. Сначала выставь её на рынок, чтобы вернуть эту из лота. Лот остаётся в продаже.',
      'code', 'CAR_SLOT_OCCUPIED',
      'active_car_model', current_model
    );
  end if;

  saved_health := coalesce(saved_health, current_health, 100);
  result := public.cancel_lot_rpc_legacy(p_player_id, p_item_id, p_add_stock);
  if result ? 'error' then return result; end if;

  if saved_plate is not null then
    select exists (
      select 1 from public.player_car_numbers
       where player_id = p_player_id and plate = saved_plate
    ) into plate_is_still_owned;
  end if;

  select car_plate into generated_plate
    from public.players
   where id = p_player_id;

  if plate_is_still_owned then
    update public.players
       set car_plate = saved_plate,
           car_health = saved_health
     where id = p_player_id;

    delete from public.player_car_numbers
     where player_id = p_player_id
       and plate in (saved_plate, generated_plate);
  else
    update public.players
       set car_health = saved_health
     where id = p_player_id;
  end if;

  return result || jsonb_build_object(
    'car_health', saved_health,
    'car_plate', case when plate_is_still_owned then saved_plate else generated_plate end
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.list_item_rpc(p_seller_id uuid, p_item_type text, p_item_data text, p_price bigint, p_source text, p_bonus_slots integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  original_health smallint;
  original_plate text;
  listing_id uuid;
  result jsonb;
begin
  if p_item_type = 'car' and p_source = 'personal' then
    select car_health, car_plate
      into original_health, original_plate
      from public.players
     where id = p_seller_id
     for update;
  end if;

  result := public.list_item_rpc_before_personal_car_snapshot(
    p_seller_id, p_item_type, p_item_data, p_price, p_source, p_bonus_slots
  );

  if result->>'success' = 'true' and p_item_type = 'car' and p_source = 'personal' then
    select id into listing_id
      from public.market_items
     where seller_id = p_seller_id
       and item_type = 'car'
       and item_data = 'personal:' || p_item_data
     order by created_at desc, id desc
     limit 1
     for update;

    if listing_id is not null then
      insert into private.market_personal_car_snapshots(market_item_id, player_id, car_health, car_plate)
      values (listing_id, p_seller_id, coalesce(original_health, 100), original_plate)
      on conflict (market_item_id) do update
        set player_id = excluded.player_id,
            car_health = excluded.car_health,
            car_plate = excluded.car_plate;
    end if;
  end if;

  return result;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.list_item_rpc_before_personal_car_snapshot(p_seller_id uuid, p_item_type text, p_item_data text, p_price bigint, p_source text, p_bonus_slots integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.players; b public.businesses; used integer; cap integer; car_allowed boolean:=false; vehicle_base bigint; stock_key text;
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
    stock_key:=p_item_data;
    if p_item_type='house' then
      stock_key:=case when coalesce((b.stock->>'apartments')::integer,0)>0
          or not (coalesce(b.stock,'{}'::jsonb) ? 'apartment') then 'apartments' else 'apartment' end;
    end if;
    if coalesce((b.stock->>stock_key)::integer,0)<1 then return jsonb_build_object('error','На складе нет этого товара'); end if;
    update public.businesses set stock=jsonb_set(coalesce(stock,'{}'::jsonb),array[stock_key],to_jsonb((stock->>stock_key)::integer-1)) where id=b.id;
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
end $function$
;
CREATE OR REPLACE FUNCTION public.ensure_personal_car_plate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
begin
  if coalesce(new.has_car,false) then
    if tg_op='INSERT' or not coalesce(old.has_car,false) or new.car_model is distinct from old.car_model or nullif(new.car_plate,'') is null then
      new.car_plate:=public.generate_car_plate();
    end if;
  else
    new.car_plate:=null;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.cancel_lot_rpc_legacy(p_player_id uuid, p_item_id uuid, p_add_stock boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare m public.market_items; b public.businesses; real_data text; source text; stock_key text;
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
    stock_key:=real_data;
    if m.item_type='house' then
      stock_key:=case when coalesce((b.stock->>'apartments')::integer,0)>0
          or not (coalesce(b.stock,'{}'::jsonb) ? 'apartment') then 'apartments' else 'apartment' end;
    end if;
    update public.businesses set stock=jsonb_set(coalesce(stock,'{}'::jsonb),array[stock_key],
      to_jsonb(coalesce((stock->>stock_key)::integer,0)+1)) where id=b.id;
  end if;
  return jsonb_build_object('success',true,'item_type',m.item_type,'item_data',real_data,'source_business_id',m.source_business_id);
end $function$
;
CREATE OR REPLACE FUNCTION public.generate_car_plate()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  alphabet text[]:=array['А','В','Е','К','М','Н','О','Р','С','Т','У','Х'];
  regions text[]:=array['01','02','16','50','77','97','99','777'];
  special_series text[]:=array['АМР','ЕКХ','АУЕ','ХКХ','ВОР','ХАМ','АМО','АММ','АОО','АРМ','АТК','ВКР','ВМР','ВОО','ЕКР','ЕОО','ЕРЕ','ККХ','КММ','КМР','КОО','ММР','МОО','ОКО','ООА','ООН','ООС','ОРР','ОСК','ОСМ','ОТТ','САС','СКР','СОО'];
  candidate text;
  letters text;
  digits text;
  region text;
  repeated_letter text;
  other_letter text;
  pattern_roll numeric;
  start_index integer;
  pattern_kind integer;
  i integer;
begin
  perform pg_advisory_xact_lock(hashtext('zhituha-car-plate'));
  for i in 1..100 loop
    pattern_roll:=random();
    if pattern_roll<0.04 then
      repeated_letter:=alphabet[1+floor(random()*array_length(alphabet,1))::integer];
      letters:=repeated_letter||repeated_letter||repeated_letter;
    elsif pattern_roll<0.28 then
      repeated_letter:=alphabet[1+floor(random()*array_length(alphabet,1))::integer];
      loop
        other_letter:=alphabet[1+floor(random()*array_length(alphabet,1))::integer];
        exit when other_letter<>repeated_letter;
      end loop;
      pattern_kind:=floor(random()*3)::integer;
      if pattern_kind=0 then letters:=repeated_letter||repeated_letter||other_letter;
      elsif pattern_kind=1 then letters:=repeated_letter||other_letter||other_letter;
      else letters:=repeated_letter||other_letter||repeated_letter;
      end if;
    elsif pattern_roll<0.38 then
      start_index:=1+floor(random()*(array_length(alphabet,1)-2))::integer;
      if random()<0.5 then
        letters:=alphabet[start_index]||alphabet[start_index+1]||alphabet[start_index+2];
      else
        letters:=alphabet[start_index+2]||alphabet[start_index+1]||alphabet[start_index];
      end if;
    elsif pattern_roll<0.44 then
      letters:=special_series[1+floor(random()*array_length(special_series,1))::integer];
    else
      letters:=alphabet[1+floor(random()*array_length(alphabet,1))::integer]
        ||alphabet[1+floor(random()*array_length(alphabet,1))::integer]
        ||alphabet[1+floor(random()*array_length(alphabet,1))::integer];
    end if;
    digits:=lpad(floor(random()*1000)::integer::text,3,'0');
    region:=regions[1+floor(random()*array_length(regions,1))::integer];
    candidate:=substr(letters,1,1)||digits||substr(letters,2,2)||' '||region;
    if not exists(select 1 from public.players where car_plate=candidate)
      and not exists(select 1 from public.player_car_plate_rolls where plate=candidate and status='pending')
      and not exists(select 1 from public.player_car_numbers where plate=candidate)
      and not exists(select 1 from public.businesses b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.stock->'taxi_cars')='array' then b.stock->'taxi_cars' else '[]'::jsonb end) c where c->>'plate'=candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'Unable to allocate a unique car plate';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reset_personal_car_condition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.has_car and (not coalesce(old.has_car,false) or new.car_model is distinct from old.car_model) then
    new.car_health:=100;
  end if;
  return new;
end $function$
;
