import { createClient } from '@supabase/supabase-js';

const BATCH_SIZE = 25;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://zhituha-ashen.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { CRON_SECRET, BOT_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!CRON_SECRET || !BOT_TOKEN || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Daily reminder service is not configured' });
  }
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: players, error } = await supabase.rpc('claim_daily_reminder_targets_rpc', {
    p_limit: BATCH_SIZE,
  });
  if (error) {
    console.error('Daily reminder target query failed:', error.message);
    return res.status(500).json({ error: 'Could not load reminder targets' });
  }

  let delivered = 0;
  let permanentFailures = 0;
  let retryLater = 0;
  for (const player of players || []) {
    try {
      const telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: player.telegram_id,
          text: '🎁 Ежедневная награда уже доступна! Забери её в игре, чтобы продолжить серию.',
          reply_markup: {
            inline_keyboard: [[{ text: 'Открыть игру', web_app: { url: WEBAPP_URL } }]],
          },
        }),
      });
      const telegramResult = await telegramResponse.json();
      if (telegramResponse.ok && telegramResult.ok) {
        const { error: markError } = await supabase.rpc('mark_daily_reminder_sent_rpc', {
          p_player_id: player.id,
          p_last_claim: player.last_claim,
        });
        if (markError) throw markError;
        delivered++;
      } else if (telegramResult.error_code === 429 || telegramResult.error_code >= 500 || !telegramResult.error_code) {
        console.error('Temporary daily reminder delivery failure:', telegramResult.description || telegramResponse.status);
        retryLater++;
      } else {
        // Например, пользователь заблокировал бота или ещё не открывал чат.
        // Не повторяем недоставляемое уведомление каждую минуту.
        const { error: markError } = await supabase.rpc('mark_daily_reminder_sent_rpc', {
          p_player_id: player.id,
          p_last_claim: player.last_claim,
        });
        if (markError) throw markError;
        permanentFailures++;
      }
    } catch (sendError) {
      console.error('Daily reminder processing failed:', sendError?.message || sendError);
      retryLater++;
    }
  }

  return res.status(200).json({ processed: (players || []).length, delivered, permanentFailures, retryLater });
}
