import { verifyTelegramInitData } from './_telegram.js';

const buckets = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const token = process.env.BOT_TOKEN;
  const adminId = process.env.ADMIN_TG_ID;
  if (!token || !adminId) return res.status(500).json({ error: 'Report service is not configured' });

  const user = verifyTelegramInitData(req.body?.init_data);
  if (!user) return res.status(403).json({ error: 'Telegram authentication required' });
  const { message } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'Message is required' });
  if (message.length > 2000) return res.status(413).json({ error: 'Message is too long' });

  const now = Date.now();
  const key = String(user.id);
  const bucket = buckets.get(key) || { count: 0, reset: now + 10 * 60_000 };
  if (now > bucket.reset) { bucket.count = 0; bucket.reset = now + 10 * 60_000; }
  if (bucket.count >= 3) return res.status(429).json({ error: 'Too many reports' });
  bucket.count++;
  buckets.set(key, bucket);

  const name = String(user.first_name || 'Player').replace(/[\r\n]/g, ' ').slice(0, 80);
  const cleanMessage = message.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const text = `Bug report\nPlayer: ${name} (TG ${user.id})\n\nMessage:\n${cleanMessage}`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: adminId, text }),
    });
    const tgData = await tgRes.json();
    if (!tgData.ok) return res.status(502).json({ error: 'Telegram delivery failed' });
    return res.status(200).json({ success: true });
  } catch {
    return res.status(502).json({ error: 'Telegram delivery failed' });
  }
}
