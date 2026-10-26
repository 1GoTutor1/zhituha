// POST /api/auth — серверная проверка подписи Telegram WebApp initData.
// Возвращает { ok: true, user: { id, ... } } только если подпись валидна.
// Ключевые моменты:
//  - secret = HMAC_SHA256("WebAppData", BOT_TOKEN)
//  - data_check_string = отсортированные по ключу k=v строки (кроме hash)
//  - auth_date старше 24ч — отвергаем (защита от replay)
import { verifyTelegramInitData } from './_telegram.js';

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });

  const initData = typeof req.body?.init_data === 'string' ? req.body.init_data : '';
  if (!process.env.BOT_TOKEN) return res.status(500).json({ ok: false, error: 'server misconfigured' });
  if (!initData || initData.length > 16_384) return res.status(400).json({ ok: false, error: 'bad init_data' });
  const user = verifyTelegramInitData(initData);
  if (!user) return res.status(403).json({ ok: false, error: 'invalid or expired initData' });
  return res.status(200).json({ ok: true, user });
}
