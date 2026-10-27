export async function readMaintenance(sb) {
  const { data, error } = await sb.from('site_settings')
    .select('maintenance_enabled')
    .eq('setting_key', 'main')
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return Boolean(data?.maintenance_enabled);
}

export function isAdminRole(role) {
  return role === 'admin' || role === 'superadmin';
}

export async function blockDuringMaintenance(sb, player, res) {
  if (!await readMaintenance(sb) || isAdminRole(player?.role)) return false;
  res.status(503).json({ error: 'maintenance', maintenance: true });
  return true;
}
