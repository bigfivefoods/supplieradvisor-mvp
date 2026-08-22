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
  HiregraphPage,
  HiregraphRequired,
} from '@/components/hire/HiregraphShell';
import type {
  HireCorePartyRef,
  HiregraphStore,
} from '@/lib/hire/hiregraph';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';

export function useHiregraph() {
  const companyId = getSelectedCompanyId()!;
  const [store, setStore] = useState<HiregraphStore | null>(null);
  const [coreSuppliers, setCoreSuppliers] = useState<HireCorePartyRef[]>([]);
  const [coreCustomers, setCoreCustomers] = useState<HireCorePartyRef[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const applyPayload = (data: {
    store?: HiregraphStore;
    summary?: Record<string, unknown> | null;
    coreSuppliers?: HireCorePartyRef[];
    coreCustomers?: HireCorePartyRef[];
  }) => {
    if (data.store) setStore(data.store);
    if (data.summary !== undefined) setSummary(data.summary || null);
    if (Array.isArray(data.coreSuppliers)) setCoreSuppliers(data.coreSuppliers);
    if (Array.isArray(data.coreCustomers)) setCoreCustomers(data.coreCustomers);
  };

  const load = useCallback(async () => {
    try {
      await hydrateAdvisorDesk(
        'hiregraph',
        companyId,
        `/api/hire/hiregraph?companyId=${companyId}`,
        (data: {
          store?: HiregraphStore;
          summary?: Record<string, unknown> | null;
          coreSuppliers?: HireCorePartyRef[];
          coreCustomers?: HireCorePartyRef[];
        }) => applyPayload(data),
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
      const res = await fetch('/api/hire/hiregraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      rememberAdvisorDeskCache('hiregraph', companyId, data);
      applyPayload(data);
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
    coreSuppliers,
    coreCustomers,
    summary,
    loading,
    saving,
    load,
    post,
  };
}

export function HiregraphWorkbench({
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
    <HiregraphRequired>
      <HiregraphPage>
        <RelationshipHeader
          eyebrow="HireAdvisor®"
          title={title}
          titleAccent={titleAccent}
          description={description}
        />
        {children}
      </HiregraphPage>
    </HiregraphRequired>
  );
}

export function LoadingBlock() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
    </div>
  );
}
