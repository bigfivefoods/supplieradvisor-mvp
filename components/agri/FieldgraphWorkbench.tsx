'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  FieldgraphPage,
  FieldgraphRequired,
} from '@/components/agri/FieldgraphShell';
import type { FieldgraphStore } from '@/lib/agri/fieldgraph';
import {
  RelationshipHeader,
} from '@/components/relationship/RelationshipChrome';

export function useFieldgraph(opts?: { season?: string }) {
  const companyId = getSelectedCompanyId()!;
  const season =
    opts?.season || String(new Date().getFullYear());
  const [store, setStore] = useState<FieldgraphStore | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        companyId: String(companyId),
        season,
      });
      const res = await fetch(`/api/agri/fieldgraph?${q}`, {
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
  }, [companyId, season]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/agri/fieldgraph', {
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

  return {
    companyId,
    store,
    summary,
    analysis,
    loading,
    saving,
    load,
    post,
  };
}

export function FieldgraphWorkbench({
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
    <FieldgraphRequired>
      <FieldgraphPage>
        <div className="mb-4">
          <Link
            href="/dashboard/fieldgraph"
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-white hover:text-emerald-900 dark:text-white dark:hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> FieldAdvisor
          </Link>
        </div>
        <RelationshipHeader
          eyebrow="FieldAdvisor®"
          title={title}
          titleAccent={titleAccent}
          description={description}
        />
        {children}
      </FieldgraphPage>
    </FieldgraphRequired>
  );
}

export function LoadingBlock() {
  return (
    <div className="py-16 flex justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600 dark:text-white" />
    </div>
  );
}
