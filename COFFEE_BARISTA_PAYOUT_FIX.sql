-- Fix coffee sale payouts. Each sold cup adds 60 to the barista's withdrawable tips.
create or replace function public.buy_coffee_rpc(p_buyer_id uuid, p_cafe_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  buyer public.players%rowtype;
  cafe public.businesses%rowtype;
  barista public.business_workers%rowtype;
  helper public.business_workers%rowtype;
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  owner_share integer;
begin
  select * into buyer from public.players where id = p_buyer_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;
  if coalesce(buyer.money, 0) < 500 then
    return jsonb_build_object('error', 'Недостаточно денег');
  end if;

  select * into cafe from public.businesses
  where id = p_cafe_id and biz_type = 'coffee' for update;
  if not found then return jsonb_build_object('error', 'Кофейня не найдена'); end if;
  if coalesce(buyer.brew_end, 0) > now_ms then
    return jsonb_build_object('error', 'Кофе уже готовится');
  end if;

  select * into barista from public.business_workers
  where business_id = p_cafe_id and role = 'Бариста' and player_id is not null
  limit 1 for update;
  if not found then return jsonb_build_object('error', 'В кафе нет бариста'); end if;

  select * into helper from public.business_workers
  where business_id = p_cafe_id and role = 'Помощник бариста' and player_id is not null
  limit 1 for update;
  owner_share := case when found then 410 else 440 end;

  -- Accumulate every cup's wage; do not overwrite prior tips.
  update public.players
  set tip_balance = coalesce(tip_balance, 0) + 60
  where id = barista.player_id;
  if not found then return jsonb_build_object('error', 'Бариста не найден'); end if;

  if helper.player_id is not null then
    update public.players
    set tip_balance = coalesce(tip_balance, 0) + 30
    where id = helper.player_id;
  end if;

  update public.players set money = money - 500, brew_end = now_ms + 15000
  where id = p_buyer_id;
  update public.businesses
  set coffee_balance = coalesce(coffee_balance, 0) + owner_share
  where id = p_cafe_id;

  return jsonb_build_object(
    'brew_end', now_ms + 15000,
    'money', buyer.money - 500,
    'owner_share', owner_share,
    'cafe_id', p_cafe_id
  );
end;
$$;

revoke all on function public.buy_coffee_rpc(uuid, uuid) from public, anon, authenticated;
grant execute on function public.buy_coffee_rpc(uuid, uuid) to service_role;
notify pgrst, 'reload schema';
