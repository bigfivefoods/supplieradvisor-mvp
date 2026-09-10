'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import {
  ConstructiongraphPage,
  ConstructiongraphRequired,
} from '@/components/construction/ConstructiongraphShell';
import type { ConstructiongraphStore } from '@/lib/construction/constructiongraph';

export type ConstructionSummary = ReturnType<
  typeof import('@/lib/construction/constructiongraph').summariseConstructiongraph
>;

export const CONSTRUCTIONGRAPH_PAGES = [
  { name: 'Command', href: '/dashboard/constructiongraph' },
  { name: 'Sites', href: '/dashboard/constructiongraph/sites' },
  { name: 'Drawings', href: '/dashboard/constructiongraph/drawings' },
  { name: 'Subcontractors', href: '/dashboard/constructiongraph/subcontractors' },
  { name: 'Materials', href: '/dashboard/constructiongraph/materials' },
  { name: 'Programme', href: '/dashboard/constructiongraph/programme' },
  { name: 'Safety', href: '/dashboard/constructiongraph/safety' },
  { name: 'Variations', href: '/dashboard/constructiongraph/variations' },
  { name: 'Certificates', href: '/dashboard/constructiongraph/certificates' },
  { name: 'Handover', href: '/dashboard/constructiongraph/handover' },
] as const;

export function useConstructiongraph() {
  const companyId = getSelectedCompanyId()!;
  const [store, setStore] = useState<ConstructiongraphStore | null>(null);
  const [summary, setSummary] = useState<ConstructionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/construction/constructiongraph?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setStore(data.store || null);
      setSummary(data.summary || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await fetch('/api/construction/constructiongraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, ...body }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        setStore(data.store || null);
        setSummary(data.summary || null);
        return data;
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Save failed');
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [companyId]
  );

  return { companyId, store, summary, loading, saving, load, post };
}

export function ConstructiongraphWorkbench({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <ConstructiongraphRequired>
      <ConstructiongraphPage>
        <RelationshipHeader
          eyebrow="ConstructionAdvisor®"
          title={title}
          description={description}
        />
        {children}
      </ConstructiongraphPage>
    </ConstructiongraphRequired>
  );
}

export function ConstructionLoadingBlock() {
  return (
    <div className="py-16 flex justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-amber-800 dark:text-white" />
    </div>
  );
}

export function ConstructionEmptyHint({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-600">
      {children}
    </div>
  );
}
