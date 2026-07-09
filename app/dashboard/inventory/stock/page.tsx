'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, PackagePlus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ProductRecord, StockLevelRecord } from '@/lib/inventory/types';

export default function StockLevelsPage() {
  const companyId = getSelectedCompanyId();
  const [levels, setLevels] = useState<StockLevelRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [action, setAction] = useState('receive');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [sRes, pRes] = await Promise.all([
      fetch(`/api/inventory/stock?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/inventory/products?companyId=${companyId}`).then((r) => r.json()),
    ]);
    setLevels(sRes.levels || []);
    setProducts(pRes.products || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const move = async () => {
    if (!companyId || !productId) {
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

  if (!companyId) {
    return (
      <div className="text-center py-16">
        <Link href="/dashboard/select-company" className="btn-primary px-6 py-3">
          Select company
        </Link>
      </div>
    );
  }

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <Link href="/dashboard/inventory" className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> Inventory
      </Link>
      <h1 className="text-3xl font-black tracking-[-2px] text-[#00b4d8] mb-2">Stock levels</h1>
      <p className="text-neutral-600 mb-6 text-sm">
        Live on-hand balances. Movements write to an immutable ledger with on-chain hash.
      </p>

      <div className="bg-white border rounded-3xl p-5 mb-6 grid sm:grid-cols-4 gap-3">
        <select
          className="input !p-3 !text-sm sm:col-span-2"
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
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
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
          <button type="button" disabled={saving} onClick={() => void move()} className="btn-primary !px-4 !py-2">
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
