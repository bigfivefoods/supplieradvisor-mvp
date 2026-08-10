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

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');
  const [ready, setReady] = useState(false);

  // Hydrate from storage after mount (boot script already applied class)
  useEffect(() => {
    const stored = readStoredTheme();
    const r = resolveTheme(stored);
    setModeState(stored);
    setResolved(r);
    applyResolvedTheme(r);
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

  const value = useMemo(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle]
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
    };
  }
  return ctx;
}
