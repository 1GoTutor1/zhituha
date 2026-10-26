import { createClient } from '@supabase/supabase-js';
import { verifyTelegramInitData } from './_telegram.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { BOT_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!BOT_TOKEN || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Player service is not configured' });
  const user = verifyTelegramInitData(req.body?.init_data, BOT_TOKEN);
  if (!user) return res.status(403).json({ error: 'Telegram authentication required' });

  const sb = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { action } = req.body || {};
  try {
    if (action === 'leaderboard') {
      const { data, error } = await sb.from('players').select('nickname, money').order('money', { ascending: false }).limit(10);
      if (error) throw error;
      return res.status(200).json({ players: data || [] });
    }

    const { data: player, error: playerError } = await sb.from('players').select('*').eq('telegram_id', String(user.id)).maybeSingle();
    if (playerError) throw playerError;
    if (!player) return res.status(200).json({ player: null, referrals: [] });

    if (action === 'me') {
      const { data: referrals, error } = await sb.from('players').select('nickname').eq('referred_by', String(user.id));
      if (error) throw error;
      return res.status(200).json({ player, referrals: referrals || [] });
    }
    if (action === 'admin_search') {
      if (!['admin', 'superadmin'].includes(player.role)) return res.status(403).json({ error: 'Admin access required' });
      const query = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 40) : '';
      if (!query) return res.status(200).json({ players: [] });
      const { data, error } = await sb.from('players').select('id, nickname, money, is_banned').ilike('nickname', `%${query}%`).limit(5);
      if (error) throw error;
      return res.status(200).json({ players: data || [] });
    }
    if (action === 'casino_money') return res.status(200).json({ money: player.money });
    return res.status(400).json({ error: 'Unsupported player action' });
  } catch (error) {
    console.error('Player API failed:', error?.message || error);
    return res.status(500).json({ error: 'Player service failed' });
  }
}
