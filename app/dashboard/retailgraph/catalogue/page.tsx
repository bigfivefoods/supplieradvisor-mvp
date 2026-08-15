'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  RetailgraphPage,
  RetailgraphRequired,
} from '@/components/retail/RetailgraphShell';
import { formatZar } from '@/lib/b2c/member-account-types';
import type { RetailSku } from '@/lib/retail/retailgraph';

export default function RetailCataloguePage() {
  const { companyId, withAuthJson } = useApiAuth();
  const [skus, setSkus] = useState<RetailSku[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', sku: '', price_zar: '' });

  const load = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{ store?: { skus?: RetailSku[] } }>(
      `/api/retail/retailgraph?companyId=${companyId}`
    );
    setSkus(data.store?.skus || []);
  }, [companyId, withAuthJson]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const save = async () => {
    if (!companyId) return;
    try {
      await withAuthJson('/api/retail/retailgraph', {
        method: 'POST',
        jsonBody: {
          companyId,
          action: 'upsert_sku',
          name: form.name,
          sku: form.sku,
          price_zar: Number(form.price_zar),
        },
      });
      toast.success('SKU saved');
      setForm({ name: '', sku: '', price_zar: '' });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    }
  };

  return (
    <RetailgraphRequired>
      <RetailgraphPage
        title="Catalogue"
        description="Items the till can ring up. Prices in ZAR."
      >
        <form
          className="mb-5 grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="SKU (optional)"
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
          />
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="Price ZAR"
            type="number"
            min={0}
            step="0.01"
            value={form.price_zar}
            onChange={(e) =>
              setForm((f) => ({ ...f, price_zar: e.target.value }))
            }
          />
          <button
            type="submit"
            className="rounded-xl bg-orange-600 px-3 py-2 text-sm font-black text-white"
          >
            Add SKU
          </button>
        </form>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {skus.length === 0 ? (
              <li className="p-4 text-sm text-slate-500">No SKUs yet.</li>
            ) : (
              skus.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-bold">{s.name}</p>
                    <p className="text-[11px] text-slate-500">{s.sku || s.id}</p>
                  </div>
                  <p className="text-sm font-black">{formatZar(s.price_zar)}</p>
                </li>
              ))
            )}
          </ul>
        )}
      </RetailgraphPage>
    </RetailgraphRequired>
  );
}
