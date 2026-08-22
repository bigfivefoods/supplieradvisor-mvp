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
  PhysiographPage,
  PhysiographRequired,
} from '@/components/clinic/PhysiographShell';
import type { PhysiographStore } from '@/lib/clinic/physiograph';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';

export function usePhysiograph() {
  const companyId = getSelectedCompanyId()!;
  const [store, setStore] = useState<PhysiographStore | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      await hydrateAdvisorDesk(
        'physiograph',
        companyId,
        `/api/clinic/physiograph?companyId=${companyId}`,
        (data: {
          store?: PhysiographStore;
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
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/clinic/physiograph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      rememberAdvisorDeskCache('physiograph', companyId, data);
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

export function PhysiographWorkbench({
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
    <PhysiographRequired>
      <PhysiographPage>
        <RelationshipHeader
          eyebrow="PhysioAdvisor®"
          title={title}
          titleAccent={titleAccent}
          description={description}
        />
        {children}
      </PhysiographPage>
    </PhysiographRequired>
  );
}

export function LoadingBlock() {
  return (
    <div className="py-16 flex justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
    </div>
  );
}
