export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

const THEME_STORAGE_KEY = 'siyu-theme';

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;
}

export function oppositeTheme(theme: ThemeMode): ThemeMode {
  return theme === 'light' ? 'dark' : 'light';
}

export function readThemePreference(
  storage: Pick<Storage, 'getItem'> = localStorage,
): ThemePreference {
  const value = storage.getItem(THEME_STORAGE_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function resolveThemePreference(
  preference: ThemePreference,
  prefersDark = typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches,
): ThemeMode {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
}

export function setThemePreference(
  preference: ThemePreference,
  storage: Pick<Storage, 'setItem'> = localStorage,
): ThemeMode {
  storage.setItem(THEME_STORAGE_KEY, preference);
  const resolved = resolveThemePreference(preference);
  applyTheme(resolved);
  return resolved;
}
