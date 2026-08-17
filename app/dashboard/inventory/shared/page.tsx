'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  InventoryHeader,
} from '@/components/inventory/InventoryShell';
import { RelationshipPage } from '@/components/relationship/RelationshipChrome';
import { formatMoney } from '@/lib/accounting/types';

type Draft = {
  source: string;
  source_id: string;
  sku: string;
  name: string;
  price_zar: number;
  category: string;
  track_stock: boolean;
  key: string;
  linked?: { id: number; sku?: string | null } | null;
};

export default function SharedSkusPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/core/shared-skus?companyId=${companyId}`);
      const data = await res.json();
      setDrafts(data.drafts || []);
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    if (!companyId) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/core/shared-skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Linked ${data.created || 0} SKU(s) into inventory`);
      setDrafts(data.drafts || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSyncing(false);
    }
  }

  const unlinked = drafts.filter((d) => !d.linked).length;

  return (
    <RelationshipPage>
      <InventoryHeader
        title="Shared"
        titleAccent="SKUs"
        description="Gym shop, retail till, hire catalogue and clinic consumables share one inventory book."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={syncing || !unlinked}
              onClick={() => void sync()}
              className="btn-primary !py-2 !px-4 text-sm"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Sync ${unlinked} unlinked`}
            </button>
          </div>
        }
      />
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2">Inventory</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {drafts.map((d) => (
                <tr key={d.key}>
                  <td className="px-4 py-2 capitalize">{d.source.replace('_', ' ')}</td>
                  <td className="px-4 py-2 font-semibold">{d.name}</td>
                  <td className="px-4 py-2 font-mono text-[12px]">{d.sku}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatMoney(d.price_zar)}
                  </td>
                  <td className="px-4 py-2">
                    {d.linked ? (
                      <span className="text-emerald-700">#{d.linked.id}</span>
                    ) : (
                      <span className="text-amber-700">Unlinked</span>
                    )}
                  </td>
                </tr>
              ))}
              {!drafts.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No Advisor shop, retail, hire or clinic items yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </RelationshipPage>
  );
}
