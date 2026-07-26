'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  PackagePlus,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type Product = {
  id: number;
  name: string;
  brand_name: string;
  uom?: string | null;
};

type OpenOrder = {
  id: number;
  po_number?: string | null;
  status?: string;
  order_date?: string;
  total_amount?: number;
  lines?: Array<{
    approved_product_id?: number;
    product_name?: string;
    brand_name?: string;
    qty?: number;
    uom?: string;
  }>;
  isp_profile_id?: number | null;
};

type GrnLine = {
  approved_product_id: number;
  product_name: string;
  brand_name: string;
  qty: string;
  uom: string;
};

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
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [poId, setPoId] = useState('');
  const [lines, setLines] = useState<GrnLine[]>([]);
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
      setOpenOrders(k.openOrders || []);
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

  const selectedPo = useMemo(
    () => openOrders.find((o) => o.id === Number(poId)) || null,
    [openOrders, poId]
  );

  useEffect(() => {
    if (!selectedPo) return;
    const poLines = Array.isArray(selectedPo.lines) ? selectedPo.lines : [];
    setLines(
      poLines
        .filter((l) => Number(l.approved_product_id) > 0)
        .map((l) => ({
          approved_product_id: Number(l.approved_product_id),
          product_name: String(l.product_name || ''),
          brand_name: String(l.brand_name || ''),
          qty: String(l.qty ?? 1),
          uom: String(l.uom || 'kg'),
        }))
    );
  }, [selectedPo]);

  const addBlankLine = () => {
    const first = products[0];
    if (!first) return toast.error('No approved products — join DBE catalogue first');
    setLines((prev) => [
      ...prev,
      {
        approved_product_id: first.id,
        product_name: first.name,
        brand_name: first.brand_name,
        qty: '1',
        uom: first.uom || 'kg',
      },
    ]);
  };

  const receive = async () => {
    const payloadLines = lines
      .map((l) => ({
        approved_product_id: l.approved_product_id,
        product_name: l.product_name,
        brand_name: l.brand_name,
        qty: Number(l.qty),
        uom: l.uom,
      }))
      .filter((l) => l.qty > 0 && l.approved_product_id > 0);

    if (!payloadLines.length) {
      return toast.error('Add at least one line with quantity');
    }

    setReceiving(true);
    try {
      const res = await fetch('/api/schools/kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'receive',
          po_id: poId ? Number(poId) : null,
          isp_profile_id: selectedPo?.isp_profile_id || null,
          lines: payloadLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'GRN rejected');
      toast.success(
        data.po_status
          ? `GRN posted · PO → ${data.po_status}`
          : 'Received into kitchen (approved brands only)'
      );
      setLines([]);
      setPoId('');
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
        titleAccent="PO → GRN"
        description="Receive open purchase orders into stock — only NSNP-approved brands. Issue & waste keep the plate loop honest."
        action={
          <div className="flex gap-2">
            <Link
              href="/dashboard/schools/orders"
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <ClipboardList className="w-3.5 h-3.5" /> Orders
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs flex-1 min-w-[14rem]">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Receive against open PO
            </span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={poId}
              onChange={(e) => setPoId(e.target.value)}
            >
              <option value="">Manual GRN (no PO)</option>
              {openOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.po_number || `PO #${o.id}`} · {o.status} ·{' '}
                  {o.order_date || ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={addBlankLine}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            + Line
          </button>
          <button
            type="button"
            onClick={() => void receive()}
            disabled={receiving || lines.length === 0}
            className="btn-primary !py-2 !px-4 text-xs inline-flex items-center gap-1"
          >
            {receiving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PackagePlus className="w-3.5 h-3.5" />
            )}
            Post GRN
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-slate-500">
            Select an open PO to load lines, or add a manual line from the
            approved list.
          </p>
        ) : (
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div
                key={`${line.approved_product_id}-${idx}`}
                className="grid grid-cols-12 gap-2 items-end"
              >
                <label className="col-span-12 sm:col-span-6 text-xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Product
                  </span>
                  <select
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={line.approved_product_id}
                    onChange={(e) => {
                      const p = products.find(
                        (x) => x.id === Number(e.target.value)
                      );
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx
                            ? {
                                ...l,
                                approved_product_id: Number(e.target.value),
                                product_name: p?.name || l.product_name,
                                brand_name: p?.brand_name || l.brand_name,
                                uom: p?.uom || l.uom,
                              }
                            : l
                        )
                      );
                    }}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.brand_name} — {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-4 sm:col-span-2 text-xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Qty
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                    value={line.qty}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, qty: e.target.value } : l
                        )
                      )
                    }
                  />
                </label>
                <label className="col-span-4 sm:col-span-2 text-xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    UOM
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={line.uom}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, uom: e.target.value } : l
                        )
                      )
                    }
                  />
                </label>
                <div className="col-span-4 sm:col-span-2">
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="w-full text-xs font-bold text-rose-700 border border-rose-200 rounded-xl py-2 bg-rose-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
                      No stock yet — post a GRN
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
                  <li
                    key={String(r.id)}
                    className="px-4 py-3 flex justify-between gap-2"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold">
                        {String(r.receipt_number)}
                      </span>
                      {r.po_id ? (
                        <span className="ml-2 text-[10px] font-bold text-[#0077b6]">
                          PO #{String(r.po_id)}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs shrink-0">
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
