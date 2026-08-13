'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyResolvedTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  type ResolvedTheme,
  type ThemeMode,
} from '@/lib/theme/theme';
import {
  persistBrandMode,
  readStoredBrandMode,
  type BrandMode,
} from '@/lib/brand/advisor-skins';

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  /** Chrome product branding: core · follow module · lock an Advisor */
  brandMode: BrandMode;
  setBrandMode: (mode: BrandMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');
  const [brandMode, setBrandModeState] = useState<BrandMode>('module');
  const [ready, setReady] = useState(false);

  // Hydrate from storage after mount (boot script already applied class)
  useEffect(() => {
    const stored = readStoredTheme();
    const r = resolveTheme(stored);
    setModeState(stored);
    setResolved(r);
    applyResolvedTheme(r);
    setBrandModeState(readStoredBrandMode());
    setReady(true);
  }, []);

  // Follow system preference when mode === system
  useEffect(() => {
    if (!ready || mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const r = resolveTheme('system');
      setResolved(r);
      applyResolvedTheme(r);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode, ready]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    persistTheme(next);
    const r = resolveTheme(next);
    setResolved(r);
    applyResolvedTheme(r);
  }, []);

  const toggle = useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setMode]);

  const setBrandMode = useCallback((next: BrandMode) => {
    setBrandModeState(next);
    persistBrandMode(next);
  }, []);

  const value = useMemo(
    () => ({ mode, resolved, setMode, toggle, brandMode, setBrandMode }),
    [mode, resolved, setMode, toggle, brandMode, setBrandMode]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback when used outside provider (e.g. story isolation)
    return {
      mode: 'light',
      resolved: 'light',
      setMode: () => {},
      toggle: () => {},
      brandMode: 'module',
      setBrandMode: () => {},
    };
  }
  return ctx;
}
