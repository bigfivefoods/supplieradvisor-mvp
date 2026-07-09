'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ProductRecord } from '@/lib/inventory/types';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';

type Wh = { id: number; name: string };

export default function StockTransfersPage() {
  return (
    <CompanyRequired>
      <TransfersInner />
    </CompanyRequired>
  );
}

function TransfersInner() {
  const companyId = getSelectedCompanyId()!;
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [movements, setMovements] = useState<Array<Record<string, unknown>>>([]);
  const [productId, setProductId] = useState('');
  const [fromWh, setFromWh] = useState('');
  const [toWh, setToWh] = useState('');
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, w, m] = await Promise.all([
      fetch(`/api/inventory/products?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/inventory/warehouses?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/inventory/movements?companyId=${companyId}&type=transfer`).then((r) => r.json()),
    ]);
    setProducts(p.products || []);
    setWarehouses(w.warehouses || []);
    setMovements(m.movements || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!productId || !fromWh || !toWh) {
      toast.error('Product, from and to warehouse required');
      return;
    }
    if (fromWh === toWh) {
      toast.error('Choose different warehouses');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          productId: Number(productId),
          warehouseId: Number(fromWh),
          toWarehouseId: Number(toWh),
          quantity: Number(qty),
          movement_type: 'transfer',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed');
      toast.success(`Transfer recorded · ${String(data.onchain_hash || '').slice(0, 12)}…`);
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
        title="Stock transfers"
        description="Move stock between warehouses. Writes stock_movements + updates stock_levels (Supabase)."
        action={
          <Link href="/dashboard/inventory/sync" className="btn-secondary !py-2.5 !px-4 text-sm">
            Warehouse ↔ container
          </Link>
        }
      />

      <div className="bg-white border rounded-3xl p-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <select
          className="input !p-3 !text-sm lg:col-span-2"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="">Product *</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select className="input !p-3 !text-sm" value={fromWh} onChange={(e) => setFromWh(e.target.value)}>
          <option value="">From warehouse *</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select className="input !p-3 !text-sm" value={toWh} onChange={(e) => setToWh(e.target.value)}>
          <option value="">To warehouse *</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="number"
            className="input !p-3 !text-sm flex-1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button type="button" disabled={saving} onClick={() => void submit()} className="btn-primary !px-4">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-3xl overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold text-sm">Transfer history</div>
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
          </div>
        ) : movements.length === 0 ? (
          <div className="p-10 text-center text-neutral-500 text-sm">No transfers yet</div>
        ) : (
          <ul className="divide-y">
            {movements.map((m) => (
              <li key={String(m.id)} className="px-5 py-3 text-sm flex justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    {String(m.product_name || m.product_id)} × {String(m.quantity)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {String(
                      m.from_warehouse_name ||
                        m.from_warehouse_id ||
                        m.warehouse_name ||
                        m.warehouse_id ||
                        '—'
                    )}{' '}
                    → {String(m.to_warehouse_name || m.to_warehouse_id || '—')} ·{' '}
                    {String(m.created_at || '').slice(0, 19)}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-neutral-400 max-w-[100px] truncate">
                  {String(m.onchain_hash || '').slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
