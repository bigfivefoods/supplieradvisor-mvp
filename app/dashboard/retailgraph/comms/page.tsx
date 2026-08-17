'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  RetailgraphPage,
  RetailgraphRequired,
} from '@/components/retail/RetailgraphShell';
import { AdvisorAnnouncementsDesk } from '@/components/services/AdvisorAnnouncementsDesk';
import type { RetailgraphStore } from '@/lib/retail/retailgraph';

export default function RetailgraphCommsPage() {
  const { companyId, withAuthJson } = useApiAuth();
  const [store, setStore] = useState<RetailgraphStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{ store?: RetailgraphStore }>(
      `/api/retail/retailgraph?companyId=${companyId}`
    );
    setStore(data.store || null);
  }, [companyId, withAuthJson]);

  useEffect(() => {
    void load()
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    if (!companyId) return;
    setSaving(true);
    try {
      const data = await withAuthJson<{ store?: RetailgraphStore; message?: string }>(
        '/api/retail/retailgraph',
        { method: 'POST', jsonBody: { companyId, ...body } }
      );
      if (data.store) setStore(data.store);
      if (data.message) toast.success(data.message);
      return data;
    } finally {
      setSaving(false);
    }
  };

  const rows = store?.announcements || [];

  return (
    <RetailgraphRequired>
      <RetailgraphPage
        title="Comms"
        description="Push notices, ads and offers to shop customers on SA Member."
      >
        {loading || !store ? (
          <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi
                label="Live"
                value={String(rows.filter((r) => r.status === 'published').length)}
              />
              <Kpi
                label="Drafts"
                value={String(rows.filter((r) => r.status === 'draft').length)}
              />
              <Kpi label="Customers" value={String(store.customers.length)} />
            </div>
            <AdvisorAnnouncementsDesk
              items={store.announcements}
              post={post}
              saving={saving}
              accentClass="border-orange-200"
              buttonClass="bg-orange-600 hover:bg-orange-700 text-white"
            />
          </div>
        )}
      </RetailgraphPage>
    </RetailgraphRequired>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}
