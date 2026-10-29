-- Pay the configured barista wage for every cup sold through the player cafe shop.
-- Espresso, cappuccino and latte all use their actual shop retail price for the
-- buyer/business accounting; the barista receives the advertised fixed wage.

do $$
begin
  if to_regprocedure('public.business_shop_buy_rpc_before_coffee_sales_payout(uuid,uuid,text,integer)') is null then
    execute 'alter function public.business_shop_buy_rpc(uuid,uuid,text,integer) rename to business_shop_buy_rpc_before_coffee_sales_payout';
  end if;
end $$;

create or replace function public.business_shop_buy_rpc(
  p_player_id uuid,p_business_id uuid,p_product_id text,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare
  result_json jsonb;
  barista_id uuid;
  wage_per_cup bigint;
  payout bigint;
begin
  -- This calls the currently installed coffee-bonus wrapper, preserving the
  -- drink duration bonus and all existing sale, stock and buyer checks.
  result_json:=public.business_shop_buy_rpc_before_coffee_sales_payout(
    p_player_id,p_business_id,p_product_id,p_quantity);

  if result_json ? 'error' or coalesce((result_json->>'success')::boolean,false) is not true then
    return result_json;
  end if;

  if p_product_id not in ('coffee_small','coffee_medium','coffee_large') then
    return result_json;
  end if;

  select w.player_id, w.salary::bigint
    into barista_id, wage_per_cup
  from public.businesses b
  join public.business_workers w on w.business_id=b.id
  where b.id=p_business_id and b.biz_type='coffee' and w.role='Бариста'
  order by w.created_at
  limit 1;

  if barista_id is null then
    raise exception 'У кафе нет бариста для начисления оплаты';
  end if;

  payout:=greatest(0,coalesce(wage_per_cup,60))*p_quantity;

  -- Remove the old 5% direct-wallet commission. The advertised per-cup wage is
  -- accumulated in tip_balance and withdrawn from the existing job screen.
  update public.players
  set money=coalesce(money,0)-coalesce((result_json->>'commission')::bigint,0),
      tip_balance=coalesce(tip_balance,0)+payout
  where id=barista_id;
  if not found then raise exception 'Профиль бариста не найден'; end if;

  return result_json || jsonb_build_object(
    'commission',payout,
    'barista_payout',payout,
    'barista_tip_balance',(
      select tip_balance from public.players where id=barista_id
    )
  );
end $$;

revoke all on function public.business_shop_buy_rpc(uuid,uuid,text,integer),
  public.business_shop_buy_rpc_before_coffee_sales_payout(uuid,uuid,text,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.business_shop_buy_rpc(uuid,uuid,text,integer)
  to service_role;

notify pgrst,'reload schema';
