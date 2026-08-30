'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/lib/inventory/types';
import { ProductPhoto } from '@/components/inventory/ProductPhoto';

type InvRow = {
  id: number;
  name: string;
  sku: string | null;
  cost_price: number | null;
  primary_image_url: string | null;
};

export function PortalCataloguePicker({
  companyId,
  supplierId,
  tickedIds,
  onChanged,
}: {
  companyId: number;
  supplierId: number;
  tickedIds: number[];
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<InvRow[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const ticked = useMemo(() => new Set(tickedIds), [tickedIds]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/inventory/products?companyId=${companyId}`);
    const data = await res.json();
    const list = ((data.products || []) as Record<string, unknown>[]).map((p) => ({
      id: Number(p.id),
      name: String(p.name || `SKU ${p.id}`),
      sku: p.sku != null ? String(p.sku) : null,
      cost_price:
        p.cost_price != null && Number.isFinite(Number(p.cost_price))
          ? Number(p.cost_price)
          : null,
      primary_image_url:
        p.primary_image_url != null ? String(p.primary_image_url) : null,
    }));
    setRows(list.filter((r) => r.id > 0));
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        (r.sku && r.sku.toLowerCase().includes(needle))
    );
  }, [rows, q]);

  const run = async (body: Record<string, unknown>) => {
    const key = String(body.productId || body.action || 'set');
    setBusy(key);
    try {
      const res = await fetch('/api/commercial/lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          companyId,
          partyKind: 'supplier',
          supplierId,
          ...body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-[1.5rem] border border-white/70 bg-white/90 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
            Portal catalogue
          </p>
          <h2 className="text-sm font-black text-slate-900">
            SKUs this supplier supplies us
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Ticked items appear on their portal Commercial and PO picker at
            inventory cost. Stock at their DC is separate.
          </p>
        </div>
        <span className="text-[11px] font-bold tabular-nums text-slate-500">
          {tickedIds.length}/{rows.length || 0}
        </span>
      </div>
      <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-slate-50">
        <input
          className="input !py-1.5 !px-3 !text-sm flex-1 min-w-[10rem]"
          placeholder="Search name or SKU"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          disabled={!!busy}
          className="rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-[#0077b6]"
          onClick={() => void run({ action: 'share_all' })}
        >
          {busy === 'share_all' ? 'Saving…' : 'Share all'}
        </button>
        <button
          type="button"
          disabled={!!busy}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600"
          onClick={() => void run({ action: 'share_none' })}
        >
          {busy === 'share_none' ? 'Saving…' : 'Share none'}
        </button>
      </div>
      <ul className="max-h-[28rem] overflow-auto divide-y divide-slate-50">
        {shown.map((p) => {
          const on = ticked.has(p.id);
          return (
            <li key={p.id} className="px-4 py-2.5 flex items-center gap-3">
              {p.primary_image_url ? (
                <ProductPhoto
                  src={p.primary_image_url}
                  alt=""
                  className="h-10 w-10 rounded-lg border border-slate-100 shrink-0"
                />
              ) : (
                <span className="h-10 w-10 rounded-lg bg-slate-100 shrink-0" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900 truncate">
                  {p.name}
                </span>
                <span className="block text-[11px] text-neutral-500">
                  {p.sku ? `${p.sku} · ` : ''}
                  {p.cost_price != null
                    ? formatMoney(p.cost_price, 'ZAR')
                    : 'No cost'}
                </span>
              </span>
              <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 shrink-0">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={on}
                  disabled={!!busy}
                  onChange={(e) =>
                    void run({
                      action: 'share',
                      productId: p.id,
                      shared: e.target.checked,
                    })
                  }
                />
                {on ? 'On portal' : 'Off'}
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
