/**
 * Laura's theme controller (design-system THEME_SYSTEM spec).
 *
 * The persisted value is the *preference* (`light` | `dark` | `system`),
 * never a resolved colour. `system` follows `prefers-color-scheme` and
 * keeps following it; an explicit choice pins `data-theme` on <html>.
 * Resolution happens here (matchMedia + change listener) so there is
 * exactly one source of truth for the active theme.
 *
 * The product shell ships dark-first (the architecture-map redesign's
 * primary acceptance state), so the default preference is `dark` until
 * the user chooses otherwise.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'lauras.theme-preference';
const DEFAULT_PREFERENCE: ThemePreference = 'dark';

let mediaQuery: MediaQueryList | null = null;
const listeners = new Set<(preference: ThemePreference) => void>();

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCE;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // Storage unavailable: fall through to the default.
  }
  return DEFAULT_PREFERENCE;
}

function resolvedTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }
  return preference;
}

function apply(preference: ThemePreference) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolvedTheme(preference);
}

export function setThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Preference still applies for this session even if it cannot persist.
  }
  apply(preference);
  for (const listener of listeners) listener(preference);
}

export function onThemePreferenceChange(listener: (preference: ThemePreference) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initTheme() {
  apply(readThemePreference());
  if (typeof window === 'undefined' || !window.matchMedia) return;
  if (!mediaQuery) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const followSystem = () => {
      if (readThemePreference() === 'system') apply('system');
    };
    if (typeof mediaQuery.addEventListener === 'function') mediaQuery.addEventListener('change', followSystem);
  }
}
