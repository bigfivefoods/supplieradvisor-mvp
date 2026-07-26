'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, PackagePlus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type Product = { id: number; name: string; brand_name: string; uom?: string | null };

export default function KitchenPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState<Array<Record<string, unknown>>>([]);
  const [receipts, setReceipts] = useState<Array<Record<string, unknown>>>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [receiving, setReceiving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [kRes, pRes] = await Promise.all([
        fetch(`/api/schools/kitchen?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(`/api/schools/approved?companyId=${companyId}`, {
          cache: 'no-store',
        }),
      ]);
      const k = await kRes.json();
      const p = await pRes.json();
      if (!kRes.ok) throw new Error(k.error || 'Failed');
      setStock(k.stock || []);
      setReceipts(k.receipts || []);
      setProducts(p.products || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const receive = async () => {
    const prod = products.find((p) => p.id === Number(productId));
    if (!prod) return toast.error('Select approved product');
    setReceiving(true);
    try {
      const res = await fetch('/api/schools/kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'receive',
          lines: [
            {
              approved_product_id: prod.id,
              product_name: prod.name,
              brand_name: prod.brand_name,
              qty: Number(qty),
              uom: prod.uom || 'kg',
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'GRN rejected');
      toast.success('Received into kitchen (approved brand)');
      setProductId('');
      setQty('1');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setReceiving(false);
    }
  };

  const adjust = async (
    stockId: number,
    action: 'issue' | 'waste',
    defaultQty = 1
  ) => {
    const raw = window.prompt(
      action === 'waste'
        ? 'Waste quantity to write off'
        : 'Issue quantity to kitchen/serve',
      String(defaultQty)
    );
    if (raw == null) return;
    const q = Number(raw);
    if (!(q > 0)) return toast.error('Enter a positive quantity');
    try {
      const res = await fetch('/api/schools/kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action,
          stock_id: stockId,
          qty: q,
          reason: action === 'waste' ? 'kitchen_waste' : 'serve_day',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(action === 'waste' ? 'Waste logged' : 'Stock issued');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Kitchen stock"
        titleAccent="GRN gate"
        description="Receive only NSNP-approved brands. Issue to serve day and log waste so stock matches the plate."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 flex flex-wrap gap-2 items-end">
        <label className="text-xs flex-1 min-w-[12rem]">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Approved product
          </span>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Select…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand_name} — {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs w-28">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Qty
          </span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void receive()}
          disabled={receiving}
          className="btn-primary !py-2 !px-4 text-xs inline-flex items-center gap-1"
        >
          {receiving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <PackagePlus className="w-3.5 h-3.5" />
          )}
          Receive GRN
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
              On hand
            </div>
            <table className="w-full text-sm">
              <tbody>
                {stock.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500">
                      No stock yet
                    </td>
                  </tr>
                ) : (
                  stock.map((s) => (
                    <tr key={String(s.id)} className="border-b border-slate-50">
                      <td className="px-4 py-2">
                        <div className="font-semibold">
                          {String(s.product_name)}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-700">
                          {String(s.brand_name)}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="font-black tabular-nums">
                          {Number(s.qty_on_hand)} {String(s.uom || '')}
                        </div>
                        <div className="flex justify-end gap-1 mt-1">
                          <button
                            type="button"
                            onClick={() =>
                              void adjust(Number(s.id), 'issue', 1)
                            }
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-sky-200 text-sky-800 bg-sky-50"
                          >
                            Issue
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void adjust(Number(s.id), 'waste', 1)
                            }
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200 text-amber-900 bg-amber-50"
                          >
                            Waste
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
              Recent receipts
            </div>
            <ul className="divide-y text-sm">
              {receipts.length === 0 ? (
                <li className="px-4 py-8 text-center text-slate-500">
                  No receipts
                </li>
              ) : (
                receipts.map((r) => (
                  <li key={String(r.id)} className="px-4 py-3 flex justify-between">
                    <span className="font-mono text-xs font-bold">
                      {String(r.receipt_number)}
                    </span>
                    <span className="text-xs">
                      {String(r.received_at)} ·{' '}
                      {r.compliance_ok !== false ? (
                        <span className="text-emerald-700 font-bold">OK</span>
                      ) : (
                        <span className="text-amber-700 font-bold">FLAG</span>
                      )}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}
