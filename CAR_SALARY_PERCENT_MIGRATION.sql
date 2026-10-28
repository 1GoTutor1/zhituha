-- Autoshop staff earn commissions only when a car from the business stock is sold.
-- Each mechanic: 3% of gross sale price. Seller: 5% of gross sale price.
-- Seller pool: 5% of gross sale price, split evenly between sellers.
-- Existing marketplace commission is applied first; employee commissions are
-- deducted from the remaining seller payout. Personal car listings are unaffected.

create or replace function public.finish_business_timer_rpc(
  p_biz_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare b businesses; s jsonb; now_ms bigint := floor(extract(epoch from clock_timestamp())*1000);
  deadline bigint; reward_key text; reward_amount int; pay jsonb;
begin
  b := public.assert_owner(p_biz_id, p_player_id);
  s := coalesce(b.stock, '{}'::jsonb);

  if b.biz_type = 'salon' then
    deadline := coalesce(b.car_order_end, 0);
    if deadline = 0 or now_ms < deadline then return jsonb_build_object('success', false); end if;
    reward_key := s->>'current_model';
    reward_amount := coalesce((s->>'order_amount')::int, 0);
    if reward_key is null or reward_key not in ('lada', 'toyota') or reward_amount < 1 or reward_amount > 10 then
      return jsonb_build_object('success', false, 'error', 'invalid order');
    end if;
    s := jsonb_set(s, array[reward_key], to_jsonb(coalesce((s->>reward_key)::int, 0) + reward_amount));
    s := jsonb_set(jsonb_set(s, '{current_model}', '"none"'), '{order_amount}', '0');
    update businesses set stock = s, car_order_end = 0 where id = p_biz_id;
  elsif b.biz_type in ('construction','phone_factory') then
    deadline := coalesce(b.build_end, 0);
    if deadline = 0 or now_ms < deadline then return jsonb_build_object('success', false); end if;
    if b.biz_type = 'construction' then
      reward_key := 'apartments';
      reward_amount := 10;
    else
      reward_key := s->>'current_phone_model';
      if reward_key = 'button' then reward_amount := 10;
      elsif reward_key = 'smartphone' then reward_amount := 5;
      else return jsonb_build_object('success', false, 'error', 'invalid production');
      end if;
    end if;
    s := jsonb_set(s, array[reward_key], to_jsonb(coalesce((s->>reward_key)::int, 0) + reward_amount));
    if b.biz_type = 'phone_factory' then s := jsonb_set(s, '{current_phone_model}', '"none"'); end if;
    update businesses set stock = s, build_end = 0 where id = p_biz_id;
  else
    return jsonb_build_object('success', false);
  end if;

  pay := '{}'::jsonb;
  if b.biz_type = 'phone_factory' then
    pay := public.pay_workers_for_batch(p_biz_id, 'Сборщик', 'Инженер');
  elsif b.biz_type = 'construction' then
    pay := public.pay_workers_for_batch(p_biz_id, 'Строитель', 'Прораб');
  end if;

  return jsonb_build_object('success', true, 'pay', pay);
exception when others then
  return jsonb_build_object('success', false, 'error', 'business not owned');
end $$;

create or replace function public.buy_market_item(p_buyer_id uuid, p_item_id uuid, p_commission_percent int default 5)
returns jsonb language plpgsql security definer as $$
declare
  m market_items; buyer players; payout bigint; real_data text; item_source text;
  salon_id uuid; mech_count int := 0; seller_count int := 0;
  mech_pool bigint := 0; seller_pool bigint := 0; mech_each bigint := 0; seller_each bigint := 0;
  mech_paid bigint := 0; seller_paid bigint := 0; owner_payout bigint;
begin
  if p_commission_percent is null or p_commission_percent not in (0, 5) then return jsonb_build_object('error','invalid commission'); end if;
  select * into m from market_items where id = p_item_id for update;
  if not found then return jsonb_build_object('error','лот не найден'); end if;
  if m.seller_id = p_buyer_id then return jsonb_build_object('error','себе не продашь'); end if;
  select * into buyer from players where id = p_buyer_id for update;
  if not found then return jsonb_build_object('error','нет покупателя'); end if;
  if buyer.money < m.price then return jsonb_build_object('error','мало денег'); end if;

  real_data := split_part(m.item_data, ':', 2);
  item_source := split_part(m.item_data, ':', 1);
  if m.item_type is null or real_data is null or not ((m.item_type = 'phone' and
       ((item_source = 'stock' and real_data in ('button','smartphone')) or (item_source = 'personal' and real_data = 'phone')))
       or (m.item_type = 'car' and real_data in ('lada','toyota'))
       or (m.item_type = 'house' and real_data = 'apartment')) then
    return jsonb_build_object('error','invalid item');
  end if;
  if (m.item_type = 'phone' and coalesce(buyer.phone_count,0) > 0)
     or (m.item_type = 'car' and coalesce(buyer.has_car,false))
     or (m.item_type = 'house' and coalesce(buyer.has_house,false)) then
    return jsonb_build_object('error','item already owned');
  end if;

  delete from market_items where id = p_item_id;
  perform change_stats(p_buyer_id, -m.price, 0);
  update players set
    phone_count = case when m.item_type = 'phone' then coalesce(phone_count,0) + 1 else phone_count end,
    has_car = case when m.item_type = 'car' then true else has_car end,
    car_model = case when m.item_type = 'car' then real_data else car_model end,
    has_house = case when m.item_type = 'house' then true else has_house end,
    house_type = case when m.item_type = 'house' then real_data else house_type end
  where id = p_buyer_id;

  payout := m.price - floor(m.price * p_commission_percent / 100.0);
  if m.item_type = 'car' and item_source = 'stock' then
    select id into salon_id from businesses where owner_id = m.seller_id and biz_type = 'salon' for update;
    if salon_id is not null then
      select count(*) into mech_count from business_workers where business_id = salon_id and role = 'Механик';
      select count(*) into seller_count from business_workers where business_id = salon_id and role = 'Продавец';
      mech_pool := floor(m.price * 0.03) * mech_count;
      seller_pool := floor(m.price * 0.05);

      if mech_count > 0 then
        mech_each := floor(m.price * 0.03);
        with ranked_workers as (
          select player_id, row_number() over (order by id) as row_num
          from business_workers where business_id = salon_id and role = 'Механик'
        )
        update players p set money = coalesce(p.money, 0) + mech_each
          + case when ranked_workers.row_num <= mech_pool % mech_count then 1 else 0 end
        from ranked_workers where p.id = ranked_workers.player_id;
        mech_paid := mech_pool;
      end if;

      if seller_count > 0 then
        seller_each := seller_pool / seller_count;
        with ranked_workers as (
          select player_id, row_number() over (order by id) as row_num
          from business_workers where business_id = salon_id and role = 'Продавец'
        )
        update players p set money = coalesce(p.money, 0) + seller_each
          + case when ranked_workers.row_num <= seller_pool % seller_count then 1 else 0 end
        from ranked_workers where p.id = ranked_workers.player_id;
        seller_paid := seller_pool;
      end if;
    end if;
  end if;

  owner_payout := payout - mech_paid - seller_paid;
  perform change_stats(m.seller_id, owner_payout, 0);
  return jsonb_build_object('success', true, 'item_type', m.item_type, 'item_data', real_data,
                            'money', buyer.money - m.price,
                            'mechanic_pay', mech_paid, 'seller_pay', seller_paid,
                            'owner_payout', owner_payout);
end $$;
