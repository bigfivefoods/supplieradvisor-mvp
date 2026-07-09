'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { StockLevelRecord } from '@/lib/inventory/types';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';

export default function StockTakePage() {
  return (
    <CompanyRequired>
      <StockTakeInner />
    </CompanyRequired>
  );
}

function StockTakeInner() {
  const companyId = getSelectedCompanyId()!;
  const [levels, setLevels] = useState<StockLevelRecord[]>([]);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inventory/stock?companyId=${companyId}`);
    const data = await res.json();
    const list = (data.levels || []) as StockLevelRecord[];
    setLevels(list);
    const init: Record<number, string> = {};
    list.forEach((l) => {
      init[l.id] = String(l.qty_on_hand ?? 0);
    });
    setCounts(init);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setSaving(true);
    try {
      let n = 0;
      for (const level of levels) {
        const counted = Number(counts[level.id]);
        if (!Number.isFinite(counted)) continue;
        if (counted === Number(level.qty_on_hand)) continue;
        const res = await fetch('/api/inventory/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            productId: level.product_id,
            warehouseId: level.warehouse_id,
            quantity: counted,
            movement_type: 'count',
            absolute: true,
            notes: 'Stock take',
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Count failed');
        }
        n += 1;
      }
      toast.success(n ? `Adjusted ${n} line${n === 1 ? '' : 's'}` : 'No variances to post');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <InventoryHeader
        title="Stock take"
        description="Physical count against live stock_levels. Variances post as count movements with hash."
        action={
          <button
            type="button"
            disabled={saving || levels.length === 0}
            onClick={() => void submit()}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ClipboardCheck className="w-4 h-4" /> Post variances
              </>
            )}
          </button>
        }
      />

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : levels.length === 0 ? (
          <div className="p-16 text-center text-neutral-500 text-sm">
            No stock lines — receive stock first on Stock levels.
          </div>
        ) : (
          <ul className="divide-y">
            {levels.map((l) => {
              const system = Number(l.qty_on_hand);
              const counted = Number(counts[l.id]);
              const variance = Number.isFinite(counted) ? counted - system : 0;
              return (
                <li key={l.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {(l.product as { name?: string } | null)?.name || `Product #${l.product_id}`}
                    </div>
                    <div className="text-xs text-neutral-500">
                      System: {system}
                      {variance !== 0 && Number.isFinite(counted) && (
                        <span className={variance > 0 ? ' text-emerald-700' : ' text-red-700'}>
                          {' '}
                          · variance {variance > 0 ? '+' : ''}
                          {variance}
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="number"
                    className="input !p-2 !text-base w-28 text-right"
                    value={counts[l.id] ?? ''}
                    onChange={(e) => setCounts({ ...counts, [l.id]: e.target.value })}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
