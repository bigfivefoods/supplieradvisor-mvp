'use client';

import { useMemo } from 'react';
import { useConstructiongraph } from '@/components/construction/ConstructiongraphWorkbench';
import {
  ConstructionError,
  ConstructionLoading,
} from '@/components/construction/ConstructionUi';
import { emptyConstructiongraphStore, type ConstructiongraphStore } from '@/lib/construction/constructiongraph';
import {
  capabilitiesFor,
  type ConstructionCapabilities,
  type ConstructionRole,
} from '@/lib/construction/roles';

export type DeskState = 'loading' | 'error' | 'empty' | 'ready';

export type DeskHandlers = {
  retry: () => void;
  merge: (patch: Partial<ConstructiongraphStore>) => Promise<void>;
  run: (body: Record<string, unknown>) => Promise<Record<string, unknown> | void>;
};

export type DeskProps = {
  store: ConstructiongraphStore;
  role: ConstructionRole;
  caps: ConstructionCapabilities;
  state: DeskState;
  handlers: DeskHandlers;
  badge?: string;
  hrefBase?: string;
};

export function deskHref(base: string | undefined, leaf: string) {
  const root = base || '/dashboard/constructiongraph';
  if (!leaf) return root;
  return `${root}/${leaf}`;
}

export function ScreenState({
  state,
  testId,
  onRetry,
  empty,
}: {
  state: DeskState;
  testId: string;
  onRetry?: () => void;
  empty?: boolean;
}) {
  if (state === 'loading') return <ConstructionLoading testId={`${testId}-loading`} />;
  if (state === 'error') return <ConstructionError testId={`${testId}-error`} onRetry={onRetry} />;
  if (state === 'empty' || empty) return null;
  return null;
}

export function useConstructionDesk(): DeskProps & { saving: boolean } {
  const book = useConstructiongraph();
  const role = book.role || 'viewer';
  const caps = useMemo(() => capabilitiesFor(role), [role]);
  const state: DeskState = book.loading ? 'loading' : book.error ? 'error' : 'ready';
  const handlers: DeskHandlers = useMemo(
    () => ({
      retry: () => void book.load(),
      merge: async (patch) => {
        await book.post({ action: 'merge', store: patch });
      },
      run: async (body) => (await book.post(body)) as Record<string, unknown>,
    }),
    [book]
  );
  return {
    store: book.store || emptyConstructiongraphStore(),
    role,
    caps,
    state,
    handlers,
    saving: book.saving,
  };
}
