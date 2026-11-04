-- Admin-only reset for one selected player. Apply after supabase_schema.sql and
-- the migrations for features that are currently installed in this project.
-- Family membership/role, family scores, referral links/balances, account
-- identity, ban/subscription status, and audit/payment history are preserved.

create or replace function public.admin_reset_player_rpc(
  p_admin_id uuid,
  p_target_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_admin_role text;
  v_target public.players;
  v_column text;
  v_expression text;
  v_set_clause text := '';
  v_business_count integer := 0;
begin
  select role into v_admin_role
  from public.players
  where id = p_admin_id;

  if coalesce(v_admin_role, '') not in ('admin', 'superadmin') then
    return jsonb_build_object('error', 'Недостаточно прав');
  end if;

  if p_target_player_id is null then
    return jsonb_build_object('error', 'Не выбран игрок');
  end if;

  select * into v_target
  from public.players
  where id = p_target_player_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Игрок не найден');
  end if;

  select count(*)::integer into v_business_count
  from public.businesses
  where owner_id = p_target_player_id;

  -- Clear ride rows first: a driver FK intentionally prevents deleting a player
  -- while a trip references them.
  if to_regclass('public.district_taxi_rides') is not null then
    execute 'delete from public.district_taxi_rides
      where player_id = $1 or driver_id = $1
         or business_id in (select id from public.businesses where owner_id = $1)'
      using p_target_player_id;
  end if;

  -- Return escrow from the player's businesses to their current bidders before
  -- removing those auctions. A reset bidder loses their bid with the rest of
  -- their balance, but the auction reopens at its original starting price.
  if to_regclass('public.business_auctions') is not null then
    execute 'update public.players p
      set money = coalesce(p.money, 0) + a.highest_bid
      from public.business_auctions a
      where a.seller_id = $1
        and a.highest_bidder_id is not null
        and a.highest_bidder_id <> $1
        and p.id = a.highest_bidder_id'
      using p_target_player_id;

    execute 'delete from public.business_auctions a
      where a.seller_id = $1
         or a.business_id in (select id from public.businesses where owner_id = $1)'
      using p_target_player_id;

    execute 'update public.business_auctions
      set highest_bid = starting_price, highest_bidder_id = null
      where highest_bidder_id = $1'
      using p_target_player_id;
  end if;

  -- Remove the player's listed property and businesses. Business-owned stock,
  -- cash, passive income, autostock rules and lease records follow their FKs.
  if to_regclass('public.market_items') is not null then
    execute 'delete from public.market_items where seller_id = $1' using p_target_player_id;
  end if;

  if to_regclass('public.business_workers') is not null then
    execute 'delete from public.business_workers
      where player_id = $1
         or business_id in (select id from public.businesses where owner_id = $1)'
      using p_target_player_id;
  end if;

  delete from public.businesses where owner_id = p_target_player_id;

  -- Remove current bank assets/liabilities; retain bank_transactions as an
  -- immutable history for support and economy audits.
  if to_regclass('public.bank_deposits') is not null then
    execute 'delete from public.bank_deposits where player_id = $1' using p_target_player_id;
  end if;
  if to_regclass('public.bank_stock_holdings') is not null then
    execute 'delete from public.bank_stock_holdings where player_id = $1' using p_target_player_id;
  end if;
  if to_regclass('public.bank_loans') is not null then
    execute 'delete from public.bank_loans where player_id = $1' using p_target_player_id;
  end if;
  if to_regclass('public.bank_accounts') is not null then
    execute 'update public.bank_accounts set balance = 0, updated_at = clock_timestamp() where player_id = $1'
      using p_target_player_id;
  end if;

  if to_regclass('public.player_inventory') is not null then
    execute 'delete from public.player_inventory where player_id = $1' using p_target_player_id;
  end if;
  if to_regclass('public.taxi_driver_assignments') is not null then
    execute 'delete from public.taxi_driver_assignments where player_id = $1' using p_target_player_id;
  end if;
  if to_regclass('public.profession_cycles') is not null then
    execute 'update public.profession_cycles set status = ''cancelled''
      where player_id = $1 and status = ''active'''
      using p_target_player_id;
  end if;

  -- Reset black-market inventory and cultivation, while preserving the family
  -- event contribution rows so the family's score and history do not change.
  if to_regclass('public.black_market_wallets') is not null then
    execute 'update public.black_market_wallets set seeds = 0, crop_units = 0 where player_id = $1'
      using p_target_player_id;
  end if;
  if to_regclass('public.black_market_plots') is not null then
    execute 'delete from public.black_market_plots where player_id = $1' using p_target_player_id;
  end if;

  if to_regclass('public.player_daily_missions') is not null then
    execute 'update public.player_daily_missions set progress = 0
      where player_id = $1 and claimed_at is null'
      using p_target_player_id;
  end if;

  -- Reset season-pass progress, but retain premium-track ownership and claim
  -- ledgers so a reset cannot make already-claimed rewards claimable again.
  if to_regclass('public.season_pass_player_state') is not null then
    execute 'update public.season_pass_player_state
      set xp = 0, earned_badges = ''{}''::text[],
          work_date = null, work_count = 0,
          sale_date = null, sale_count = 0,
          profession_date = null, profession_count = 0
      where player_id = $1'
      using p_target_player_id;
  end if;

  -- Base player columns are stable; optional fields are reset only when the
  -- corresponding feature migration has installed them. Referral and family
  -- fields are deliberately absent from this list.
  for v_column, v_expression in
    select c.column_name, reset_fields.expression
    from (values
      ('money', '3500'),
      ('energy', '80'),
      ('phone_count', '0'),
      ('has_car', 'false'),
      ('car_model', quote_literal('none')),
      ('car_health', '100'),
      ('has_house', 'false'),
      ('house_type', quote_literal('none')),
      ('tip_balance', '0'),
      ('daily_streak', '0'),
      ('last_claim', '0'),
      ('boost_end', '0'),
      ('onboarding_step', '0'),
      ('player_level', '1'),
      ('player_xp', '0'),
      ('active_profession', quote_literal('miner')),
      ('profession', quote_literal('miner')),
      ('unlocked_professions', 'array[' || quote_literal('miner') || ']::text[]'),
      ('market_slots', '3'),
      ('premium_balance', '0'),
      ('owned_cosmetics', '''{}''::text[]'),
      ('profile_frame', quote_literal('')),
      ('profile_background', quote_literal('')),
      ('season_badge_showcase', '''{}''::text[]'),
      ('return_boost_until', 'null')
    ) as reset_fields(column_name, expression)
    join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name = 'players'
     and c.column_name = reset_fields.column_name
  loop
    v_set_clause := v_set_clause || case when v_set_clause = '' then '' else ', ' end
      || format('%I = %s', v_column, v_expression);
  end loop;

  if v_set_clause <> '' then
    execute 'update public.players set ' || v_set_clause || ' where id = $1'
      using p_target_player_id;
  end if;

  perform public.log_action_rpc(
    p_admin_id,
    'admin_reset_player',
    jsonb_build_object(
      'target_player_id', p_target_player_id,
      'target_telegram_id', v_target.telegram_id,
      'target_nickname', v_target.nickname,
      'businesses_removed', v_business_count,
      'family_and_referrals_preserved', true
    ),
    null,
    null
  );

  return jsonb_build_object(
    'success', true,
    'player_id', p_target_player_id,
    'nickname', v_target.nickname,
    'money', 3500,
    'businesses_removed', v_business_count,
    'family_preserved', true,
    'referrals_preserved', true
  );
end;
$$;

revoke all on function public.admin_reset_player_rpc(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_reset_player_rpc(uuid, uuid) to service_role;
