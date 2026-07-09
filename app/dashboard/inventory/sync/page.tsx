'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowLeftRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ContainerRecord } from '@/lib/containers/types';
import type { ProductRecord } from '@/lib/inventory/types';

export default function InventorySyncPage() {
  const companyId = getSelectedCompanyId();
  const [containers, setContainers] = useState<ContainerRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [transfers, setTransfers] = useState<Array<Record<string, unknown>>>([]);
  const [direction, setDirection] = useState<'warehouse_to_container' | 'container_to_warehouse'>(
    'warehouse_to_container'
  );
  const [containerId, setContainerId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [lot, setLot] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [c, p, t] = await Promise.all([
      fetch(`/api/containers?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/inventory/products?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/inventory/sync-transfer?companyId=${companyId}`).then((r) => r.json()),
    ]);
    setContainers(c.containers || []);
    setProducts(p.products || []);
    setTransfers(t.transfers || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!companyId || !containerId || !productId) {
      toast.error('Container and product required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/sync-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          direction,
          containerId: Number(containerId),
          productId: Number(productId),
          quantity: Number(qty),
          lot_number: lot || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed');
      toast.success(`Synced · hash ${String(data.onchain_hash || '').slice(0, 14)}…`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) {
    return (
      <div className="text-center py-16">
        <Link href="/dashboard/select-company" className="btn-primary px-6 py-3">Select company</Link>
      </div>
    );
  }

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <Link href="/dashboard/inventory" className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> Inventory
      </Link>
      <h1 className="text-3xl font-black tracking-[-2px] text-[#00b4d8] mb-2">
        Warehouse ↔ container sync
      </h1>
      <p className="text-neutral-600 text-sm mb-6 max-w-2xl">
        Auto-sync stock between central warehouse balances and retail container outlets — one ledger,
        one hash trail.
      </p>

      <div className="bg-white border rounded-3xl p-6 space-y-4 max-w-xl mb-8">
        <div className="flex gap-2">
          {(
            [
              ['warehouse_to_container', 'Warehouse → Container'],
              ['container_to_warehouse', 'Container → Warehouse'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setDirection(v)}
              className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold border ${
                direction === v
                  ? 'border-[#00b4d8] bg-[#00b4d8]/10 text-[#0077b6]'
                  : 'border-neutral-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          className="input w-full !p-3 !text-sm"
          value={containerId}
          onChange={(e) => setContainerId(e.target.value)}
        >
          <option value="">Container *</option>
          {containers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.container_code})
            </option>
          ))}
        </select>
        <select
          className="input w-full !p-3 !text-sm"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="">Product *</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.sku ? `(${p.sku})` : ''}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            className="input !p-3 !text-sm"
            placeholder="Qty"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <input
            className="input !p-3 !text-sm font-mono"
            placeholder="Lot (optional)"
            value={lot}
            onChange={(e) => setLot(e.target.value)}
          />
        </div>
        <button type="button" disabled={saving} onClick={() => void submit()} className="btn-primary w-full !py-3">
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            <>
              <ArrowLeftRight className="w-4 h-4" /> Execute sync
            </>
          )}
        </button>
      </div>

      <div className="bg-white border rounded-3xl overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold text-sm">Transfer history</div>
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
          </div>
        ) : transfers.length === 0 ? (
          <div className="p-10 text-center text-neutral-500 text-sm">No transfers yet</div>
        ) : (
          <ul className="divide-y">
            {transfers.map((t) => (
              <li key={String(t.id)} className="px-5 py-3 text-sm flex justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    {String(t.product_name || t.product_id)} × {String(t.quantity)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {String(t.from_type)} {String(t.from_id ?? '—')} → {String(t.to_type)}{' '}
                    {String(t.to_id ?? '—')}
                    {t.lot_number ? ` · lot ${String(t.lot_number)}` : ''}
                  </div>
                </div>
                <span className="text-xs capitalize text-neutral-500">{String(t.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
