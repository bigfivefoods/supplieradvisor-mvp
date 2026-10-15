'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import {
  ConstructiongraphPage,
  ConstructiongraphRequired,
} from '@/components/construction/ConstructiongraphShell';
import { constructionField } from '@/components/construction/ConstructionUi';
import {
  emptyConstructiongraphStore,
  type ConstructiongraphStore,
} from '@/lib/construction/constructiongraph';
import type { ConstructionRole } from '@/lib/construction/roles';

export type ConstructionSummary = ReturnType<
  typeof import('@/lib/construction/constructiongraph').summariseConstructiongraph
>;

export function useConstructiongraph() {
  const companyId = getSelectedCompanyId()!;
  const [store, setStore] = useState<ConstructiongraphStore | null>(null);
  const [summary, setSummary] = useState<ConstructionSummary | null>(null);
  const [role, setRole] = useState<ConstructionRole>('viewer');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/construction/constructiongraph?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setStore(data.store || emptyConstructiongraphStore());
      setSummary(data.summary || null);
      if (data.role) setRole(data.role as ConstructionRole);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Load failed';
      setError(message);
      toast.error(message);
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
        if (res.status === 409) {
          toast.error('This changed while you were saving, please retry');
          await load();
          const conflict = new Error('This changed while you were saving, please retry') as Error & {
            toasted?: boolean;
          };
          conflict.toasted = true;
          throw conflict;
        }
        if (!res.ok) throw new Error(data.error || 'Save failed');
        setStore(data.store || emptyConstructiongraphStore());
        setSummary(data.summary || null);
        if (data.role) setRole(data.role as ConstructionRole);
        toast.success('Saved');
        return data;
      } catch (e: unknown) {
        if (!(e as { toasted?: boolean }).toasted) {
          toast.error(e instanceof Error ? e.message : 'Save failed');
        }
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [companyId, load]
  );

  return { companyId, store, summary, role, loading, saving, error, load, post };
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
    <div className="flex justify-center py-16">
      <p className="text-sm font-bold text-slate-600">Loading the book…</p>
    </div>
  );
}

export function ConstructionEmptyHint({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
      {children}
    </div>
  );
}

export function ConstructionProjectSelect({
  store,
  value,
  onChange,
  allowEmpty = true,
}: {
  store: ConstructiongraphStore;
  value: string;
  onChange: (id: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <select
      className={constructionField}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowEmpty ? <option value="">Project</option> : null}
      {store.sites.map((s) => (
        <option key={s.id} value={s.id}>
          {s.code} · {s.name}
        </option>
      ))}
    </select>
  );
}
