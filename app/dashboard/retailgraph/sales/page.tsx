'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  RetailgraphPage,
  RetailgraphRequired,
} from '@/components/retail/RetailgraphShell';
import { formatZar } from '@/lib/b2c/member-account-types';
import type { RetailSale } from '@/lib/retail/retailgraph';

export default function RetailSalesPage() {
  const { companyId, withAuthJson } = useApiAuth();
  const [sales, setSales] = useState<RetailSale[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{ store?: { sales?: RetailSale[] } }>(
      `/api/retail/retailgraph?companyId=${companyId}`
    );
    setSales(data.store?.sales || []);
  }, [companyId, withAuthJson]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  return (
    <RetailgraphRequired>
      <RetailgraphPage title="Sales" description="Paid till baskets.">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {sales.length === 0 ? (
              <li className="p-4 text-sm text-slate-500">No sales yet.</li>
            ) : (
              sales.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">
                      {new Date(s.created_at).toLocaleString()}
                    </p>
                    <p className="font-black">{formatZar(s.total_zar)}</p>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {s.paid_via || s.status} ·{' '}
                    {s.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}
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
