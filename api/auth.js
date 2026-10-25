// POST /api/auth — серверная проверка подписи Telegram WebApp initData.
// Возвращает { ok: true, user: { id, ... } } только если подпись валидна.
// Ключевые моменты:
//  - secret = HMAC_SHA256("WebAppData", BOT_TOKEN)
//  - data_check_string = отсортированные по ключу k=v строки (кроме hash)
//  - auth_date старше 24ч — отвергаем (защита от replay)
import crypto from 'crypto';

const MAX_AGE_SEC = 24 * 3600;

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    // Без токена проверять нечем — честно говорим клиенту, что верификация недоступна.
    return res.status(500).json({ ok: false, error: 'server misconfigured: no BOT_TOKEN' });
  }

  const initData = typeof req.body?.init_data === 'string' ? req.body.init_data : '';
  if (!initData || initData.length > 100000) {
    return res.status(400).json({ ok: false, error: 'bad init_data' });
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return res.status(400).json({ ok: false, error: 'no hash' });

    // Собираем data_check_string: все пары кроме hash, отсортированные по ключу
    const pairs = [];
    for (const [k, v] of params.entries()) {
      if (k !== 'hash') pairs.push([k, v]);
    }
    pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');

    // Проверка возраста
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    if (!authDate || Math.floor(Date.now() / 1000) - authDate > MAX_AGE_SEC) {
      return res.status(400).json({ ok: false, error: 'initData expired' });
    }

    // Подпись
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calcHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const ok =
      calcHash.length === hash.length &&
      crypto.timingSafeEqual(Buffer.from(calcHash, 'hex'), Buffer.from(hash, 'hex'));

    if (!ok) return res.status(403).json({ ok: false, error: 'invalid signature' });

    let user = null;
    try {
      user = JSON.parse(params.get('user') || 'null');
    } catch { /* ignore */ }
    if (!user || !user.id) return res.status(400).json({ ok: false, error: 'no user in initData' });

    return res.status(200).json({
      ok: true,
      user: { id: user.id, username: user.username || null, first_name: user.first_name || null },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'internal' });
  }
}
