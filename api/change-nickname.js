import { createClient } from '@supabase/supabase-js';
import { verifyTelegramInitData } from './_telegram.js';
import { blockDuringMaintenance, readMaintenance } from './_maintenance.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { BOT_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!BOT_TOKEN || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Nickname service is not configured' });
  }

  const user = verifyTelegramInitData(req.body?.init_data, BOT_TOKEN);
  if (!user) return res.status(403).json({ error: 'Telegram authentication required' });
  const nickname = typeof req.body?.nickname === 'string' ? req.body.nickname : '';
  if (!/^[A-Za-z]{3,20}$/.test(nickname)) {
    return res.status(400).json({ error: 'Используй 3–20 английских букв A–Z без цифр и символов' });
  }

  const sb = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    if (await blockDuringMaintenance(sb, null, res, await readMaintenance(sb))) return;
    const { data: player, error: playerError } = await sb.from('players')
      .select('id, is_banned, is_subscribed').eq('telegram_id', String(user.id)).maybeSingle();
    if (playerError) throw playerError;
    if (!player) return res.status(404).json({ error: 'Игрок не зарегистрирован' });
    if (player.is_banned) return res.status(403).json({ error: 'Аккаунт заблокирован' });
    if (player.is_subscribed === false) return res.status(403).json({ error: 'Сначала подпишись на канал игры' });

    const { data, error } = await sb.rpc('change_nickname_rpc', {
      p_player_id: player.id,
      p_nickname: nickname,
    });
    if (error) return res.status(400).json({ error: String(error.message || 'Не удалось сменить ник').slice(0, 180) });
    if (data?.error) return res.status(400).json(data);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Nickname change failed:', error?.message || error);
    return res.status(500).json({ error: 'Не удалось сменить ник. Попробуй позже.' });
  }
}
