import { createClient } from '@supabase/supabase-js';
import { verifyTelegramInitData } from './_telegram.js';
import { blockDuringMaintenance, readMaintenance } from './_maintenance.js';

const CLIENT_RPCS = new Set([
  'update_profile_rpc', 'work_rpc', 'drink_tutorial_coffee_rpc', 'claim_tutorial_reward_rpc', 'claim_daily_reward_rpc', 'collect_coffee_energy_rpc', 'finish_business_timer_rpc',
  'taxi_collect_rpc', 'start_phone_order_rpc',
  'cancel_lot_rpc', 'start_car_order_rpc', 'start_build_rpc', 'rest_rpc',
  'upgrade_business_passive_rpc', 'collect_business_passive_rpc',
  'buy_coffee_rpc', 'collect_coffee_cash_rpc', 'hire_worker_rpc', 'fire_worker_rpc', 'quit_job_rpc',
  'buy_phone_rpc', 'list_item_rpc', 'buy_market_item', 'collect_ref_bonus_rpc', 'collect_tips_rpc',
  'redeem_promo', 'reset_game_rpc', 'log_action_rpc', 'get_logs_rpc', 'cleanup_logs_rpc',
  'admin_give_money_rpc', 'admin_set_ban_rpc', 'admin_delete_biz_rpc', 'create_promo_rpc',
  'get_casino_round_rpc', 'place_bet_rpc',
  'profession_state_rpc', 'select_profession_rpc', 'start_profession_cycle_rpc',
  'profession_step_rpc', 'finish_profession_cycle_rpc', 'claim_profession_reward_rpc',
  'sell_inventory_rpc', 'taxi_fleet_rpc', 'select_taxi_car_rpc',
  'business_catalog_rpc', 'purchase_business_location_rpc', 'sell_business_to_state_rpc',
  'create_business_auction_rpc', 'bid_business_auction_rpc',
  'business_shop_state_rpc', 'business_cash_transfer_rpc', 'business_shop_restock_rpc', 'business_shop_set_price_rpc', 'business_shop_buy_rpc',
  'business_repair_personal_car_rpc', 'business_repair_taxi_car_rpc',
  'business_vehicle_state_rpc', 'taxi_purchase_vehicle_rpc',
  'bank_get_state_rpc', 'bank_move_cash_rpc', 'bank_transfer_rpc', 'bank_open_deposit_rpc',
  'bank_close_deposit_rpc', 'bank_buy_stock_rpc', 'bank_sell_stock_rpc', 'bank_apply_loan_rpc',
  'bank_repay_loan_rpc',
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
  if (typeof name !== 'string' || !CLIENT_RPCS.has(name) || !args || typeof args !== 'object' || Array.isArray(args)) {
    return res.status(400).json({ error: 'Unsupported RPC' });
  }

  try {
    const sb = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [playerResult, maintenanceEnabled] = await Promise.all([
      sb.from('players').select('id, role, is_subscribed').eq('telegram_id', String(user.id)).maybeSingle(),
      readMaintenance(sb),
    ]);
    const { data: player, error: playerError } = playerResult;
    if (playerError) throw playerError;
    if (await blockDuringMaintenance(sb, player, res, maintenanceEnabled)) return;
    if (!player && name !== 'get_casino_round_rpc') {
      return res.status(404).json({ error: 'Player not registered' });
    }
    if (player && player.is_subscribed !== true) {
      return res.status(403).json({ error: 'Подпишись на Telegram-канал Житухи и нажми «Проверить подписку».' });
    }

    const safeArgs = { ...args };
    if (player) {
      for (const key of Object.keys(safeArgs)) {
        if (/^p_(player|owner|buyer|admin)_id$/.test(key)) safeArgs[key] = player.id;
      }
    } else if (name === 'get_casino_round_rpc') safeArgs.p_player_id = null;
    if (name === 'add_referral_balance') return res.status(400).json({ error: 'Unsupported RPC' });
    if (name === 'fire_worker_rpc') safeArgs.p_player_id = player.id;

    const { data, error } = await sb.rpc(name, safeArgs);
    if (error) {
      console.error('RPC failed:', name, error.code, error.message);
      if (['business_catalog_rpc', 'purchase_business_location_rpc', 'sell_business_to_state_rpc', 'create_business_auction_rpc', 'bid_business_auction_rpc'].includes(name)
          && ['PGRST202', '42883', '42P01', '42703'].includes(error.code)) {
        return res.status(400).json({ error: 'Обновление каталога бизнесов ещё не установлено в Supabase. Примените миграцию профессий и инвентаря, затем BUSINESS_LOCATIONS_MIGRATION.sql.' });
      }
      if (['business_shop_state_rpc', 'business_cash_transfer_rpc', 'business_shop_restock_rpc', 'business_shop_set_price_rpc', 'business_shop_buy_rpc', 'business_repair_personal_car_rpc', 'business_repair_taxi_car_rpc', 'business_vehicle_state_rpc', 'taxi_purchase_vehicle_rpc', 'start_car_order_rpc', 'finish_business_timer_rpc', 'taxi_collect_rpc'].includes(name)
          && ['PGRST202', '42883', '42P01', '42703'].includes(error.code)) {
        return res.status(400).json({ error: 'Система бизнесов ещё не установлена полностью. Проверьте BUSINESS_COMMERCE_MIGRATION.sql и DEALERSHIP_FLEET_MIGRATION.sql.' });
      }
      if (['profession_state_rpc', 'select_profession_rpc', 'start_profession_cycle_rpc', 'profession_step_rpc', 'finish_profession_cycle_rpc', 'claim_profession_reward_rpc', 'sell_inventory_rpc', 'taxi_fleet_rpc', 'select_taxi_car_rpc'].includes(name)
          && ['PGRST202', '42883', '42P01', '42703'].includes(error.code)) {
        return res.status(400).json({ error: 'Обновление профессий ещё не установлено в Supabase. Проверьте миграцию PROFESSIONS_INVENTORY_MIGRATION.sql.' });
      }
      if (['profession_state_rpc', 'select_profession_rpc', 'start_profession_cycle_rpc', 'profession_step_rpc', 'finish_profession_cycle_rpc', 'claim_profession_reward_rpc', 'sell_inventory_rpc', 'taxi_fleet_rpc', 'select_taxi_car_rpc'].includes(name)) {
        const detail = String(error.message || '').replace(/[\r\n]+/g, ' ').slice(0, 180);
        return res.status(400).json({ error: `Ошибка профессии (${error.code || 'без кода'}): ${detail || 'не удалось выполнить действие'}` });
      }
      if (name.startsWith('bank_')) {
        if (error.code === 'PGRST202' || error.code === '42883') {
          return res.status(400).json({ error: `Банковская функция ${name} не найдена в Supabase. Проверь, что применены SQL-миграции банка.` });
        }
        if (error.code === '42P01') {
          return res.status(400).json({ error: 'Не найдена таблица банка в Supabase. Выполни BANK_MIGRATION.sql.' });
        }
        if (error.code === '42703') {
          return res.status(400).json({ error: 'Схема банка устарела: не хватает колонки. Выполни актуальную миграцию банка.' });
        }
        if (error.code === '42501') {
          return res.status(400).json({ error: `Supabase запретил выполнение ${name}. Проверь права service_role в банковской миграции.` });
        }
        return res.status(400).json({ error: `Ошибка банковского запроса (${error.code || 'без кода'}). Подробности есть в логах Vercel: api/rpc.` });
      }
      if (name === 'list_item_rpc' && error.message?.includes('Заложенное имущество')) {
        return res.status(400).json({ error: 'Сначала погаси кредит, чтобы продать заложенное имущество' });
      }
      return res.status(400).json({ error: 'RPC failed' });
    }
    return res.status(200).json({ data });
  } catch (error) {
    console.error('RPC gateway error:', error?.message || error);
    return res.status(500).json({ error: 'RPC service failed' });
  }
}
