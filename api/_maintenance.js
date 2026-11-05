const MAINTENANCE_CACHE_MS = 10_000;
let maintenanceCache = null;
let maintenanceCacheUntil = 0;
let maintenanceReadInFlight = null;

export function setMaintenanceCache(enabled) {
  maintenanceCache = Boolean(enabled);
  maintenanceCacheUntil = Date.now() + MAINTENANCE_CACHE_MS;
  maintenanceReadInFlight = null;
}

export async function readMaintenance(sb) {
  if (maintenanceCache !== null && Date.now() < maintenanceCacheUntil) return maintenanceCache;
  if (maintenanceReadInFlight) return maintenanceReadInFlight;

  maintenanceReadInFlight = (async () => {
    const { data, error } = await sb.from('site_settings')
      .select('maintenance_enabled')
      .eq('setting_key', 'main')
      .maybeSingle();
    // A not-yet-applied maintenance migration must never lock the whole game.
    // PostgREST can report a missing table before the schema cache refreshes.
    if (error) {
      console.error('Maintenance flag unavailable:', {
        message: error.message,
        code: error.code || null,
      });
      // A settings-read problem must not take down profile loading. Keep the
      // last known value when possible; if this instance has no cached value,
      // fail open as we already do for a not-yet-applied migration.
      if (maintenanceCache === null) setMaintenanceCache(false);
      else maintenanceCacheUntil = Date.now() + MAINTENANCE_CACHE_MS;
      return maintenanceCache;
    }
    setMaintenanceCache(Boolean(data?.maintenance_enabled));
    return maintenanceCache;
  })();

  try {
    return await maintenanceReadInFlight;
  } finally {
    maintenanceReadInFlight = null;
  }
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
