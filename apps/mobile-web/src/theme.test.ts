import { describe, expect, it } from 'vitest';

import { readThemePreference, resolveThemePreference, setThemePreference } from './theme';

describe('theme preference', () => {
  it('supports light, dark and system preferences', () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };
    expect(readThemePreference(adapter)).toBe('system');
    expect(resolveThemePreference('system', true)).toBe('dark');
    expect(resolveThemePreference('system', false)).toBe('light');

    setThemePreference('dark', adapter);
    expect(readThemePreference(adapter)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
