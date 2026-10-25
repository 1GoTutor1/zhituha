// api/casino.js — глобальный цикл казино (раунды по 45 сек).
// Вызывается из Vercel Cron (vercel.json -> crons, каждые 10 минут) ИЛИ
// любым внешним планировщиком. Также защищён секретом CRON_SECRET.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  // доступ только по секрету (Vercel сам шлёт Authorization: Bearer $CRON_SECRET)
  const secret = process.env.CRON_SECRET;
  const hdr = req.headers.authorization || '';
  if (secret && hdr !== `Bearer ${secret}` && req.query.secret !== secret) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'no supabase env' });

  const sb = createClient(supabaseUrl, supabaseKey);
  try {
    const { data, error } = await sb.rpc('casino_tick_rpc');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || { ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
