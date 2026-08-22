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
  MedicalgraphPage,
  MedicalgraphRequired,
} from '@/components/clinic/MedicalgraphShell';
import type { MedicalgraphStore } from '@/lib/clinic/medicalgraph';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';

export function useMedicalgraph() {
  const companyId = getSelectedCompanyId()!;
  const [store, setStore] = useState<MedicalgraphStore | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      await hydrateAdvisorDesk(
        'medicalgraph',
        companyId,
        `/api/clinic/medicalgraph?companyId=${companyId}`,
        (data: {
          store?: MedicalgraphStore;
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
      const res = await fetch('/api/clinic/medicalgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      rememberAdvisorDeskCache('medicalgraph', companyId, data);
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

export function MedicalgraphWorkbench({
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
    <MedicalgraphRequired>
      <MedicalgraphPage>
        <RelationshipHeader
          eyebrow="MedicalAdvisor®"
          title={title}
          titleAccent={titleAccent}
          description={description}
        />
        {children}
      </MedicalgraphPage>
    </MedicalgraphRequired>
  );
}

export function LoadingBlock() {
  return (
    <div className="py-16 flex justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );
}
