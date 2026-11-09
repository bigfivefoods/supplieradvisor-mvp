'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { applySidebarDataset, SIDEBAR_COLLAPSED_KEY } from '@/lib/chrome/sidebar-boot';

const STORAGE_KEY = SIDEBAR_COLLAPSED_KEY;

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggle: () => void;
  ready: boolean;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [ready, setReady] = useState(false);

  // Before the browser paints: match the head script so a saved collapsed
  // width is not painted wide and then animated shut.
  useLayoutEffect(() => {
    let next = false;
    try {
      next = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      /* ignore */
    }
    applySidebarDataset(next, false);
    setCollapsedState(next);
    setReady(true);
  }, []);

  const setCollapsed = useCallback((v: boolean) => {
    applySidebarDataset(v, true);
    setCollapsedState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      applySidebarDataset(next, true);
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ collapsed, setCollapsed, toggle, ready }),
    [collapsed, setCollapsed, toggle, ready]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebarChrome() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    return {
      collapsed: false,
      setCollapsed: () => {},
      toggle: () => {},
      ready: true,
    };
  }
  return ctx;
}
