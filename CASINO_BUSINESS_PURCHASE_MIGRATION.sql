-- Make the state-owned casino available for purchase for 20,000,000 ₽.
insert into public.business_locations(location_key,biz_type,business_name,purchase_price)
values ('casino_01','casino','Казино',20000000)
on conflict (location_key) do update set
  biz_type=excluded.biz_type,
  business_name=excluded.business_name,
  purchase_price=excluded.purchase_price;

create or replace function public.purchase_business_location_rpc(p_player_id uuid,p_location_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.players; l public.business_locations; result_business public.businesses; total integer;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;

  select * into l from public.business_locations where location_key=p_location_key for update;
  if not found then return jsonb_build_object('error','Такая точка не найдена'); end if;
  if l.business_id is not null then return jsonb_build_object('error','Эта точка уже занята'); end if;
  if l.purchase_price is null then return jsonb_build_object('error','Цена этой точки ещё не установлена'); end if;
  if l.biz_type not in ('coffee','salon','taxi','construction','minimarket','auto_repair','casino') then
    return jsonb_build_object('error','Этот тип бизнеса ещё не доступен для покупки');
  end if;

  select count(*) into total from public.businesses where owner_id=p_player_id;
  if total>=3 then return jsonb_build_object('error','У одного игрока может быть не больше трёх бизнесов'); end if;
  if coalesce(p.money,0)<l.purchase_price then return jsonb_build_object('error','Не хватает денег'); end if;

  update public.players set money=money-l.purchase_price where id=p_player_id returning * into p;
  insert into public.businesses(owner_id,owner_name,biz_type,business_name,location_key)
    values(p_player_id,p.nickname,l.biz_type,l.business_name,l.location_key) returning * into result_business;
  update public.business_locations set business_id=result_business.id where location_key=l.location_key;
  return jsonb_build_object('success',true,'business_id',result_business.id,
    'biz_type',result_business.biz_type,'business_name',result_business.business_name,
    'price',l.purchase_price,'money',p.money,'owned_count',total+1);
end $$;

revoke all on function public.purchase_business_location_rpc(uuid,text) from public,anon,authenticated;
grant execute on function public.purchase_business_location_rpc(uuid,text) to service_role;
notify pgrst,'reload schema';
