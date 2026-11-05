-- Premium sellers pay no marketplace commission. The daily Big Market modifier
-- also waives commission for everyone. Apply after DEALERSHIP_FLEET_MIGRATION.sql.

create or replace function public.buy_market_item(
  p_buyer_id uuid,p_item_id uuid,p_commission_percent integer default 5)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.market_items; buyer public.players; real_data text; source text; seller_business public.businesses;
  payout bigint; mech_count integer:=0; seller_count integer:=0; mech_pool bigint:=0; seller_pool bigint:=0;
  owner_payout bigint; car_allowed boolean:=false; seller_has_premium boolean:=false;
  effective_commission integer:=5; commission_amount bigint; day_index integer;
begin
  if p_commission_percent is null or p_commission_percent not in (0,5) then return jsonb_build_object('error','Некорректная комиссия рынка'); end if;
  select * into m from public.market_items where id=p_item_id for update;
  if not found then return jsonb_build_object('error','Лот не найден'); end if;
  if m.seller_id=p_buyer_id then return jsonb_build_object('error','Нельзя купить собственный лот'); end if;
  select * into buyer from public.players where id=p_buyer_id for update;
  if not found then return jsonb_build_object('error','Покупатель не найден'); end if;
  select coalesce(premium_until > statement_timestamp(), false) into seller_has_premium
    from public.players where id=m.seller_id;
  day_index:=mod(timezone('Europe/Moscow',statement_timestamp())::date-date '1970-01-01',7);
  if seller_has_premium or day_index=6 then effective_commission:=0; end if;
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
  commission_amount:=floor(m.price*effective_commission/100.0);
  payout:=m.price-commission_amount;
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
    'money',buyer.money-m.price,'seller_proceeds',owner_payout,'business_id',seller_business.id,
    'market_commission_percent',effective_commission,'market_commission',commission_amount);
end $$;

revoke all on function public.buy_market_item(uuid, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.buy_market_item(uuid, uuid, integer) to service_role;
notify pgrst, 'reload schema';
