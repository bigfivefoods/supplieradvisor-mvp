'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  RetailgraphPage,
  RetailgraphRequired,
} from '@/components/retail/RetailgraphShell';
import type { RetailCustomer } from '@/lib/retail/retailgraph';

export default function RetailCustomersPage() {
  const { companyId, withAuthJson } = useApiAuth();
  const [rows, setRows] = useState<RetailCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  const load = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{ store?: { customers?: RetailCustomer[] } }>(
      `/api/retail/retailgraph?companyId=${companyId}`
    );
    setRows(data.store?.customers || []);
  }, [companyId, withAuthJson]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const save = async () => {
    if (!companyId) return;
    try {
      await withAuthJson('/api/retail/retailgraph', {
        method: 'POST',
        jsonBody: { companyId, action: 'upsert_customer', ...form },
      });
      toast.success('Customer saved');
      setForm({ name: '', email: '', phone: '' });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    }
  };

  return (
    <RetailgraphRequired>
      <RetailgraphPage
        title="Customers"
        description="Walk-in book. When they scan the till QR while signed in to SA Member, payment still lands on this shop."
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
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <button
            type="submit"
            className="rounded-xl bg-orange-600 px-3 py-2 text-sm font-black text-white"
          >
            Add
          </button>
        </form>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border bg-white">
            {rows.length === 0 ? (
              <li className="p-4 text-sm text-slate-500">No customers yet.</li>
            ) : (
              rows.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {[c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                  </p>
                </li>
              ))
            )}
          </ul>
        )}
      </RetailgraphPage>
    </RetailgraphRequired>
  );
}
