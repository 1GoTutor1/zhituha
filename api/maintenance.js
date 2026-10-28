import { createClient } from '@supabase/supabase-js';
import { verifyTelegramInitData } from './_telegram.js';
import { isAdminRole, readMaintenance } from './_maintenance.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { BOT_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!BOT_TOKEN || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Maintenance service is not configured' });
  }
  const user = verifyTelegramInitData(req.body?.init_data, BOT_TOKEN);
  if (!user) return res.status(403).json({ error: 'Telegram authentication required' });

  const sb = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const action = req.body?.action;
    const playerQuery = sb.from('players')
      .select('id, role').eq('telegram_id', String(user.id)).maybeSingle();
    if (action === 'status') {
      const [{ data: player, error: playerError }, enabled] = await Promise.all([
        playerQuery,
        readMaintenance(sb),
      ]);
      if (playerError) throw playerError;
      return res.status(200).json({ enabled, is_admin: isAdminRole(player?.role) });
    }
    const { data: player, error: playerError } = await playerQuery;
    if (playerError) throw playerError;
    const admin = isAdminRole(player?.role);
    if (action === 'set') {
      if (!admin) return res.status(403).json({ error: 'Admin access required' });
      if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ error: 'Invalid maintenance state' });
      const { error } = await sb.from('site_settings').upsert({
        setting_key: 'main', maintenance_enabled: req.body.enabled,
        updated_at: new Date().toISOString(), updated_by: player.id,
      }, { onConflict: 'setting_key' });
      if (error) throw error;
      return res.status(200).json({ enabled: req.body.enabled, is_admin: true });
    }
    return res.status(400).json({ error: 'Unsupported maintenance action' });
  } catch (error) {
    console.error('Maintenance API failed:', error?.message || error);
    return res.status(500).json({ error: 'Maintenance service failed' });
  }
}
