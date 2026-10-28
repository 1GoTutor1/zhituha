import { createClient } from '@supabase/supabase-js';
import { verifyTelegramInitData } from './_telegram.js';
import { blockDuringMaintenance, readMaintenance } from './_maintenance.js';

const CLIENT_RPCS = new Set([
  'update_profile_rpc', 'work_rpc', 'drink_tutorial_coffee_rpc', 'claim_tutorial_reward_rpc', 'claim_daily_reward_rpc', 'collect_coffee_energy_rpc', 'finish_business_timer_rpc',
  'taxi_add_car_rpc', 'taxi_collect_rpc', 'taxi_repair_rpc', 'start_phone_order_rpc', 'buy_business_rpc',
  'sell_business_rpc', 'cancel_lot_rpc', 'start_car_order_rpc', 'start_build_rpc', 'rest_rpc',
  'upgrade_business_passive_rpc', 'collect_business_passive_rpc',
  'buy_coffee_rpc', 'collect_coffee_cash_rpc', 'hire_worker_rpc', 'fire_worker_rpc', 'quit_job_rpc',
  'buy_phone_rpc', 'list_item_rpc', 'buy_market_item', 'collect_ref_bonus_rpc', 'collect_tips_rpc',
  'redeem_promo', 'reset_game_rpc', 'log_action_rpc', 'get_logs_rpc', 'cleanup_logs_rpc',
  'admin_give_money_rpc', 'admin_set_ban_rpc', 'admin_delete_biz_rpc', 'create_promo_rpc',
  'get_casino_round_rpc', 'place_bet_rpc',
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
      sb.from('players').select('id, role').eq('telegram_id', String(user.id)).maybeSingle(),
      readMaintenance(sb),
    ]);
    const { data: player, error: playerError } = playerResult;
    if (playerError) throw playerError;
    if (await blockDuringMaintenance(sb, player, res, maintenanceEnabled)) return;
    if (!player && name !== 'get_casino_round_rpc') {
      return res.status(404).json({ error: 'Player not registered' });
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
      console.error('RPC failed:', name, error.message);
      if (name === 'list_item_rpc' && error.message?.includes('Заложенное имущество')) {
        return res.status(400).json({ error: 'Сначала погаси кредит, чтобы продать заложенное имущество' });
      }
      if (name === 'sell_business_rpc' && error.message?.includes('Заложенный бизнес')) {
        return res.status(400).json({ error: 'Сначала погаси кредит, чтобы продать бизнес' });
      }
      return res.status(400).json({ error: 'RPC failed' });
    }
    return res.status(200).json({ data });
  } catch (error) {
    console.error('RPC gateway error:', error?.message || error);
    return res.status(500).json({ error: 'RPC service failed' });
  }
}
