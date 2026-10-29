export type UiTheme = 'light' | 'dark';

function readPreference(key: string, fallback: string) {
  try {
    return typeof window === 'undefined' ? fallback : window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* Keep the current session usable. */ }
}

export function isUiVibrationEnabled() {
  return readPreference('zhituha_vibration', 'on') !== 'off';
}

export function setUiVibrationEnabled(enabled: boolean) {
  writePreference('zhituha_vibration', enabled ? 'on' : 'off');
  return enabled;
}

export function getUiTheme(): UiTheme {
  return readPreference('zhituha_theme', 'dark') === 'light' ? 'light' : 'dark';
}

export function persistUiTheme(theme: UiTheme) {
  writePreference('zhituha_theme', theme);
  return theme;
}
