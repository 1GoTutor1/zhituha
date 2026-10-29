import { createClient } from '@supabase/supabase-js';
import { verifyTelegramInitData } from './_telegram.js';
import { blockDuringMaintenance } from './_maintenance.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { BOT_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!BOT_TOKEN || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Leaderboard service is not configured' });
  }
  const user = verifyTelegramInitData(req.body?.init_data, BOT_TOKEN);
  if (!user) {
    return res.status(403).json({ error: 'Telegram authentication required' });
  }

  try {
    const sb = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: player, error: playerError } = await sb.from('players')
      .select('id, role').eq('telegram_id', String(user.id)).maybeSingle();
    if (playerError) throw playerError;
    if (await blockDuringMaintenance(sb, player, res)) return;
    const { data, error } = await sb.from('referral_leaderboard')
      .select('nickname, referral_count, player_id')
      .order('referral_count', { ascending: false })
      .order('nickname', { ascending: true })
      .limit(10);
    if (error) throw error;
    const rankedPlayers = data || [];
    const playerIds = rankedPlayers.map(entry => entry.player_id).filter(Boolean);
    const backgroundsById = new Map();
    if (playerIds.length) {
      const { data: profiles, error: profilesError } = await sb.from('players')
        .select('id, profile_background, owned_cosmetics').in('id', playerIds);
      if (profilesError) throw profilesError;
      const allowedBackgrounds = new Set(['background_panelka', 'background_brick', 'background_concrete']);
      for (const profile of profiles || []) {
        const background = profile.profile_background;
        if (allowedBackgrounds.has(background) && Array.isArray(profile.owned_cosmetics)
          && profile.owned_cosmetics.includes(background)) backgroundsById.set(profile.id, background);
      }
    }
    return res.status(200).json({ players: rankedPlayers.map(entry => ({
      ...entry, profile_background: backgroundsById.get(entry.player_id) || null,
    })) });
  } catch (error) {
    console.error('Referral leaderboard failed:', error?.message || error);
    return res.status(500).json({ error: 'Could not load referral leaderboard' });
  }
}
