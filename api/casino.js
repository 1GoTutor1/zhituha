// api/casino.js — глобальный цикл казино (раунды по 45 сек).
// Вызывается из Vercel Cron (vercel.json -> crons, 1 раз в сутки — на Hobby-плане
// cron не чаще раза в день) ИЛИ любым внешним планировщиком. Защищён CRON_SECRET.
//
// ВАЖНО: основной движок цикла — клиентский (get_casino_round_rpc вызывает
// casino_advance() при каждом запросе игроков), поэтому цикл крутится всегда,
// пока открыт хотя бы один казино-экран. Cron здесь — лишь страховка на случай,
// когда игроков нет (доводит зависшие раунды и запускает новый цикл).
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Одна «прокрутка» цикла: betting -> spinning -> result.
async function tick(sb) {
  const { data, error } = await sb.rpc('casino_tick_rpc');
  if (error) throw new Error(error.message);
  return data || { ok: true };
}

export default async function handler(req, res) {
  // доступ только по секрету (Vercel сам шлёт Authorization: Bearer $CRON_SECRET)
  const secret = process.env.CRON_SECRET;
  const hdr = req.headers.authorization || '';
  if (!secret) return res.status(500).json({ error: 'Cron is not configured' });
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (hdr !== `Bearer ${secret}`) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'no supabase env' });

  const sb = createClient(supabaseUrl, supabaseKey);
  res.setHeader('Cache-Control', 'no-store');

  try {
    // Страховка от реджекта FunctionInvocationLimitExceeded (лимит вызовов RPC):
    // если первый тик упёрся в лимит — не падаем с 500, а отвечаем 200.
    let ran = 0;
    try {
      await tick(sb);
      ran++;
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      if (!/FunctionInvocationLimitExceeded|too many|rate limit/i.test(msg)) throw e;
    }
    return res.status(200).json({ ok: true, ticks: ran, mode: ran ? 'cron' : 'rate-limited-ok' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
