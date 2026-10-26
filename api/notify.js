// api/notify.js — пуш-уведомления игроку в Telegram
// Вызывается из клиента (App.tsx -> sendNotification).
import { createClient } from '@supabase/supabase-js';
import { verifyTelegramInitData } from './_telegram.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN;

// простой rate-limit по IP: 20 запросов в минуту
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { count: 0, reset: now + 60000 };
  if (now > b.reset) { b.count = 0; b.reset = now + 60000; }
  b.count++;
  buckets.set(ip, b);
  return b.count > 20;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!BOT_TOKEN || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Сервер не настроен (BOT_TOKEN / SUPABASE)' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many requests' });

  try {
    const { init_data: initData, text } = req.body || {};
    const user = verifyTelegramInitData(initData);
    if (!user) return res.status(403).json({ error: 'Telegram authentication required' });

    // telegram_id должен быть числом (id пользователя Telegram), а не фейковый "user_xxxx"
    const tgId = String(user.id);
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Пустое сообщение' });
    }
    const safeText = text.slice(0, 500);

    // Проверка: этот telegram_id действительно зарегистрирован в игре
    const sb = createClient(supabaseUrl, supabaseKey);
    const { data: player, error: dbErr } = await sb
      .from('players')
      .select('id')
      .eq('telegram_id', tgId)
      .maybeSingle();
    if (dbErr) console.error('DB check error:', dbErr.message);
    if (!player) {
      // Не зарегистрирован — молча ок, чтобы не светить existence и не спамить ошибками клиент
      return res.status(200).json({ success: false, reason: 'player_not_found' });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgId, text: safeText })
    });
    const tgData = await tgRes.json();

    if (!tgData.ok) {
      // Игрок заблокировал бота и т.п. — не критично
      return res.status(200).json({ success: false, reason: tgData.description || 'telegram_error' });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('notify error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
