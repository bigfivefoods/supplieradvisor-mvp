'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';

export default function CycleCountsPage() {
  return (
    <CompanyRequired>
      <CycleCountsInner />
    </CompanyRequired>
  );
}

function CycleCountsInner() {
  const companyId = getSelectedCompanyId()!;
  const [movements, setMovements] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inventory/movements?companyId=${companyId}&type=count`);
    const data = await res.json();
    setMovements(data.movements || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <InventoryHeader
        title="Cycle counts"
        description="Count movements from stock take and scan adjustments (stock_movements where type = count)."
        action={
          <Link href="/dashboard/inventory/stock-take" className="btn-primary !py-2.5 !px-5 text-sm">
            <RefreshCw className="w-4 h-4" /> Run stock take
          </Link>
        }
      />

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : movements.length === 0 ? (
          <div className="p-16 text-center text-neutral-500 text-sm">
            No count movements yet. Post a stock take to create cycle-count history.
          </div>
        ) : (
          <ul className="divide-y">
            {movements.map((m) => (
              <li key={String(m.id)} className="px-5 py-3 text-sm flex justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    {String(m.product_name || m.product_id)} · qty set {String(m.quantity)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {String(m.notes || 'count')} · {String(m.created_at || '').slice(0, 19)}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-neutral-400">
                  {String(m.onchain_hash || '').slice(0, 12)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
