'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertTriangle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ProductRecord } from '@/lib/inventory/types';

type Lot = {
  id: number;
  product_id: number;
  lot_number: string;
  expiry_date?: string | null;
  qty_on_hand: number;
  status?: string;
  gtin14?: string | null;
  warehouse_id?: number | null;
  container_id?: number | null;
};

export default function LotsPage() {
  const companyId = getSelectedCompanyId();
  const [lots, setLots] = useState<Lot[]>([]);
  const [serials, setSerials] = useState<Array<{ id: number; serial_number: string; lot_number?: string; status?: string }>>([]);
  const [expiring, setExpiring] = useState<Lot[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    product_id: '',
    lot_number: '',
    expiry_date: '',
    qty_on_hand: '0',
    serials: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [lRes, pRes] = await Promise.all([
      fetch(`/api/inventory/lots?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/inventory/products?companyId=${companyId}`).then((r) => r.json()),
    ]);
    setLots(lRes.lots || []);
    setSerials(lRes.serials || []);
    setExpiring(lRes.expiringSoon || []);
    setProducts(pRes.products || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!companyId || !form.product_id || !form.lot_number) {
      toast.error('Product and lot number required');
      return;
    }
    setSaving(true);
    try {
      const serials = form.serials
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch('/api/inventory/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          product_id: Number(form.product_id),
          lot_number: form.lot_number,
          expiry_date: form.expiry_date || null,
          qty_on_hand: Number(form.qty_on_hand) || 0,
          serials,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Lot registered');
      setForm({ product_id: '', lot_number: '', expiry_date: '', qty_on_hand: '0', serials: '' });
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

  const productName = (id: number) => products.find((p) => p.id === id)?.name || `#${id}`;

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <Link href="/dashboard/inventory" className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> Inventory
      </Link>
      <h1 className="text-3xl font-black tracking-[-2px] text-[#00b4d8] mb-2">Lots &amp; serials</h1>
      <p className="text-neutral-600 text-sm mb-6">
        Full pedigree: lot numbers, expiry, and serial tracking for regulated / high-value stock.
      </p>

      {expiring.length > 0 && (
        <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-900 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {expiring.length} lot{expiring.length === 1 ? '' : 's'} expire within 30 days
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-white border rounded-3xl p-5 space-y-3 h-fit">
          <h2 className="font-bold flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#00b4d8]" /> Register lot
          </h2>
          <select
            className="input w-full !p-3 !text-sm"
            value={form.product_id}
            onChange={(e) => setForm({ ...form, product_id: e.target.value })}
          >
            <option value="">Product *</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            className="input w-full !p-3 !text-sm font-mono"
            placeholder="Lot number *"
            value={form.lot_number}
            onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="input !p-3 !text-sm"
              value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
            />
            <input
              type="number"
              className="input !p-3 !text-sm"
              placeholder="Qty"
              value={form.qty_on_hand}
              onChange={(e) => setForm({ ...form, qty_on_hand: e.target.value })}
            />
          </div>
          <textarea
            className="input w-full !p-3 !text-sm min-h-[70px] font-mono"
            placeholder="Serial numbers (comma or newline)"
            value={form.serials}
            onChange={(e) => setForm({ ...form, serials: e.target.value })}
          />
          <button type="button" disabled={saving} onClick={() => void create()} className="btn-primary w-full !py-3">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save lot'}
          </button>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border rounded-3xl overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold text-sm">Lots</div>
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" /></div>
            ) : lots.length === 0 ? (
              <div className="p-10 text-center text-neutral-500 text-sm">No lots yet</div>
            ) : (
              <ul className="divide-y">
                {lots.map((l) => (
                  <li key={l.id} className="px-5 py-3 flex justify-between gap-3 text-sm">
                    <div>
                      <div className="font-semibold">{l.lot_number}</div>
                      <div className="text-xs text-neutral-500">
                        {productName(l.product_id)}
                        {l.expiry_date ? ` · exp ${l.expiry_date}` : ''}
                      </div>
                    </div>
                    <div className="font-bold">{Number(l.qty_on_hand)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-white border rounded-3xl overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold text-sm">Serials ({serials.length})</div>
            {serials.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-sm">No serials tracked</div>
            ) : (
              <ul className="divide-y max-h-64 overflow-y-auto">
                {serials.slice(0, 100).map((s) => (
                  <li key={s.id} className="px-5 py-2 text-sm flex justify-between">
                    <span className="font-mono text-xs">{s.serial_number}</span>
                    <span className="text-xs text-neutral-500 capitalize">{s.status} · {s.lot_number || '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
