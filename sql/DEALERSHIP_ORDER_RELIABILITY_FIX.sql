-- Prevent a completed dealership delivery from being overwritten when the
-- client's completion request was missed or temporarily failed.
-- Apply after DEALERSHIP_BAD_MODEL_FIX.sql.

do $$
begin
  if to_regclass('public.business_vehicle_catalog') is null then
    raise exception 'business_vehicle_catalog is missing; apply the dealership fleet migration first';
  end if;
end $$;

create or replace function public.start_car_order_rpc(
  p_biz_id uuid,
  p_player_id uuid,
  p_model text,
  p_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  b public.businesses;
  v public.business_vehicle_catalog;
  v_salon_class text;
  v_stock jsonb;
  v_pending_model text;
  v_pending_amount integer;
  price bigint;
  fine bigint := 0;
  duration bigint;
  finish_at bigint;
  mech integer;
  seller integer;
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
begin
  if p_amount is null or p_amount < 1 or p_amount > 10 then
    return jsonb_build_object('error', 'За заказ можно взять от 1 до 10 машин');
  end if;

  perform public.assert_owner(p_biz_id, p_player_id);
  select * into b from public.businesses where id = p_biz_id for update;

  if not found or b.biz_type <> 'salon' then
    return jsonb_build_object('error', 'Это не автосалон');
  end if;

  -- Finalize an expired delivery under the same row lock before a new order
  -- can replace its model/amount fields.
  if coalesce(b.car_order_end, 0) > now_ms then
    return jsonb_build_object('error', 'Сначала дождись текущей поставки');
  elsif coalesce(b.car_order_end, 0) > 0 then
    v_stock := coalesce(b.stock, '{}'::jsonb);
    v_pending_model := v_stock->>'current_model';
    v_pending_amount := coalesce((v_stock->>'order_amount')::integer, 0);

    if v_pending_model is null or v_pending_amount < 1 or v_pending_amount > 10
       or not exists (
         select 1 from public.business_vehicle_catalog vc
         where vc.model_id = v_pending_model
       ) then
      return jsonb_build_object('error', 'Не удалось подтвердить завершённую поставку; обратись к администратору');
    end if;

    v_stock := jsonb_set(
      v_stock,
      array[v_pending_model],
      to_jsonb(greatest(0, coalesce((v_stock->>v_pending_model)::integer, 0)) + v_pending_amount)
    );
    v_stock := jsonb_set(jsonb_set(v_stock, '{current_model}', '"none"'::jsonb), '{order_amount}', '0'::jsonb);
    update public.businesses
    set stock = v_stock, car_order_end = 0
    where id = b.id;
    b.stock := v_stock;
    b.car_order_end := 0;
  end if;

  v_salon_class := case b.location_key
    when 'salon_mid' then 'mid'
    when 'salon_high' then 'high'
    else 'low'
  end;

  select * into v
  from public.business_vehicle_catalog vc
  where vc.model_id = p_model
    and vc.salon_class = v_salon_class;

  if not found then
    return jsonb_build_object('error', 'Эта модель не продаётся в данном классе автосалона');
  end if;

  price := v.base_price * p_amount;
  mech := public.role_count(p_biz_id, 'Механик');
  seller := public.role_count(p_biz_id, 'Продавец');

  if mech = 0 then
    return jsonb_build_object('error', 'Для заказа нужен механик');
  end if;

  duration := v.order_ms;
  if seller = 0 then
    duration := duration * 3;
    fine := floor(price * 0.10);
  end if;

  if coalesce(b.cash_balance, 0) < price + fine then
    return jsonb_build_object('error', 'В кассе бизнеса не хватает денег на заказ и штраф');
  end if;

  finish_at := now_ms + duration;
  v_stock := coalesce(b.stock, '{}'::jsonb);
  v_stock := jsonb_set(jsonb_set(jsonb_set(v_stock, '{current_model}', to_jsonb(v.model_id)), '{order_amount}', to_jsonb(p_amount)), '{order_fine}', to_jsonb(fine));

  update public.businesses
  set car_order_end = finish_at,
      stock = v_stock,
      cash_balance = coalesce(cash_balance, 0) - (price + fine)
  where id = b.id;

  return jsonb_build_object(
    'success', true,
    'cash_balance', coalesce(b.cash_balance, 0) - (price + fine),
    'car_order_end', finish_at,
    'fine', fine,
    'model', v.model_id,
    'model_name', v.model_name,
    'amount', p_amount
  );
exception
  when others then
    return jsonb_build_object('error', 'Не удалось оформить поставку');
end;
$$;

revoke all on function public.start_car_order_rpc(uuid, uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.start_car_order_rpc(uuid, uuid, text, integer)
  to service_role;
