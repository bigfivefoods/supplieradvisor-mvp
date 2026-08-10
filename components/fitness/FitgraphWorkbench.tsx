'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  FitgraphPage,
  FitgraphRequired,
} from '@/components/fitness/FitgraphShell';
import type { FitgraphStore } from '@/lib/fitness/fitgraph';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';

export function useFitgraph() {
  const companyId = getSelectedCompanyId()!;
  const [store, setStore] = useState<FitgraphStore | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fitness/fitgraph?companyId=${companyId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setStore(data.store);
      setSummary(data.summary || null);
      setAnalysis(data.analysis || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

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
        <div className="mb-4">
          <Link
            href="/dashboard/fitgraph"
            className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:text-violet-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> FitAdvisor
          </Link>
        </div>
        <RelationshipHeader
          eyebrow="FitAdvisor®"
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
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  );
}
