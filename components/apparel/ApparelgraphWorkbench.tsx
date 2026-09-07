'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import {
  ApparelgraphPage,
  ApparelgraphRequired,
} from '@/components/apparel/ApparelgraphShell';
import type { ApparelgraphStore } from '@/lib/apparel/apparelgraph';

export type ApparelSummary = ReturnType<
  typeof import('@/lib/apparel/apparelgraph').summariseApparelgraph
>;

export const APPARELGRAPH_PAGES = [
  { name: 'Overview', href: '/dashboard/apparelgraph' },
  { name: 'Capability', href: '/dashboard/apparelgraph/capability' },
  { name: 'Styles', href: '/dashboard/apparelgraph/styles' },
  { name: 'Samples', href: '/dashboard/apparelgraph/samples' },
  { name: 'Materials', href: '/dashboard/apparelgraph/materials' },
  { name: 'Floor', href: '/dashboard/apparelgraph/floor' },
  { name: 'Quality', href: '/dashboard/apparelgraph/quality' },
  { name: 'Ship', href: '/dashboard/apparelgraph/ship' },
] as const;

export function useApparelgraph() {
  const companyId = getSelectedCompanyId()!;
  const [store, setStore] = useState<ApparelgraphStore | null>(null);
  const [summary, setSummary] = useState<ApparelSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/apparel/apparelgraph?companyId=${companyId}`,
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
        const res = await fetch('/api/apparel/apparelgraph', {
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

export function ApparelgraphWorkbench({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <ApparelgraphRequired>
      <ApparelgraphPage>
        <RelationshipHeader
          eyebrow="ApparelAdvisor®"
          title={title}
          description={description}
        />
        {children}
      </ApparelgraphPage>
    </ApparelgraphRequired>
  );
}

export function ApparelLoadingBlock() {
  return (
    <div className="py-16 flex justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-600 dark:text-white" />
    </div>
  );
}
