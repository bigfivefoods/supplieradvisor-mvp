'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, RefreshCw, Trophy, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/accounting/types';
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

export default function SchoolOrdersPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([]);
  const [showForm, setShowForm] = useState(false);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('0');
  const [ispId, setIspId] = useState('');
  const [lines, setLines] = useState<
    Array<{
      approved_product_id: number;
      product_name: string;
      brand_name: string;
      qty: number;
      unit_price: number;
      uom: string;
    }>
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [catalogueLabel, setCatalogueLabel] = useState('department approved list');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [oRes, pRes, iRes] = await Promise.all([
        fetch(`/api/schools/orders?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(`/api/schools/approved?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(`/api/schools/isps?companyId=${companyId}`, {
          cache: 'no-store',
        }),
      ]);
      const o = await oRes.json();
      const p = await pRes.json();
      const i = await iRes.json();
      if (!oRes.ok) throw new Error(o.error || 'Failed');
      setOrders(o.orders || []);
      setProducts(p.products || []);
      // Only active SP links for ordering (preferred first from API)
      const active = (i.links || []).filter(
        (l: Record<string, unknown>) => String(l.status) === 'active'
      );
      setLinks(active);
      setIspId((prev) => {
        if (prev) return prev;
        const preferred = active.find(
          (l: Record<string, unknown>) => l.preferred
        );
        const first = preferred || active[0];
        return first ? String(first.isp_profile_id) : '';
      });
      if (p.catalogue?.agencyName) {
        setCatalogueLabel(`${p.catalogue.agencyName} approved foods`);
      } else if (p.agencyName) {
        setCatalogueLabel(`${p.agencyName} approved foods`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addLine = () => {
    const prod = products.find((p) => p.id === Number(productId));
    if (!prod) {
      return toast.error(
        'Select a product from the department approved list only'
      );
    }
    if (!Number.isFinite(prod.id) || prod.id <= 0) {
      return toast.error('Invalid product — off-catalogue items are blocked');
    }
    const q = Number(qty);
    if (!(q > 0)) return toast.error('Qty must be > 0');
    setLines((prev) => [
      ...prev,
      {
        approved_product_id: prod.id,
        product_name: prod.name,
        brand_name: prod.brand_name,
        qty: q,
        unit_price: Number(price) || 0,
        uom: prod.uom || 'kg',
      },
    ]);
    setProductId('');
    setQty('1');
    setPrice('0');
  };

  const submit = async () => {
    if (!lines.length) return toast.error('Add approved product lines first');
    if (!ispId) {
      return toast.error('Select a service provider (preferred SPs listed first)');
    }
    // Client hard-block: every line must have catalogue id
    if (lines.some((l) => !l.approved_product_id)) {
      return toast.error('Off-catalogue lines blocked — remove them before submit');
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/schools/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          isp_profile_id: Number(ispId),
          lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(data.rejected)
          ? ` ${data.rejected.slice(0, 2).join('; ')}`
          : '';
        throw new Error(`${data.error || 'PO rejected'}${detail}`);
      }
      toast.success(
        `PO ${data.order?.po_number} created — approved only · SP notified path ready`
      );
      setLines([]);
      setShowForm(false);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Kitchen orders"
        titleAccent="Approved only"
        description="Schools and clinics may only order products on their DBE/DoH approved list. That protects claim funding and headmaster prize score."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> New PO
            </button>
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

      <div className="mb-4 grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950 flex gap-2">
          <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-700" />
          <div>
            <p className="font-black text-xs uppercase tracking-wide">
              Hard gate · {catalogueLabel}
            </p>
            <p className="text-[13px] mt-0.5">
              Every PO line must be on the department list. Off-catalogue
              products are rejected — not partial-accepted.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 flex gap-2">
          <Trophy className="w-5 h-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-black text-xs uppercase tracking-wide">
              Incentive · prizes & claims
            </p>
            <p className="text-[13px] mt-0.5">
              Approved-brand spend is ~55% of the headmaster prize. Claims need
              ≥98% on-catalogue GRNs for full funding.{' '}
              <Link
                href="/dashboard/schools/prizes"
                className="font-bold underline"
              >
                Prize score
              </Link>
              {' · '}
              <Link
                href="/dashboard/schools/claims"
                className="font-bold underline"
              >
                Claims
              </Link>
            </p>
          </div>
        </div>
      </div>

      {showForm ? (
        <div className="mb-6 rounded-3xl border border-sky-100 bg-sky-50/40 p-5 space-y-3">
          <div className="grid sm:grid-cols-4 gap-2">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Approved product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand_name} — {p.name}
                </option>
              ))}
            </select>
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Unit price"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm min-w-[14rem]"
              value={ispId}
              onChange={(e) => setIspId(e.target.value)}
              required
            >
              <option value="">Service provider (required)…</option>
              {links.map((l) => {
                const badge = l.preferred
                  ? '★ Preferred'
                  : l.incentive_badge
                    ? String(l.incentive_badge).split('·')[0].trim()
                    : 'Active';
                return (
                  <option
                    key={String(l.id)}
                    value={String(l.isp_profile_id)}
                  >
                    {badge} · {String(l.display_name || l.isp_profile_id)}
                    {l.incentive_score != null
                      ? ` (${Number(l.incentive_score).toFixed(0)}%)`
                      : ''}
                  </option>
                );
              })}
            </select>
            {links.some((l) => l.preferred) ? (
              <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-1">
                ★ Preferred SPs listed first
              </span>
            ) : null}
            <button
              type="button"
              onClick={addLine}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              Add approved line
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || !lines.length || !ispId}
              className="btn-primary !py-2 !px-3 text-xs"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                'Submit PO'
              )}
            </button>
          </div>
          {links.length === 0 ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              No active SP links. Accept an SP claim or link a department-approved
              SP under{' '}
              <Link href="/dashboard/schools/isps" className="font-bold underline">
                SPs
              </Link>
              .
            </p>
          ) : null}
          {lines.length > 0 ? (
            <ul className="text-xs space-y-1">
              {lines.map((l, i) => (
                <li key={i}>
                  {l.brand_name} · {l.product_name} × {l.qty} @{' '}
                  {formatMoney(l.unit_price)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">PO</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No orders yet.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={String(o.id)} className="border-b border-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">
                      {String(o.po_number)}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {String(o.order_date || '').slice(0, 10)}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-xs">
                      {String(o.status)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                      {formatMoney(Number(o.total_amount || 0))}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {o.compliance_ok !== false ? (
                        <span className="text-emerald-700 font-bold">OK</span>
                      ) : (
                        <span className="text-amber-700 font-bold">Flags</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </SchoolsPage>
  );
}
