import { createClient } from '@supabase/supabase-js';
import { verifyTelegramInitData } from './_telegram.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { BOT_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!BOT_TOKEN || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Registration service is not configured' });

  const user = verifyTelegramInitData(req.body?.init_data, BOT_TOKEN);
  if (!user) return res.status(403).json({ error: 'Telegram authentication required' });
  const nickname = typeof req.body?.nickname === 'string' ? req.body.nickname.trim().slice(0, 40) : '';
  const gender = req.body?.gender;
  const avatarId = Number(req.body?.avatar_id);
  if (!nickname || !['male', 'female'].includes(gender) || !Number.isInteger(avatarId) || avatarId < 1 || avatarId > 100) {
    return res.status(400).json({ error: 'Invalid registration data' });
  }

  const sb = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  try {
    const telegramId = String(user.id);
    const { data: existing, error: lookupError } = await sb.from('players').select('id').eq('telegram_id', telegramId).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return res.status(409).json({ error: 'Player already registered' });

    let referrerId = null;
    const rawReferrer = typeof req.body?.referrer_id === 'string' ? req.body.referrer_id : '';
    if (/^\d{1,20}$/.test(rawReferrer) && rawReferrer !== telegramId) {
      const { data: referrer, error } = await sb.from('players').select('id').eq('telegram_id', rawReferrer).maybeSingle();
      if (error) throw error;
      referrerId = referrer?.id || null;
    }

    const { data: player, error: insertError } = await sb.from('players').insert({
      telegram_id: telegramId,
      nickname,
      gender,
      avatar_id: avatarId,
      money: referrerId ? 4500 : 3500,
      energy: 80,
      phone_count: 0,
      has_car: false,
      has_house: false,
      last_rest_time: 0,
      referred_by: referrerId ? rawReferrer : null,
      is_subscribed: true,
      role: 'player',
      is_banned: false,
      referral_balance: 0,
      tip_balance: 0,
      onboarding_step: 0,
      market_slots: 3,
    }).select('*').single();
    if (insertError) throw insertError;

    if (referrerId) {
      const { error } = await sb.rpc('change_stats', { p_player_id: referrerId, p_money_diff: 500, p_energy_diff: 0 });
      if (error) console.error('Referral reward failed:', error.message);
    }
    return res.status(201).json({ player, referred: !!referrerId });
  } catch (error) {
    console.error('Registration failed:', error?.message || error);
    return res.status(500).json({ error: 'Registration failed' });
  }
}
