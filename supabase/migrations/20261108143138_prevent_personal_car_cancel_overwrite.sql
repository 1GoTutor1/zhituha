-- Do not let cancelling an older personal-car listing replace a newer car
-- acquired into the player's single active-car slot. Keep the listing active
-- until the player frees that slot.
create or replace function public.cancel_lot_rpc(
  p_player_id uuid,
  p_item_id uuid,
  p_add_stock boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
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
$$;

notify pgrst, 'reload schema';
