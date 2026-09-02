'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  hydrateAdvisorDesk,
  rememberAdvisorDeskCache,
  invalidateAdvisorDeskCache,
} from '@/lib/client/advisor-desk-cache';
import {
  FitgraphPage,
  FitgraphRequired,
} from '@/components/fitness/FitgraphShell';
import type { FitgraphStore } from '@/lib/fitness/fitgraph';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';

export type FitgraphPostResult = {
  success?: boolean;
  error?: string;
  message?: string;
  updated_at?: string;
  store?: FitgraphStore;
  summary?: Record<string, unknown> | null;
  analysis?: Record<string, unknown> | null;
  invite?: { path?: string; text?: string; share_code?: string };
  feedback_prompt?: { token?: string } | null;
  pack_remaining?: number | null;
  created?: number;
  [key: string]: unknown;
};

export function useFitgraph(opts?: { library?: boolean }) {
  const companyId = getSelectedCompanyId()!;
  const library = opts?.library === true;
  const [store, setStore] = useState<FitgraphStore | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Keep a ref so the post callback always sees the latest store without
  // needing to be recreated — important for the 409-retry path.
  const storeRef = useRef<FitgraphStore | null>(null);

  const applyData = useCallback(
    (data: FitgraphPostResult) => {
      if (data.store) {
        setStore(data.store);
        storeRef.current = data.store;
      } else if (typeof data.updated_at === 'string' && data.updated_at) {
        // Lite response: update CAS token without a full store reload.
        if (storeRef.current) {
          const next = { ...storeRef.current, updated_at: data.updated_at };
          storeRef.current = next;
          setStore(next);
        }
      }
      setSummary(data.summary || null);
      if (data.analysis) setAnalysis(data.analysis);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const load = useCallback(
    async (loadOpts?: { force?: boolean }) => {
      try {
        await hydrateAdvisorDesk(
          library ? 'fitgraph:library' : 'fitgraph',
          companyId,
          `/api/fitness/fitgraph?companyId=${companyId}${library ? '&include=library' : ''}`,
          applyData,
          setLoading,
          loadOpts?.force ? { force: true } : undefined
        );
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Load failed');
        setLoading(false);
      }
    },
    [companyId, library, applyData]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const doPost = async (
    body: Record<string, unknown>,
    currentUpdatedAt: string | null
  ): Promise<{ res: Response; data: FitgraphPostResult }> => {
    const res = await fetch('/api/fitness/fitgraph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        updated_at: currentUpdatedAt,
        ...body,
      }),
    });
    const data = (await res.json()) as FitgraphPostResult;
    return { res, data };
  };

  const post = async (
    body: Record<string, unknown>,
    opts?: { quiet?: boolean }
  ): Promise<FitgraphPostResult> => {
    if (!opts?.quiet) setSaving(true);
    try {
      const currentUpdatedAt =
        storeRef.current && typeof storeRef.current.updated_at === 'string'
          ? storeRef.current.updated_at
          : null;

      let { res, data } = await doPost(body, currentUpdatedAt);

      if (res.status === 409 && data?.error === 'stale_store') {
        // Force-reload to get the latest CAS token, then retry once.
        invalidateAdvisorDeskCache(
          library ? 'fitgraph:library' : 'fitgraph',
          companyId
        );
        await load({ force: true });
        const freshUpdatedAt =
          storeRef.current && typeof storeRef.current.updated_at === 'string'
            ? storeRef.current.updated_at
            : null;
        const retried = await doPost(body, freshUpdatedAt);
        res = retried.res;
        data = retried.data;
        if (res.status === 409 && data?.error === 'stale_store') {
          throw new Error(
            'This GymAdvisor book changed in another tab. Please refresh and try again.'
          );
        }
      }

      if (!res.ok) {
        throw new Error(data.error || 'Save failed');
      }

      // Only cache full-store responses — lite payloads (no store key) must
      // not poison the 45-second desk cache with a partial snapshot.
      if (data.store) {
        rememberAdvisorDeskCache(
          library ? 'fitgraph:library' : 'fitgraph',
          companyId,
          data
        );
      }
      applyData(data);
      return data;
    } catch (e: unknown) {
      if (!opts?.quiet) {
        toast.error(e instanceof Error ? e.message : 'Save failed');
      }
      throw e;
    } finally {
      if (!opts?.quiet) setSaving(false);
    }
  };

  return { companyId, store, summary, analysis, loading, saving, load, post };
}

export function FitgraphWorkbench({
  title,
  titleAccent,
  description,
  children,
}: {
  title: string;
  titleAccent?: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <FitgraphRequired>
      <FitgraphPage>
        <RelationshipHeader
          eyebrow="GymAdvisor®"
          title={title}
          titleAccent={titleAccent}
          description={description}
        />
        {children}
      </FitgraphPage>
    </FitgraphRequired>
  );
}

export function LoadingBlock() {
  return (
    <div className="py-16 flex justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-yellow-600" />
    </div>
  );
}
