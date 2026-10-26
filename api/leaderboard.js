import { createClient } from '@supabase/supabase-js';
import { verifyTelegramInitData } from './_telegram.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { BOT_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!BOT_TOKEN || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Leaderboard service is not configured' });
  }
  if (!verifyTelegramInitData(req.body?.init_data, BOT_TOKEN)) {
    return res.status(403).json({ error: 'Telegram authentication required' });
  }

  try {
    const sb = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.from('referral_leaderboard')
      .select('nickname, referral_count')
      .order('referral_count', { ascending: false })
      .order('nickname', { ascending: true })
      .limit(10);
    if (error) throw error;
    return res.status(200).json({ players: data || [] });
  } catch (error) {
    console.error('Referral leaderboard failed:', error?.message || error);
    return res.status(500).json({ error: 'Could not load referral leaderboard' });
  }
}
