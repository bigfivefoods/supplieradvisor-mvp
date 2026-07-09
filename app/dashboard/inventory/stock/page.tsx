'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, PackagePlus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ProductRecord, StockLevelRecord } from '@/lib/inventory/types';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';

type Wh = { id: number; name: string };

export default function StockLevelsPage() {
  return (
    <CompanyRequired>
      <StockInner />
    </CompanyRequired>
  );
}

function StockInner() {
  const companyId = getSelectedCompanyId()!;
  const [levels, setLevels] = useState<StockLevelRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [qty, setQty] = useState('1');
  const [action, setAction] = useState('receive');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, pRes, wRes] = await Promise.all([
      fetch(`/api/inventory/stock?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/inventory/products?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/inventory/warehouses?companyId=${companyId}`).then((r) => r.json()),
    ]);
    setLevels(sRes.levels || []);
    setProducts(pRes.products || []);
    setWarehouses(wRes.warehouses || []);
    if (sRes.warning) toast.message(sRes.warning);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const move = async () => {
    if (!productId) {
      toast.error('Select a product');
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
          warehouseId: warehouseId ? Number(warehouseId) : undefined,
          quantity: Number(qty),
          movement_type: action,
          absolute: action === 'count',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Stock updated · hash ${String(data.onchain_hash || '').slice(0, 12)}…`);
      setQty('1');
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
        title="Stock levels"
        description="Live stock_levels by product and warehouse. Movements write to stock_movements with on-chain hash."
      />

      <div className="bg-white border rounded-3xl p-5 mb-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <select
          className="input !p-3 !text-sm lg:col-span-2"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="">Select product *</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.sku ? `(${p.sku})` : ''}
            </option>
          ))}
        </select>
        <select
          className="input !p-3 !text-sm"
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
        >
          <option value="">Default location</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select className="input !p-3 !text-sm" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="receive">Receive</option>
          <option value="issue">Issue</option>
          <option value="adjustment">Adjust (+/−)</option>
          <option value="count">Set count</option>
        </select>
        <div className="flex gap-2">
          <input
            type="number"
            className="input !p-3 !text-sm flex-1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button type="button" disabled={saving} onClick={() => void move()} className="btn-primary !px-4">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : levels.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 text-sm">
            No stock lines yet — receive stock against a product.
          </div>
        ) : (
          <ul className="divide-y">
            {levels.map((l) => {
              const low = Number(l.qty_on_hand) <= Number(l.reorder_level || 0);
              return (
                <li
                  key={l.id}
                  className={`px-5 py-4 flex justify-between gap-3 ${low ? 'bg-amber-50/50' : ''}`}
                >
                  <div>
                    <div className="font-semibold">
                      {(l.product as { name?: string } | null)?.name || `Product #${l.product_id}`}
                    </div>
                    <div className="text-xs text-neutral-500 font-mono">
                      {(l.product as { sku?: string } | null)?.sku || '—'}
                      {l.warehouse
                        ? ` · ${(l.warehouse as { name?: string }).name}`
                        : ' · default location'}
                      {l.lot_number ? ` · lot ${l.lot_number}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{Number(l.qty_on_hand)}</div>
                    {low && (
                      <div className="text-xs text-amber-700 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Reorder
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
