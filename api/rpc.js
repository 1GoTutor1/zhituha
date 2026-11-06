import { verifyTelegramInitData } from './_telegram.js';
import { blockDuringMaintenance, readMaintenance } from './_maintenance.js';
import { getServiceClient } from './_supabase.js';

const CLIENT_RPCS = new Set([
  'update_profile_rpc', 'work_rpc', 'verify_work_captcha_rpc', 'drink_tutorial_coffee_rpc', 'claim_tutorial_reward_rpc', 'claim_daily_reward_rpc', 'finish_business_timer_rpc',
  'taxi_collect_rpc', 'start_phone_order_rpc',
  'cancel_lot_rpc', 'list_number_market_lot_rpc', 'buy_number_market_lot_rpc', 'start_car_order_rpc', 'start_build_rpc',
  'upgrade_business_passive_rpc', 'upgrade_leased_business_passive_rpc', 'collect_business_passive_rpc',
  'buy_coffee_rpc', 'collect_coffee_cash_rpc', 'hire_worker_rpc', 'fire_worker_rpc', 'quit_job_rpc',
  'buy_phone_rpc', 'list_item_rpc', 'buy_market_item', 'collect_ref_bonus_rpc', 'collect_tips_rpc',
  'redeem_promo', 'reset_game_rpc', 'log_action_rpc', 'get_logs_rpc', 'cleanup_logs_rpc',
  'admin_give_money_rpc', 'admin_set_ban_rpc', 'admin_delete_biz_rpc', 'admin_reset_player_rpc', 'create_promo_rpc',
  'admin_delete_market_lot_rpc',
  'get_casino_round_rpc', 'place_bet_rpc', 'casino_slots_spin_rpc', 'casino_slots_history_rpc',
  'profession_state_rpc', 'select_profession_rpc', 'start_profession_cycle_rpc',
  'profession_step_rpc', 'finish_profession_cycle_rpc', 'claim_profession_reward_rpc',
  'sell_inventory_rpc', 'taxi_fleet_rpc', 'select_taxi_car_rpc',
  'business_catalog_rpc', 'purchase_business_location_rpc', 'start_business_lease_rpc', 'finish_business_lease_rpc', 'sell_business_to_state_rpc',
  'create_business_auction_rpc', 'bid_business_auction_rpc',
  'business_shop_state_rpc', 'business_cash_transfer_rpc', 'business_shop_restock_rpc', 'business_shop_set_price_rpc', 'business_shop_buy_rpc',
  'phone_numbers_state_rpc', 'spin_phone_number_rpc', 'sell_phone_number_to_state_rpc', 'activate_phone_number_rpc', 'spin_car_plate_rpc', 'resolve_car_plate_spin_rpc', 'activate_car_number_rpc', 'sell_car_number_to_state_rpc',
  'business_autostock_state_rpc', 'business_autostock_configure_rpc',
  'business_sales_history_rpc',
  'casino_business_state_rpc', 'casino_business_upgrade_rpc',
  'daily_missions_state_rpc', 'daily_mission_claim_rpc',
  'season_pass_state_rpc', 'season_pass_unlock_premium_rpc', 'season_pass_claim_rpc', 'season_pass_select_badges_rpc',
  'business_repair_personal_car_rpc', 'business_repair_taxi_car_rpc',
  'business_vehicle_state_rpc', 'taxi_purchase_vehicle_rpc',
  'bank_get_state_rpc', 'bank_move_cash_rpc', 'bank_transfer_rpc', 'bank_open_deposit_rpc',
  'bank_close_deposit_rpc', 'bank_buy_stock_rpc', 'bank_sell_stock_rpc', 'bank_apply_loan_rpc',
  'bank_repay_loan_rpc',
  'family_state_rpc', 'family_create_rpc', 'family_apply_rpc', 'family_invite_rpc',
  'family_cash_deposit_rpc', 'family_respond_rpc', 'family_leave_rpc', 'family_kick_rpc', 'family_set_deputy_rpc',
  'family_claim_leadership_rpc', 'family_touch_rpc', 'family_territory_attack_rpc', 'family_public_rpc',
  'black_market_state_rpc', 'black_market_buy_seed_rpc', 'black_market_plant_rpc',
  'black_market_harvest_rpc', 'black_market_sell_rpc', 'family_black_market_join_rpc',
  'district_state_rpc', 'district_travel_rpc', 'district_rest_rpc', 'district_rest_state_rpc',
  'district_taxi_options_rpc', 'district_taxi_order_rpc', 'district_taxi_ride_state_rpc', 'district_taxi_finish_ride_rpc',
]);

// Read-only screens may fetch several independent snapshots in one
// authenticated Vercel invocation. Mutating RPCs are never batchable.
const READ_BATCH_RPCS = new Set([
  'business_catalog_rpc', 'business_shop_state_rpc', 'business_autostock_state_rpc',
  'casino_business_state_rpc', 'business_vehicle_state_rpc', 'family_state_rpc',
  'season_pass_state_rpc',
  'black_market_state_rpc', 'bank_get_state_rpc', 'district_taxi_options_rpc',
  'district_rest_state_rpc', 'district_state_rpc', 'district_taxi_ride_state_rpc',
]);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { BOT_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!BOT_TOKEN || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'RPC service is not configured' });
  }

  const user = verifyTelegramInitData(req.body?.init_data, BOT_TOKEN);
  if (!user) return res.status(403).json({ error: 'Telegram authentication required' });
  const { name, args } = req.body || {};
  if (typeof name !== 'string' || (name !== 'read_batch' && !CLIENT_RPCS.has(name)) || !args || typeof args !== 'object' || Array.isArray(args)) {
    return res.status(400).json({ error: 'Unsupported RPC' });
  }

  try {
    const sb = getServiceClient();
    const [playerResult, maintenanceEnabled] = await Promise.all([
      sb.from('players').select('id, role, is_subscribed, is_banned').eq('telegram_id', String(user.id)).maybeSingle(),
      readMaintenance(sb),
    ]);
    const { data: player, error: playerError } = playerResult;
    if (playerError) throw playerError;
    if (await blockDuringMaintenance(sb, player, res, maintenanceEnabled)) return;
    if (!player && name !== 'get_casino_round_rpc') {
      return res.status(404).json({ error: 'Player not registered' });
    }
    if (player?.is_banned === true) {
      return res.status(403).json({ error: 'Аккаунт заблокирован', banned: true });
    }
    if (name === 'admin_reset_player_rpc' && !['admin', 'superadmin'].includes(player?.role)) {
      return res.status(403).json({ error: 'Недостаточно прав для сброса игрока' });
    }
    if (player && player.is_subscribed !== true) {
      return res.status(403).json({ error: 'Подпишись на Telegram-канал Житухи и нажми «Проверить подписку».' });
    }

    if (name === 'read_batch') {
      const requests = args.requests;
      if (!player || !Array.isArray(requests) || requests.length < 1 || requests.length > 6
          || requests.some(request => !request || !READ_BATCH_RPCS.has(request.name)
            || (request.args != null && (typeof request.args !== 'object' || Array.isArray(request.args))))) {
        return res.status(400).json({ error: 'Unsupported RPC batch' });
      }
      const results = await Promise.all(requests.map(request =>
        sb.rpc(request.name, { ...(request.args || {}), p_player_id: player.id })
      ));
      return res.status(200).json({ data: results.map(result => ({
        data: result.data,
        error: result.error ? { message: result.error.message, code: result.error.code } : null,
      })) });
    }

    const safeArgs = { ...args };
    if (player) {
      for (const key of Object.keys(safeArgs)) {
        if (/^p_(player|owner|buyer|admin)_id$/.test(key)) safeArgs[key] = player.id;
      }
    } else if (name === 'get_casino_round_rpc') safeArgs.p_player_id = null;
    if (name === 'add_referral_balance') return res.status(400).json({ error: 'Unsupported RPC' });
    if (name === 'fire_worker_rpc') safeArgs.p_player_id = player.id;

    // This RPC is only for the admin UI's audit trail. Never let a regular
    // player forge arbitrary event names, money changes, or another actor.
    if (name === 'log_action_rpc') {
      if (!['admin', 'superadmin'].includes(player?.role)) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const allowedActions = new Set(['admin_ban', 'admin_unban', 'admin_delete_biz', 'admin_create_promo']);
      if (!allowedActions.has(args.p_action_type)) {
        return res.status(400).json({ error: 'Unsupported audit action' });
      }
      const input = args.p_details && typeof args.p_details === 'object' && !Array.isArray(args.p_details)
        ? args.p_details : {};
      const allowedDetailKeys = args.p_action_type === 'admin_ban' || args.p_action_type === 'admin_unban'
        ? ['target_nick', 'target_id']
        : args.p_action_type === 'admin_delete_biz'
          ? ['target_nick', 'target_id', 'biz_id', 'biz_name']
          : ['code', 'amount', 'max_uses'];
      safeArgs.p_player_id = player.id;
      safeArgs.p_action_type = args.p_action_type;
      safeArgs.p_details = Object.fromEntries(allowedDetailKeys
        .filter((key) => ['string', 'number'].includes(typeof input[key]))
        .map((key) => [key, String(input[key]).slice(0, key === 'target_nick' || key === 'biz_name' ? 80 : 64)]));
      safeArgs.p_money_delta = null;
      safeArgs.p_money_after = null;
    }

    const trackedMissionIds = name === 'work_rpc' ? ['work_5']
      : name === 'sell_inventory_rpc' ? ['sell_1']
        : name === 'finish_profession_cycle_rpc' ? ['profession_1', 'work_5'] : [];
    let missionProgressBefore = null;
    if (trackedMissionIds.length && player) {
      let { data: state, error: missionStateError } = await sb.rpc('daily_missions_state_rpc', { p_player_id: player.id });
      if (missionStateError) {
        // A transient pre-read failure must not silently disable the fallback
        // that reconciles quest progress after the action.
        ({ data: state, error: missionStateError } = await sb.rpc('daily_missions_state_rpc', { p_player_id: player.id }));
      }
      if (state?.missions) {
        missionProgressBefore = Object.fromEntries(trackedMissionIds.map((id) => {
          const mission = state.missions.find((item) => item.id === id);
          return [id, mission ? Number(mission.progress) || 0 : 0];
        }));
      } else {
        // If the state RPC is unavailable, read the authoritative progress
        // rows directly before the action so a successful fallback cannot
        // double-count progress already written by a SQL wrapper.
        const { data: rows, error: rowError } = await sb.from('player_daily_missions')
          .select('mission_id, progress')
          .eq('player_id', player.id)
          .eq('mission_date', new Date().toISOString().slice(0, 10));
        if (!rowError) {
          missionProgressBefore = Object.fromEntries(trackedMissionIds.map((id) => {
            const mission = rows?.find((item) => item.mission_id === id);
            return [id, mission ? Number(mission.progress) || 0 : 0];
          }));
        } else {
          console.error('Daily mission pre-sync failed:', missionStateError?.message, rowError.message);
        }
      }
    }

    let { data, error } = await sb.rpc(name, safeArgs);
    if (error) {
      if (name === 'admin_reset_player_rpc') {
        console.error('Admin player reset failed:', error.code, error.message);
        return res.status(400).json({ error: `Сброс не выполнен (${error.code || 'без кода'}): ${String(error.message || 'ошибка базы данных').slice(0, 240)}` });
      }
      if (name.startsWith('season_pass_') && ['PGRST202', '42883', '42P01', '42703'].includes(error.code)) {
        return res.status(400).json({ error: 'Сезонный пропуск ещё не установлен в Supabase. Выполни sql/SEASON_PASS_MIGRATION.sql после указанных в начале файла миграций.' });
      }
      if (name === 'admin_reset_player_rpc' && ['PGRST202', '42883', '42P01', '42703'].includes(error.code)) {
        return res.status(400).json({ error: 'Сброс игрока ещё не включён в Supabase. Примени sql/ADMIN_PLAYER_RESET_MIGRATION.sql.' });
      }
      // A leased-business collateral rejection is an expected user-facing validation,
      // not an infrastructure failure worth writing to the Vercel error log.
      const leasedCollateralRejected = name === 'bank_apply_loan_rpc'
        && error.code === 'P0001'
        && String(error.message || '').includes('Бизнес в аренде с выкупом нельзя заложить');
      const districtRestCooldownMigrationMissing = ['district_rest_rpc', 'district_rest_state_rpc'].includes(name)
        && ['PGRST202', '42883', '42P01', '42703'].includes(error.code);
      const districtMigrationMissing = ['district_state_rpc', 'district_travel_rpc', 'district_rest_rpc', 'district_rest_state_rpc'].includes(name)
        && ['PGRST202', '42883', '42P01', '42703'].includes(error.code);
      const districtTaxiMigrationMissing = name.startsWith('district_taxi_')
        && ['PGRST202', '42883', '42P01', '42703'].includes(error.code);
      // This RPC is polled in the background; the client already exposes sync failures in the casino UI.
      if (name !== 'get_casino_round_rpc' && !leasedCollateralRejected && !districtMigrationMissing && !districtRestCooldownMigrationMissing && !districtTaxiMigrationMissing) console.error('RPC failed:', name, error.code, error.message);
      if (districtRestCooldownMigrationMissing) {
        return res.status(400).json({ error: 'Восстановление энергии ещё не установлено в Supabase. Примени sql/DISTRICT_ENERGY_REST_COOLDOWN_MIGRATION.sql.' });
      }
      if (districtTaxiMigrationMissing) {
        return res.status(400).json({ error: 'Такси между районами ещё не включено в Supabase. Примените sql/DISTRICT_TAXI_RIDES_MIGRATION.sql.' });
      }
      if (['casino_slots_spin_rpc', 'casino_slots_history_rpc'].includes(name)
          && ['PGRST202', '42883', '42P01', '42703'].includes(error.code)) {
        return res.status(400).json({ error: 'Персональные слоты ещё не установлены в Supabase. Выполни sql/CASINO_PERSONAL_SLOTS_MIGRATION.sql.' });
      }
      if (['start_business_lease_rpc', 'finish_business_lease_rpc'].includes(name) && ['PGRST202', '42883', '42P01', '42703'].includes(error.code)) {
        return res.status(400).json({ error: 'Аренда с выкупом ещё не установлена в Supabase. Примените sql/BUSINESS_LEASE_TO_OWN_MIGRATION.sql.' });
      }
      if (name === 'upgrade_leased_business_passive_rpc' && ['PGRST202', '42883', '42P01', '42703'].includes(error.code)) {
        return res.status(400).json({ error: 'Оплата пассивного дохода из кассы ещё не установлена. Примените sql/BUSINESS_LEASE_PASSIVE_CASH_MIGRATION.sql.' });
      }
      if (['business_catalog_rpc', 'purchase_business_location_rpc', 'start_business_lease_rpc', 'sell_business_to_state_rpc', 'create_business_auction_rpc', 'bid_business_auction_rpc'].includes(name)
          && ['PGRST202', '42883', '42P01', '42703'].includes(error.code)) {
        return res.status(400).json({ error: 'Обновление каталога бизнесов ещё не установлено в Supabase. Примените миграцию профессий и инвентаря, затем sql/BUSINESS_LOCATIONS_MIGRATION.sql.' });
      }
      if (['business_shop_state_rpc', 'business_cash_transfer_rpc', 'business_shop_restock_rpc', 'business_shop_set_price_rpc', 'business_shop_buy_rpc', 'business_repair_personal_car_rpc', 'business_repair_taxi_car_rpc', 'business_vehicle_state_rpc', 'taxi_purchase_vehicle_rpc', 'start_car_order_rpc', 'finish_business_timer_rpc', 'taxi_collect_rpc'].includes(name)
          && ['PGRST202', '42883', '42P01', '42703'].includes(error.code)) {
        return res.status(400).json({ error: 'Система бизнесов ещё не установлена полностью. Проверьте sql/BUSINESS_COMMERCE_MIGRATION.sql и sql/DEALERSHIP_FLEET_MIGRATION.sql.' });
      }
      if (['district_state_rpc', 'district_travel_rpc', 'district_rest_rpc', 'district_rest_state_rpc'].includes(name)
          && ['PGRST202', '42883', '42P01', '42703'].includes(error.code)) {
        return res.status(400).json({ error: 'Районы ещё не установлены в Supabase. Выполни sql/DISTRICTS_ENERGY_MIGRATION.sql после миграций бизнеса.' });
      }
      if (['profession_state_rpc', 'select_profession_rpc', 'start_profession_cycle_rpc', 'profession_step_rpc', 'finish_profession_cycle_rpc', 'claim_profession_reward_rpc', 'sell_inventory_rpc', 'taxi_fleet_rpc', 'select_taxi_car_rpc'].includes(name)
          && ['PGRST202', '42883', '42P01', '42703'].includes(error.code)) {
        return res.status(400).json({ error: 'Обновление профессий ещё не установлено в Supabase. Проверьте миграцию sql/PROFESSIONS_INVENTORY_MIGRATION.sql.' });
      }
      if (['profession_state_rpc', 'select_profession_rpc', 'start_profession_cycle_rpc', 'profession_step_rpc', 'finish_profession_cycle_rpc', 'claim_profession_reward_rpc', 'sell_inventory_rpc', 'taxi_fleet_rpc', 'select_taxi_car_rpc'].includes(name)) {
        const detail = String(error.message || '').replace(/[\r\n]+/g, ' ').slice(0, 180);
        return res.status(400).json({ error: `Ошибка профессии (${error.code || 'без кода'}): ${detail || 'не удалось выполнить действие'}` });
      }
      if (name.startsWith('family_') && ['PGRST202', '42883', '42P01', '42703'].includes(error.code)) {
        const detail = String(error.message || '').replace(/[\r\n]+/g, ' ').slice(0, 180);
        const hint = ['PGRST202', '42883'].includes(error.code)
          ? 'Проверьте наличие функции в Supabase и обновление кеша схемы API.'
          : 'Проверьте указанную таблицу или колонку в sql/FAMILY_SYSTEM_MIGRATION.sql.';
        return res.status(400).json({ error: `Ошибка ${name} (${error.code}): ${detail || 'семейная функция или поле не найдены'}. ${hint}` });
      }
      if (name.startsWith('family_')) {
        const detail = String(error.message || '').replace(/[\r\n]+/g, ' ').slice(0, 180);
        return res.status(400).json({ error: `Ошибка семьи (${error.code || 'без кода'}): ${detail || 'не удалось выполнить действие'}` });
      }
      if (name.startsWith('bank_')) {
        if (error.code === 'PGRST202' || error.code === '42883') {
          return res.status(400).json({ error: `Банковская функция ${name} не найдена в Supabase. Проверь, что применены SQL-миграции банка.` });
        }
        if (error.code === '42P01') {
          return res.status(400).json({ error: 'Не найдена таблица банка в Supabase. Выполни sql/BANK_MIGRATION.sql.' });
        }
        if (error.code === '42703') {
          return res.status(400).json({ error: 'Схема банка устарела: не хватает колонки. Выполни актуальную миграцию банка.' });
        }
        if (error.code === '42501') {
          return res.status(400).json({ error: `Supabase запретил выполнение ${name}. Проверь права service_role в банковской миграции.` });
        }
        if (name === 'bank_apply_loan_rpc' && error.code === 'P0001'
            && String(error.message || '').includes('Бизнес в аренде с выкупом нельзя заложить')) {
          return res.status(400).json({ error: 'Бизнес в аренде с выкупом нельзя заложить. Сначала полностью выкупи его.' });
        }
        return res.status(400).json({ error: `Ошибка банковского запроса (${error.code || 'без кода'}). Подробности есть в логах Vercel: api/rpc.` });
      }
      if (name === 'list_item_rpc' && error.message?.includes('Заложенное имущество')) {
        return res.status(400).json({ error: 'Сначала погаси кредит, чтобы продать заложенное имущество' });
      }
      return res.status(400).json({ error: 'RPC failed' });
    }

    if (trackedMissionIds.length && missionProgressBefore !== null) {
      const actionSucceeded = name === 'work_rpc'
        ? data && !data.error && !data.captcha_required && !data.ignored && !data.blocked && data.work_pay != null
        : name === 'sell_inventory_rpc' ? data?.success === true
          : data && !data.error;
      if (actionSucceeded) {
        const { data: stateAfter, error: stateError } = await sb.rpc('daily_missions_state_rpc', { p_player_id: player.id });
        let missionsAfter = stateAfter?.missions;
        let canCheckAfter = Array.isArray(missionsAfter);
        if (stateError || !missionsAfter) {
          const { data: rows, error: rowError } = await sb.from('player_daily_missions')
            .select('mission_id, progress')
            .eq('player_id', player.id)
            .eq('mission_date', new Date().toISOString().slice(0, 10));
          if (!rowError) {
            missionsAfter = (rows || []).map((row) => ({ id: row.mission_id, progress: row.progress }));
            canCheckAfter = true;
          }
          else console.error('Daily mission post-sync failed:', stateError?.message, rowError.message);
        }
        for (const missionId of trackedMissionIds) {
          const missionAfter = missionsAfter?.find((item) => item.id === missionId);
          const progressAfter = Number(missionAfter?.progress) || 0;
          const progressBefore = missionProgressBefore[missionId];
          if (progressBefore !== null && missionAfter && progressAfter <= progressBefore) {
            const { error: progressError } = await sb.rpc('daily_mission_add_progress', {
              p_player_id: player.id,
              p_mission_id: missionId,
              p_amount: 1,
            });
            if (progressError) {
              console.error('Daily mission progress sync failed:', missionId, progressError.message);
              data = { ...(data || {}), daily_mission_sync_error: true };
            }
          } else if (progressBefore !== null && !canCheckAfter) {
            console.error('Daily mission progress could not be verified:', missionId);
            data = { ...(data || {}), daily_mission_sync_error: true };
          }
        }
      }
    } else if (trackedMissionIds.length && player) {
      const actionSucceeded = name === 'work_rpc'
        ? data && !data.error && !data.captcha_required && !data.ignored && !data.blocked && data.work_pay != null
        : name === 'sell_inventory_rpc' ? data?.success === true
          : data && !data.error;
      if (actionSucceeded) {
        // Pre-read failed. Retry after the action and only repair a still-zero
        // progress row; SQL wrappers normally count it atomically themselves.
        const { data: stateAfter, error: stateError } = await sb.rpc('daily_missions_state_rpc', { p_player_id: player.id });
        if (stateError) {
          console.error('Daily mission post-sync failed:', stateError.code, stateError.message);
        } else {
          for (const missionId of trackedMissionIds) {
            const missionAfter = stateAfter?.missions?.find((item) => item.id === missionId);
            if (missionAfter && (Number(missionAfter.progress) || 0) === 0) {
              const { error: progressError } = await sb.rpc('daily_mission_add_progress', {
                p_player_id: player.id, p_mission_id: missionId, p_amount: 1,
              });
              if (progressError) console.error('Daily mission progress fallback failed:', missionId, progressError.message);
            }
          }
        }
      }
    }
    return res.status(200).json({ data });
  } catch (error) {
    console.error('RPC gateway error:', error?.message || error);
    return res.status(500).json({ error: 'RPC service failed' });
  }
}
