export async function readMaintenance(sb) {
  const { data, error } = await sb.from('site_settings')
    .select('maintenance_enabled')
    .eq('setting_key', 'main')
    .maybeSingle();
  // A not-yet-applied maintenance migration must never lock the whole game.
  // PostgREST can report a missing table before the schema cache refreshes.
  if (error && ['PGRST116', 'PGRST205', '42P01'].includes(error.code)) return false;
  if (error) throw error;
  return Boolean(data?.maintenance_enabled);
}

export function isAdminRole(role) {
  return role === 'admin' || role === 'superadmin';
}

export async function blockDuringMaintenance(sb, player, res, maintenanceState) {
  const enabled = typeof maintenanceState === 'boolean' ? maintenanceState : await readMaintenance(sb);
  if (!enabled || isAdminRole(player?.role)) return false;
  res.status(503).json({ error: 'maintenance', maintenance: true });
  return true;
}
