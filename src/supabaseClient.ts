import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const getTelegramInitData = () => (window as Window & {
  Telegram?: { WebApp?: { initData?: string } };
}).Telegram?.WebApp?.initData || '';

const client = createClient(supabaseUrl as string, supabaseAnonKey as string);

const IDEMPOTENT_RPCS = new Set([
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
  'mining_install_all_rigs_rpc', 'open_number_case_rpc',
]);

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

const getIdempotencyKey = async (name: string, args: Record<string, unknown>) => {
  const serialized = `${name}:${stableSerialize(args)}`;
  let storageKey: string | null = null;
  try {
    if (crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
      storageKey = `zhituha.rpc.pending.${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
    }
  } catch { /* Fall back to a request-local key when Web Crypto is unavailable. */ }

  if (storageKey) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const pending = JSON.parse(stored) as { id?: string; createdAt?: number };
        if (pending.id && Date.now() - Number(pending.createdAt) < 13 * 24 * 60 * 60_000) return { id: pending.id, storageKey };
        localStorage.removeItem(storageKey);
      }
    } catch { /* Storage may be disabled in embedded browsers. */ }
  }

  const id = crypto.randomUUID();
  if (storageKey) {
    try { localStorage.setItem(storageKey, JSON.stringify({ id, createdAt: Date.now() })); } catch { /* Best effort. */ }
  }
  return { id, storageKey };
};

const clearIdempotencyKey = (storageKey: string | null) => {
  if (!storageKey) return;
  try { localStorage.removeItem(storageKey); } catch { /* Best effort. */ }
};

export const supabase = new Proxy(client, {
  get(target, property) {
    if (property === 'rpcBatch') {
      return async (requests: { name: string; args?: Record<string, unknown> }[]) => {
        const initData = getTelegramInitData();
        try {
          const response = await fetch('/api/rpc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'read_batch', args: { requests }, init_data: initData }),
          });
          const result = await response.json();
          if (!response.ok) return { data: null, error: { message: result?.error || 'RPC request failed' } };
          return { data: result.data, error: null };
        } catch (error) {
          return { data: null, error: { message: error instanceof Error ? error.message : 'RPC request failed' } };
        }
      };
    }
    if (property === 'rpc') {
      return async (name: string, args: Record<string, unknown> = {}) => {
        const initData = getTelegramInitData();
        const pending = IDEMPOTENT_RPCS.has(name) ? await getIdempotencyKey(name, args) : null;
        try {
          const response = await fetch('/api/rpc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, args, init_data: initData, ...(pending ? { idempotency_key: pending.id } : {}) }),
          });
          const result = await response.json();
          if (pending && response.status < 500) clearIdempotencyKey(pending.storageKey);
          if (!response.ok) return { data: null, error: { message: result?.error || 'RPC request failed' } };
          return { data: result.data, error: null };
        } catch (error) {
          return { data: null, error: { message: error instanceof Error ? error.message : 'RPC request failed' } };
        }
      };
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
}) as typeof client;
