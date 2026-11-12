create or replace function public.game_rpc_idempotency_call(
  p_player_id uuid,
  p_rpc_name text,
  p_args jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_allowed constant text[] := array[
    'work_rpc', 'verify_work_captcha_rpc', 'claim_tutorial_reward_rpc', 'claim_daily_reward_rpc',
    'taxi_collect_rpc', 'cancel_lot_rpc', 'buy_number_market_lot_rpc', 'start_car_order_rpc',
    'start_build_rpc', 'upgrade_business_passive_rpc', 'collect_business_passive_rpc',
    'buy_coffee_rpc', 'buy_market_item', 'collect_ref_bonus_rpc', 'collect_tips_rpc',
    'place_bet_rpc', 'casino_slots_spin_rpc', 'start_profession_cycle_rpc',
    'profession_step_rpc', 'finish_profession_cycle_rpc', 'claim_profession_reward_rpc',
    'sell_inventory_rpc', 'purchase_business_location_rpc', 'start_business_lease_rpc',
    'finish_business_lease_rpc', 'sell_business_to_state_rpc', 'bid_business_auction_rpc',
    'business_cash_transfer_rpc', 'business_shop_restock_rpc', 'business_shop_buy_rpc',
    'business_repair_personal_car_rpc', 'business_repair_taxi_car_rpc',
    'casino_business_upgrade_rpc', 'daily_mission_claim_rpc', 'season_pass_unlock_premium_rpc',
    'season_pass_claim_rpc', 'taxi_purchase_vehicle_rpc', 'bank_move_cash_rpc',
    'bank_transfer_rpc', 'bank_open_deposit_rpc', 'bank_close_deposit_rpc',
    'bank_buy_stock_rpc', 'bank_sell_stock_rpc', 'bank_apply_loan_rpc', 'bank_repay_loan_rpc',
    'family_create_rpc', 'family_cash_deposit_rpc', 'family_territory_attack_rpc',
    'black_market_buy_seed_rpc', 'black_market_plant_rpc', 'black_market_harvest_rpc',
    'black_market_sell_rpc', 'district_travel_rpc', 'district_rest_rpc',
    'district_taxi_order_rpc', 'district_taxi_finish_ride_rpc',
    'mining_action_rpc', 'mining_sell_coin_rpc', 'mining_turn_on_all_rpc',
    'mining_install_all_rigs_rpc', 'open_number_case_rpc'
  ];
  v_inserted integer;
  v_existing public.game_rpc_idempotency%rowtype;
  v_proc record;
  v_chosen jsonb;
  v_match_count integer := 0;
  v_arg_count integer;
  v_arg_name text;
  v_arg_type oid;
  v_type_name text;
  v_element_type text;
  v_expr text;
  v_call_args text := '';
  v_response jsonb;
  v_i integer;
begin
  if p_player_id is null or p_rpc_name is null or p_request_id is null or p_args is null
     or jsonb_typeof(p_args) <> 'object' then
    raise exception 'Invalid idempotent RPC request';
  end if;
  if not (p_rpc_name = any(v_allowed)) then
    raise exception 'RPC is not enabled for idempotent execution';
  end if;
  if octet_length(p_args::text) > 32768 then
    raise exception 'RPC arguments are too large';
  end if;

  insert into public.game_rpc_idempotency (player_id, request_id, rpc_name, request_args)
  values (p_player_id, p_request_id, p_rpc_name, p_args)
  on conflict (player_id, request_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select * into v_existing
    from public.game_rpc_idempotency
    where player_id = p_player_id and request_id = p_request_id
    for update;
    if v_existing.rpc_name <> p_rpc_name or v_existing.request_args is distinct from p_args then
      raise exception 'Idempotency key was reused for another operation';
    end if;
    if v_existing.response is not null then
      return v_existing.response;
    end if;
    raise exception 'Idempotent operation has no stored result';
  end if;

  -- Pick the one public function overload whose named inputs are satisfied.
  for v_proc in
    select p.proargnames, p.proargtypes::oid[] as arg_types, p.pronargdefaults,
           array_length(p.proargtypes::oid[], 1) as arg_count
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = p_rpc_name and p.prokind = 'f'
    order by p.oid
  loop
    if v_proc.proargnames is null then continue; end if;
    v_arg_count := coalesce(v_proc.arg_count, 0);
    if v_arg_count = 0 or cardinality(v_proc.proargnames) < v_arg_count then continue; end if;
    v_match_count := 0;
    for v_i in 1..v_arg_count loop
      v_arg_name := v_proc.proargnames[v_i];
      if v_arg_name ~ '^p_(player|owner|buyer|admin)_id$' then
        v_match_count := v_match_count + 1;
        continue;
      end if;
      if not (p_args ? v_arg_name) and v_i <= v_arg_count - coalesce(v_proc.pronargdefaults, 0) then
        v_match_count := -100000;
        exit;
      end if;
      if p_args ? v_arg_name then v_match_count := v_match_count + 1; end if;
    end loop;
    if v_match_count >= 0 then
      -- Prefer the overload with the greatest number of explicitly supplied inputs.
      if v_chosen is null or v_match_count > (v_chosen->>'match_count')::integer then
        v_chosen := jsonb_build_object(
          'arg_names', to_jsonb(v_proc.proargnames),
          'arg_types', to_jsonb(v_proc.arg_types),
          'arg_count', v_arg_count,
          'defaults', v_proc.pronargdefaults,
          'match_count', v_match_count
        );
      end if;
    end if;
  end loop;

  if v_chosen is null then
    raise exception 'No matching RPC signature for %', p_rpc_name;
  end if;

  for v_i in 1..(v_chosen->>'arg_count')::integer loop
    v_arg_name := v_chosen->'arg_names'->>(v_i - 1);
    v_arg_type := (v_chosen->'arg_types'->>(v_i - 1))::oid;
    if v_arg_name !~ '^p_(player|owner|buyer|admin)_id$' and not (p_args ? v_arg_name) then continue; end if;
    select pg_catalog.format_type(t.oid, null), t.typelem
      into v_type_name, v_arg_type
      from pg_catalog.pg_type t
     where t.oid = ((v_chosen->'arg_types'->>(v_i - 1))::oid);

    if v_type_name = 'jsonb' then
      v_expr := format('($1 -> %L)', v_arg_name);
    elsif v_type_name = 'json' then
      v_expr := format('(($1 -> %L)::json)', v_arg_name);
    elsif v_arg_type <> 0 then
      select pg_catalog.format_type(v_arg_type, null) into v_element_type;
      v_expr := format(
        '(array(select value::%s from jsonb_array_elements_text($1 -> %L) as item(value)))::%s',
        v_element_type, v_arg_name, v_type_name
      );
    else
      v_expr := format('(($1 ->> %L)::%s)', v_arg_name, v_type_name);
    end if;

    if v_arg_name ~ '^p_(player|owner|buyer|admin)_id$' then
      v_expr := '($2::uuid)';
    end if;
    v_call_args := v_call_args || case when v_call_args = '' then '' else ', ' end
      || format('%I => %s', v_arg_name, v_expr);
  end loop;

  execute format('select to_jsonb(public.%I(%s))', p_rpc_name, v_call_args)
    into v_response using p_args, p_player_id;
  update public.game_rpc_idempotency
     set response = v_response
   where player_id = p_player_id and request_id = p_request_id;

  if get_byte(pg_catalog.uuid_send(p_request_id), 0) % 64 = 0 then
    delete from public.game_rpc_idempotency where created_at < now() - interval '14 days';
  end if;
  return v_response;
end;
$$;

notify pgrst, 'reload schema';
