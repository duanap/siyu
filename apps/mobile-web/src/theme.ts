export type ThemeMode = 'light' | 'dark';

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;
}

export function oppositeTheme(theme: ThemeMode): ThemeMode {
  return theme === 'light' ? 'dark' : 'light';
}
