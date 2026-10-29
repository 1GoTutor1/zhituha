-- Apply after DONATION_PROFILE_MIGRATION.sql.
-- Adds the brick and panel-house backgrounds to the existing cosmetic shop.

create or replace function public.donation_purchase_rpc(p_player_id uuid, p_item_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.players; cost bigint;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  cost := case p_item_id
    when 'frame_test' then 120
    when 'frame_amber' then 60
    when 'background_concrete' then 90
    when 'background_brick' then 40
    when 'background_panelka' then 80
    when 'market_slots_2' then case when coalesce(p.market_slots,3)>=8 then 40 else 80 end
    else null end;
  if cost is null then return jsonb_build_object('error','Предмет не найден'); end if;
  if coalesce(p.premium_balance,0)<cost then return jsonb_build_object('error','Недостаточно жетонов'); end if;
  if p_item_id<>'market_slots_2' and p_item_id=any(coalesce(p.owned_cosmetics,'{}'::text[])) then
    return jsonb_build_object('error','Уже куплено');
  end if;
  if p_item_id='market_slots_2' and coalesce(p.market_slots,3)>=9 then
    return jsonb_build_object('error','Достигнут максимум слотов');
  end if;
  if p_item_id='market_slots_2' then
    update public.players set premium_balance=premium_balance-cost,market_slots=least(coalesce(market_slots,3)+2,9)
      where id=p_player_id returning * into p;
  else
    update public.players set premium_balance=premium_balance-cost,owned_cosmetics=array_append(coalesce(owned_cosmetics,'{}'::text[]),p_item_id)
      where id=p_player_id returning * into p;
  end if;
  return jsonb_build_object('ok',true,'player',jsonb_build_object('money',p.money,
    'premium_balance',p.premium_balance,'market_slots',p.market_slots,'owned_cosmetics',p.owned_cosmetics,
    'profile_frame',p.profile_frame,'profile_background',p.profile_background));
end $$;

create or replace function public.donation_equip_rpc(p_player_id uuid, p_item_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.players;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if p_item_id='default' then
    update public.players set profile_frame='',profile_background='' where id=p_player_id returning * into p;
  elsif p_item_id in ('frame_test','frame_amber') and p_item_id=any(coalesce(p.owned_cosmetics,'{}'::text[])) then
    update public.players set profile_frame=p_item_id where id=p_player_id returning * into p;
  elsif p_item_id in ('background_concrete','background_brick','background_panelka')
    and p_item_id=any(coalesce(p.owned_cosmetics,'{}'::text[])) then
    update public.players set profile_background=p_item_id where id=p_player_id returning * into p;
  else
    return jsonb_build_object('error','Сначала купи эту косметику');
  end if;
  return jsonb_build_object('ok',true,'player',jsonb_build_object('money',p.money,
    'premium_balance',p.premium_balance,'market_slots',p.market_slots,'owned_cosmetics',p.owned_cosmetics,
    'profile_frame',p.profile_frame,'profile_background',p.profile_background));
end $$;

revoke all on function public.donation_purchase_rpc(uuid,text) from public,anon,authenticated;
revoke all on function public.donation_equip_rpc(uuid,text) from public,anon,authenticated;
grant execute on function public.donation_purchase_rpc(uuid,text) to service_role;
grant execute on function public.donation_equip_rpc(uuid,text) to service_role;
