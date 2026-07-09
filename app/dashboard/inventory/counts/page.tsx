'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, ClipboardCheck, History } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { StockLevelRecord } from '@/lib/inventory/types';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';

/**
 * Unified stock counts: physical stock take + count history.
 * Replaces separate stock-take and cycle-counts pages.
 */
export default function CountsPage() {
  return (
    <CompanyRequired>
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        }
      >
        <CountsInner />
      </Suspense>
    </CompanyRequired>
  );
}

function CountsInner() {
  const companyId = getSelectedCompanyId()!;
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'history' ? 'history' : 'take';
  const [tab, setTab] = useState<'take' | 'history'>(initialTab);

  const [levels, setLevels] = useState<StockLevelRecord[]>([]);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [movements, setMovements] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, mRes] = await Promise.all([
        fetch(`/api/inventory/stock?companyId=${companyId}`).then((r) => r.json()),
        fetch(`/api/inventory/movements?companyId=${companyId}&type=count`).then((r) => r.json()),
      ]);
      const list = (sRes.levels || []) as StockLevelRecord[];
      setLevels(list);
      const init: Record<number, string> = {};
      list.forEach((l) => {
        init[l.id] = String(l.qty_on_hand ?? 0);
      });
      setCounts(init);
      setMovements(mRes.movements || []);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'history') setTab('history');
    else if (t === 'take') setTab('take');
  }, [searchParams]);

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
      toast.success(n ? `Posted ${n} variance${n === 1 ? '' : 's'}` : 'No variances to post');
      setTab('history');
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
        title="Counts"
        description="Physical stock take against live stock_levels, then review count history. One place for take and cycle-count records."
        action={
          tab === 'take' ? (
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
          ) : undefined
        }
      />

      <div className="flex rounded-2xl border bg-white p-1 gap-1 mb-6 w-fit">
        <button
          type="button"
          onClick={() => setTab('take')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
            tab === 'take' ? 'bg-[#00b4d8] text-white' : 'text-neutral-600'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" /> Stock take
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
            tab === 'history' ? 'bg-[#00b4d8] text-white' : 'text-neutral-600'
          }`}
        >
          <History className="w-3.5 h-3.5" /> History
        </button>
      </div>

      {loading ? (
        <div className="p-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : tab === 'take' ? (
        <div className="bg-white border rounded-3xl overflow-hidden">
          {levels.length === 0 ? (
            <div className="p-16 text-center text-neutral-500 text-sm">
              No stock lines — receive stock first on Live stock or Receive (scan).
            </div>
          ) : (
            <ul className="divide-y">
              {levels.map((l) => {
                const system = Number(l.qty_on_hand);
                const counted = Number(counts[l.id]);
                const variance = Number.isFinite(counted) ? counted - system : 0;
                return (
                  <li
                    key={l.id}
                    className="px-5 py-3 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {(l.product as { name?: string } | null)?.name ||
                          `Product #${l.product_id}`}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {(l.warehouse as { name?: string } | null)?.name || 'Unassigned'} · System:{' '}
                        {system}
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
      ) : (
        <div className="bg-white border rounded-3xl overflow-hidden">
          {movements.length === 0 ? (
            <div className="p-16 text-center text-neutral-500 text-sm">
              No count movements yet. Post a stock take to create history.
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
      )}
    </div>
  );
}
