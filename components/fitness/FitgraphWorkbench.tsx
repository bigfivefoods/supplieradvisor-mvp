'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  hydrateAdvisorDesk,
  rememberAdvisorDeskCache,
} from '@/lib/client/advisor-desk-cache';
import {
  FitgraphPage,
  FitgraphRequired,
} from '@/components/fitness/FitgraphShell';
import type { FitgraphStore } from '@/lib/fitness/fitgraph';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';

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

  const load = useCallback(async () => {
    try {
      await hydrateAdvisorDesk(
        library ? 'fitgraph:library' : 'fitgraph',
        companyId,
        `/api/fitness/fitgraph?companyId=${companyId}${library ? '&include=library' : ''}`,
        (data: {
          store?: FitgraphStore;
          summary?: Record<string, unknown> | null;
          analysis?: Record<string, unknown> | null;
        }) => {
          if (data.store) setStore(data.store);
          setSummary(data.summary || null);
          if (data.analysis) setAnalysis(data.analysis);
        },
        setLoading
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
      setLoading(false);
    }
  }, [companyId, library]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/fitness/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      rememberAdvisorDeskCache(
        library ? 'fitgraph:library' : 'fitgraph',
        companyId,
        data
      );
      setStore(data.store);
      setSummary(data.summary || null);
      if (data.analysis) setAnalysis(data.analysis);
      return data;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
      throw e;
    } finally {
      setSaving(false);
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
