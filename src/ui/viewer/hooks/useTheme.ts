import { useCallback, useLayoutEffect, useState } from 'react';

/** Neon accent schemes — dark-only viewer; persisted locally. */
export type NeonScheme = 'cyan' | 'violet' | 'neon-matrix';

const STORAGE_KEY = 'claude-mem-theme';

const SCHEMES: NeonScheme[] = ['cyan', 'violet', 'neon-matrix'];

function migrateLegacyStoredValue(raw: string | null): NeonScheme {
  if (raw === 'cyan' || raw === 'violet' || raw === 'neon-matrix') return raw;
  // Legacy ThemePreference values → default neon scheme per handoff
  if (raw === 'dark') return 'cyan';
  if (raw === 'light' || raw === 'system') return 'cyan';
  return 'cyan';
}

function readScheme(): NeonScheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return migrateLegacyStoredValue(stored);
  } catch (e) {
    console.warn('Failed to read appearance preference from localStorage:', e);
    return 'cyan';
  }
}

/** Apply scheme to the document root (dark-only UI). */
export function applyNeonScheme(scheme: NeonScheme) {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.setAttribute('data-neon-scheme', scheme);
}

export function useTheme() {
  const [scheme, setSchemeState] = useState<NeonScheme>(() =>
    typeof window === 'undefined' ? 'cyan' : readScheme()
  );

  useLayoutEffect(() => {
    applyNeonScheme(scheme);
  }, [scheme]);

  const setScheme = useCallback((next: NeonScheme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
      setSchemeState(next);
    } catch (e) {
      console.warn('Failed to save appearance preference:', e);
      setSchemeState(next);
    }
  }, []);

  const cycleScheme = useCallback(() => {
    const i = SCHEMES.indexOf(scheme);
    const next = SCHEMES[(i + 1) % SCHEMES.length];
    setScheme(next);
  }, [scheme, setScheme]);

  return {
    scheme,
    setScheme,
    cycleScheme
  };
}
