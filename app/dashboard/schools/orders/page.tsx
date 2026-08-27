'use client';

/**
 * School: order approved catalogue products from linked SPs.
 * SP: inbox of school POs to source from wholesalers and fulfil.
 * Process: School checks kitchen vs DBE menu → PO to SP when short → SP procures & delivers → school GRN → serve.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  RefreshCw,
  Trophy,
  ShieldCheck,
  Truck,
  Package,
  Utensils,
  ArrowRight,
  ShoppingCart,
  ExternalLink,
  Printer,
  CheckCircle2,
  Star,
  Minus,
  Trash2,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/accounting/types';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import SchoolOrderWizard from '@/components/schools/SchoolOrderWizard';
import PoStatusTrail from '@/components/schools/PoStatusTrail';

type Product = {
  id: number;
  name: string;
  brand_name: string;
  uom?: string | null;
  image_url?: string | null;
  province?: string | null;
  category?: string | null;
};

type Line = {
  approved_product_id: number;
  product_name: string;
  brand_name: string;
  qty: number;
  unit_price: number;
  uom: string;
  category?: string | null;
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
  const [role, setRole] = useState<'school' | 'isp'>('school');
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [menuProductIds, setMenuProductIds] = useState<number[]>([]);
  const [menuAgency, setMenuAgency] = useState<string | null>(null);
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([]);
  const [showForm, setShowForm] = useState(false);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('0');
  const [ispId, setIspId] = useState('');
  const [notes, setNotes] = useState('');
  /** Required for OTIF on-time — school must set consciously (no silent default) */
  const [expectedDate, setExpectedDate] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [brandPick, setBrandPick] = useState<{
    ok: boolean;
    missing?: Array<Record<string, unknown>>;
    multi_brand_lines?: number;
    message?: string;
    href?: string;
  } | null>(null);
  const minDeliveryDate = useMemo(() => {
    return new Date().toISOString().slice(0, 10);
  }, []);
  const [catalogueLabel, setCatalogueLabel] = useState(
    'department approved list'
  );
  const [hasAgency, setHasAgency] = useState(true);
  const [wizardMode, setWizardMode] = useState(true);
  const [busyPoId, setBusyPoId] = useState<number | null>(null);
  /** Draft PO send-to-SP panel */
  const [sendDraft, setSendDraft] = useState<Record<string, unknown> | null>(
    null
  );
  const [sendIspId, setSendIspId] = useState('');
  const [sendExpectedDate, setSendExpectedDate] = useState('');

  /** Open PO as PDF (browser viewer can print). download=true forces attachment. */
  const openPo = (orderId: number, opts?: { download?: boolean }) => {
    const params = new URLSearchParams({
      companyId: String(companyId),
      id: String(orderId),
      format: opts?.download ? 'download' : 'pdf',
    });
    window.open(
      `/api/schools/orders?${params}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [oRes, pRes, iRes, mRes] = await Promise.all([
        fetch(`/api/schools/orders?companyId=${companyId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        }),
        fetch(`/api/schools/approved?companyId=${companyId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        }),
        fetch(`/api/schools/isps?companyId=${companyId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        }),
        fetch(`/api/schools/menu?companyId=${companyId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        }),
      ]);
      const o = await oRes.json();
      const p = await pRes.json();
      const i = await iRes.json();
      const m = await mRes.json().catch(() => ({}));
      if (!oRes.ok) throw new Error(o.error || 'Failed');

      setRole(o.role === 'isp' ? 'isp' : 'school');
      setOrders(o.orders || []);
      setProducts(p.products || []);
      if (o.role !== 'isp' && o.brand_pick) {
        setBrandPick(o.brand_pick);
      } else {
        setBrandPick(null);
      }

      const ids = Array.isArray(m.weekly_approved_product_ids)
        ? m.weekly_approved_product_ids.map(Number).filter((n: number) => n > 0)
        : [];
      setMenuProductIds(ids);
      setMenuAgency(m.agencyName || m.mandated?.agency_name || null);

      if (o.role !== 'isp') {
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
      }
      if (p.catalogue?.agencyName) {
        setCatalogueLabel(`${p.catalogue.agencyName} approved foods`);
      } else if (p.agencyName) {
        setCatalogueLabel(`${p.agencyName} approved foods`);
      }
      setHasAgency(
        Boolean(
          p.catalogue?.agencyProfileId ||
            p.agencyProfileId ||
            p.catalogue?.agencyName ||
            p.agencyName
        )
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Kitchen stock suggested PO lines (sessionStorage from /schools/kitchen)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('suggested') !== '1') return;
      const raw = sessionStorage.getItem('nsnp_kitchen_suggested_po');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<{
        approved_product_id?: number;
        product_name?: string;
        brand_name?: string;
        qty?: number;
        uom?: string;
        unit_price?: number;
        category?: string;
      }>;
      if (!Array.isArray(parsed) || !parsed.length) return;
      const next: Line[] = parsed
        .filter((l) => Number(l.approved_product_id) > 0 && Number(l.qty) > 0)
        .map((l) => ({
          approved_product_id: Number(l.approved_product_id),
          product_name: String(l.product_name || 'Product'),
          brand_name: String(l.brand_name || ''),
          qty: Number(l.qty),
          unit_price: Number(l.unit_price) || 0,
          uom: String(l.uom || 'kg'),
          category: l.category != null ? String(l.category) : null,
        }));
      if (!next.length) return;
      setLines(next);
      setShowForm(true);
      setWizardMode(true);
      sessionStorage.removeItem('nsnp_kitchen_suggested_po');
      toast.success(
        `Loaded ${next.length} line(s) from kitchen cover — complete the order wizard (qty → SP → date → send)`
      );
      // clean query param without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('suggested');
      window.history.replaceState({}, '', url.pathname + url.search);
    } catch {
      /* soft */
    }
  }, []);

  const spAcceptPo = async (poId: number) => {
    setBusyPoId(poId);
    try {
      const res = await fetch('/api/schools/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          id: poId,
          action: 'accept',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Accept failed');
      toast.success(data.message || 'PO accepted — create DN next');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyPoId(null);
    }
  };

  /** Hard-delete draft PO that has not been sent to the SP */
  const deleteDraftPo = async (po: Record<string, unknown>) => {
    const poId = Number(po.id);
    const label = String(po.po_number || `PO #${poId}`);
    if (
      !confirm(
        `Delete ${label}?\n\nOnly draft orders that have not been sent to the service provider can be deleted. This cannot be undone.`
      )
    ) {
      return;
    }
    setBusyPoId(poId);
    try {
      const res = await fetch(
        `/api/schools/orders?companyId=${companyId}&id=${poId}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success(data.message || `Deleted ${label}`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusyPoId(null);
    }
  };

  const openSendDraft = (po: Record<string, unknown>) => {
    const existingIsp = po.isp_profile_id != null ? String(po.isp_profile_id) : '';
    const linked =
      existingIsp &&
      links.some((l) => String(l.isp_profile_id) === existingIsp)
        ? existingIsp
        : links[0]?.isp_profile_id != null
          ? String(links[0].isp_profile_id)
          : '';
    const exp =
      po.expected_date != null
        ? String(po.expected_date).slice(0, 10)
        : '';
    setSendIspId(linked);
    setSendExpectedDate(exp && exp >= minDeliveryDate ? exp : '');
    setSendDraft(po);
  };

  /** Submit a kitchen/manual draft PO to the linked SP */
  const sendDraftToSp = async () => {
    if (!sendDraft) return;
    const poId = Number(sendDraft.id);
    if (!sendIspId) {
      return toast.error('Select a service provider');
    }
    if (!sendExpectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(sendExpectedDate)) {
      return toast.error('Set the required delivery date');
    }
    if (sendExpectedDate < minDeliveryDate) {
      return toast.error('Delivery date cannot be in the past');
    }
    setBusyPoId(poId);
    try {
      const res = await fetch('/api/schools/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          id: poId,
          action: 'send_to_sp',
          isp_profile_id: Number(sendIspId),
          expected_date: sendExpectedDate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Send failed');
      toast.success(data.message || 'PO sent to SP');
      setSendDraft(null);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setBusyPoId(null);
    }
  };

  const menuProducts = useMemo(() => {
    if (!menuProductIds.length) return [] as Product[];
    const set = new Set(menuProductIds);
    return products.filter((p) => set.has(p.id));
  }, [products, menuProductIds]);

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
    setLines((prev) => {
      const existing = prev.find((l) => l.approved_product_id === prod.id);
      if (existing) {
        return prev.map((l) =>
          l.approved_product_id === prod.id
            ? { ...l, qty: l.qty + q, unit_price: Number(price) || l.unit_price }
            : l
        );
      }
      return [
        ...prev,
        {
          approved_product_id: prod.id,
          product_name: prod.name,
          brand_name: prod.brand_name,
          qty: q,
          unit_price: Number(price) || 0,
          uom: prod.uom || 'kg',
        },
      ];
    });
    setProductId('');
    setQty('1');
    setPrice('0');
  };

  const addMenuWeek = () => {
    if (!menuProducts.length) {
      return toast.error(
        'No DBE menu products yet — department must publish the mandated menu from the catalogue'
      );
    }
    setLines((prev) => {
      const map = new Map(prev.map((l) => [l.approved_product_id, l]));
      for (const prod of menuProducts) {
        if (!map.has(prod.id)) {
          map.set(prod.id, {
            approved_product_id: prod.id,
            product_name: prod.name,
            brand_name: prod.brand_name,
            qty: 1,
            unit_price: 0,
            uom: prod.uom || 'kg',
          });
        }
      }
      return Array.from(map.values());
    });
    setShowForm(true);
    toast.success(
      `Added ${menuProducts.length} product(s) from the DBE weekly menu — set quantities and pick your SP`
    );
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!lines.length) return toast.error('Add approved product lines first');
    // Brand picks: server auto-applies from products on this PO (kitchen
    // suggested lines already choose a brand). Soft-warn only if still blocked.
    if (!ispId) {
      return toast.error(
        'Select a service provider (preferred SPs listed first)'
      );
    }
    if (!expectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)) {
      return toast.error(
        'Set the required delivery date — used for SP on-time (OTIF) scoring'
      );
    }
    if (expectedDate < minDeliveryDate) {
      return toast.error(
        'Delivery date cannot be in the past — pick today or a future date'
      );
    }
    if (lines.some((l) => !l.approved_product_id)) {
      return toast.error(
        'Off-catalogue lines blocked — remove them before submit'
      );
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
          expected_date: expectedDate,
          notes:
            notes.trim() ||
            'SP to source from wholesalers and deliver approved catalogue products to school by the required delivery date.',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.brand_pick_gate) {
          setBrandPick({
            ok: false,
            missing: data.missing_brand_picks,
            multi_brand_lines: data.multi_brand_lines,
            message: data.error,
            href: data.href,
          });
        }
        const detail = Array.isArray(data.rejected)
          ? ` ${data.rejected.slice(0, 2).join('; ')}`
          : '';
        throw new Error(`${data.error || 'PO rejected'}${detail}`);
      }
      toast.success(
        `PO ${data.order?.po_number} sent to SP — they will source from wholesalers and deliver`
      );
      setLines([]);
      setNotes('');
      setShowForm(false);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── SP order inbox ────────────────────────────────────────────────
  if (role === 'isp') {
    return (
      <SchoolsPage>
        <SchoolsHeader
          title="School orders"
          titleAccent="SP inbox"
          description="Schools order DBE-approved products from you. Source from wholesalers, create a delivery note, dispatch with POD — school receives into kitchen."
          mode="isp"
          action={
            <div className="flex gap-2">
              <Link
                href="/dashboard/schools/sp-orders-report"
                className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                Schools report
              </Link>
              <Link
                href="/dashboard/schools/ops"
                className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <Package className="w-3.5 h-3.5" /> Fulfil queue
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

        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 flex gap-2">
          <Truck className="w-5 h-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-black text-xs uppercase tracking-wide">
              Wholesale supply model
            </p>
            <p className="text-[13px] mt-0.5">
              School PO → you procure → deliver (DN + POD) → school GRN. When received, the
              action shows <strong>Fulfilled</strong> with that order&apos;s
              OTIFEF and the school&apos;s rating of you.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
            No school orders yet. When schools submit POs to you, they appear
            here and on the fulfil queue.
          </div>
        ) : (
          <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 overflow-hidden">
            <table className="w-full text-sm min-w-[960px]">
              <thead>
                <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                  <th className="px-4 py-3">PO</th>
                  <th className="px-3 py-3">School</th>
                  <th className="px-3 py-3">Order date</th>
                  <th className="px-3 py-3">Required delivery</th>
                  <th className="px-3 py-3">OTIF risk</th>
                  <th className="px-3 py-3">Lines</th>
                  <th className="px-3 py-3">Total</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">OTIFEF</th>
                  <th className="px-3 py-3">Rating</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const lineCount = Array.isArray(o.lines)
                    ? (o.lines as unknown[]).length
                    : 0;
                  const req = o.expected_date
                    ? String(o.expected_date).slice(0, 10)
                    : '—';
                  const today = new Date().toISOString().slice(0, 10);
                  const status = String(o.status || '').toLowerCase();
                  const fulfilled = Boolean(
                    o.fulfilled ??
                      ['received', 'partially_received', 'closed', 'complete'].includes(
                        status
                      )
                  );
                  const late =
                    req !== '—' &&
                    req < today &&
                    !fulfilled &&
                    !['cancelled'].includes(status);
                  const otifRisk = String(o.otif_risk || (late ? 'late' : ''));
                  const otifRiskLabel = String(
                    o.otif_risk_label ||
                      (late
                        ? 'Late'
                        : o.days_to_required != null
                          ? `${o.days_to_required}d left`
                          : '')
                  );
                  const riskClass =
                    otifRisk === 'late'
                      ? 'text-rose-700 bg-rose-100'
                      : otifRisk === 'at_risk'
                        ? 'text-orange-800 bg-orange-100'
                        : otifRisk === 'due_soon'
                          ? 'text-amber-800 bg-amber-100'
                          : otifRisk === 'on_track'
                            ? 'text-emerald-800 bg-emerald-100'
                            : otifRisk === 'done'
                              ? 'text-slate-600 bg-slate-100'
                              : 'text-slate-500 bg-slate-50';
                  const otifef =
                    o.order_otifef_pct != null
                      ? Number(o.order_otifef_pct)
                      : fulfilled && o.sp_otifef_pct != null
                        ? Number(o.sp_otifef_pct)
                        : null;
                  const rating =
                    o.school_rating != null
                      ? Number(o.school_rating)
                      : fulfilled && o.sp_avg_rating != null
                        ? Number(o.sp_avg_rating)
                        : null;
                  return (
                    <tr
                      key={String(o.id)}
                      className={`border-b border-slate-50 ${
                        fulfilled
                          ? 'bg-emerald-50/40'
                          : late
                            ? 'bg-rose-50/50'
                            : 'hover:bg-amber-50/40'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-bold">
                        <button
                          type="button"
                          onClick={() => openPo(Number(o.id))}
                          className="text-left hover:text-[#0077b6] hover:underline"
                        >
                          {String(o.po_number || o.id)}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        {String(o.school_name || o.school_profile_id)}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {String(o.order_date || '—').slice(0, 10)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-xs font-black ${
                            late ? 'text-rose-700' : ''
                          }`}
                        >
                          {req}
                        </span>
                        {late ? (
                          <span className="block text-[9px] font-bold uppercase text-rose-600">
                            Late
                          </span>
                        ) : null}
                        {o.received_at ? (
                          <span className="block text-[9px] text-emerald-700 font-bold">
                            Received {String(o.received_at).slice(0, 10)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        {otifRiskLabel ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${riskClass}`}
                          >
                            {otifRiskLabel}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{lineCount}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatMoney(Number(o.total_amount || 0))}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                            fulfilled
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          {fulfilled ? 'received' : String(o.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {fulfilled || otifef != null ? (
                          <div>
                            <span className="font-black tabular-nums text-sky-900">
                              {otifef != null ? `${otifef}%` : '—'}
                            </span>
                            {fulfilled ? (
                              <span className="block text-[9px] text-slate-500 leading-tight mt-0.5">
                                {o.order_on_time === true
                                  ? 'On-time'
                                  : o.order_on_time === false
                                    ? 'Late'
                                    : 'OT'}
                                {' · '}
                                {o.order_in_full === true
                                  ? 'In-full'
                                  : o.order_in_full === false
                                    ? 'Short'
                                    : 'IF'}
                                {' · '}
                                {o.order_error_free === true
                                  ? 'Error-free'
                                  : o.order_error_free === false
                                    ? 'Issues'
                                    : 'EF'}
                              </span>
                            ) : o.sp_otifef_pct != null ? (
                              <span className="block text-[9px] text-slate-400">
                                SP avg
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {rating != null ? (
                          <span className="inline-flex items-center gap-0.5 font-black text-amber-700 tabular-nums">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {rating.toFixed(1)}
                          </span>
                        ) : fulfilled ? (
                          <span className="text-[10px] text-slate-400">
                            Awaiting school
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex flex-col items-end gap-0.5">
                          {fulfilled ? (
                            <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-full px-2.5 py-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Fulfilled
                            </span>
                          ) : (
                            <>
                              {['submitted', 'draft'].includes(status) ? (
                                <button
                                  type="button"
                                  disabled={busyPoId === Number(o.id)}
                                  onClick={() => void spAcceptPo(Number(o.id))}
                                  className="text-xs font-bold text-white bg-[#0077b6] rounded-full px-2.5 py-1 hover:bg-[#0096c7] disabled:opacity-50"
                                >
                                  {busyPoId === Number(o.id)
                                    ? '…'
                                    : 'Accept PO'}
                                </button>
                              ) : null}
                              <Link
                                href="/dashboard/schools/deliveries"
                                className="text-xs font-bold text-amber-900 bg-amber-100 border border-amber-200 rounded-full px-2.5 py-1 hover:bg-amber-200 inline-flex items-center gap-1"
                              >
                                Create DN <ArrowRight className="w-3 h-3" />
                              </Link>
                              <Link
                                href="/dashboard/schools/ops"
                                className="text-[10px] font-bold text-slate-600 hover:underline"
                              >
                                Fulfil queue
                              </Link>
                            </>
                          )}
                          <div className="w-full max-w-[11rem] mt-1">
                            <PoStatusTrail
                              status={String(o.status)}
                              metadata={
                                o.metadata && typeof o.metadata === 'object'
                                  ? (o.metadata as Record<string, unknown>)
                                  : null
                              }
                              compact
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => openPo(Number(o.id))}
                            className="text-[10px] font-bold text-[#0077b6] hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Open PDF
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openPo(Number(o.id), { download: true })
                            }
                            className="text-[10px] font-bold text-slate-600 hover:underline inline-flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" /> Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SchoolsPage>
    );
  }

  // ── School order form ─────────────────────────────────────────────
  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Kitchen orders"
        titleAccent="To your SP"
        description="Order DBE-approved products from your linked service provider. They source from wholesalers and deliver to the school — only catalogue brands allowed."
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

      {brandPick && brandPick.ok === false ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-black text-xs uppercase tracking-wide text-amber-900">
            Optional: set default brands on recipes
          </p>
          <p className="mt-1 text-[13px]">
            Some multi-brand recipe lines still need a preferred brand. You can
            still raise a PO from kitchen with specific brand products — those
            brands are applied automatically to matching recipe lines.
          </p>
          {Array.isArray(brandPick.missing) && brandPick.missing.length > 0 ? (
            <ul className="mt-2 text-xs space-y-0.5 list-disc pl-4">
              {brandPick.missing.slice(0, 6).map((m) => (
                <li key={String(m.recipe_line_id)}>
                  {String(m.recipe_name)} · {String(m.product_name)}
                  {m.category ? ` (${String(m.category)})` : ''} —{' '}
                  {Number(m.option_count)} options
                </li>
              ))}
              {brandPick.missing.length > 6 ? (
                <li>+{brandPick.missing.length - 6} more</li>
              ) : null}
            </ul>
          ) : null}
          <Link
            href={brandPick.href || '/dashboard/schools/recipes'}
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-950 underline"
          >
            Open recipes · set defaults <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : brandPick && brandPick.ok && (brandPick.multi_brand_lines || 0) > 0 ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-2 text-xs text-emerald-900 font-semibold">
          Brand picks complete ({brandPick.multi_brand_lines} multi-brand
          line(s)) — ready to order.
        </div>
      ) : null}

      <div className="mb-4 grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950 flex gap-2">
          <ShoppingCart className="w-5 h-5 shrink-0 text-sky-700" />
          <div>
            <p className="font-black text-xs uppercase tracking-wide">
              1 · School orders
            </p>
            <p className="text-[13px] mt-0.5">
              Pick products from the DBE approved catalogue (and mandated menu)
              and send a PO to your linked SP.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 flex gap-2">
          <Truck className="w-5 h-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-black text-xs uppercase tracking-wide">
              2 · SP sources &amp; delivers
            </p>
            <p className="text-[13px] mt-0.5">
              SP receives the PO, buys from wholesalers, creates a DN and
              delivers with photo POD.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950 flex gap-2">
          <Utensils className="w-5 h-5 shrink-0 text-emerald-700" />
          <div>
            <p className="font-black text-xs uppercase tracking-wide">
              3 · School feeds
            </p>
            <p className="text-[13px] mt-0.5">
              You receive into kitchen GRN, follow the DBE menu, log serve day —
              prizes &amp; claims stay clean.
            </p>
          </div>
        </div>
      </div>

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
        <div className="rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-violet-950 flex gap-2">
          <Utensils className="w-5 h-5 shrink-0 text-violet-700" />
          <div>
            <p className="font-black text-xs uppercase tracking-wide">
              DBE menu → school
            </p>
            <p className="text-[13px] mt-0.5">
              {menuAgency
                ? `${menuAgency} sets the mandated menu from the catalogue — it shows on Schools → Menu and drives this shopping list.`
                : 'When DBE publishes the programme menu from the catalogue, those products appear here for one-click add.'}{' '}
              <Link
                href="/dashboard/schools/menu"
                className="font-bold underline"
              >
                View menu
              </Link>
            </p>
          </div>
        </div>
      </div>

      {showForm ? (
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWizardMode(true)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold border ${
                wizardMode
                  ? 'bg-[#0077b6] text-white border-[#0077b6]'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Guided wizard
            </button>
            <button
              type="button"
              onClick={() => setWizardMode(false)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold border ${
                !wizardMode
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Classic form
            </button>
          </div>

          {wizardMode ? (
            <SchoolOrderWizard
              companyId={companyId}
              lines={lines}
              onLinesChange={setLines}
              links={links.map((l) => ({
                isp_profile_id: Number(l.isp_profile_id),
                display_name: String(
                  l.display_name || l.isp_name || `SP #${l.isp_profile_id}`
                ),
                preferred: Boolean(l.preferred),
                status: String(l.status || ''),
              }))}
              ispId={ispId}
              onIspIdChange={setIspId}
              expectedDate={expectedDate}
              onExpectedDateChange={setExpectedDate}
              notes={notes}
              onNotesChange={setNotes}
              minDeliveryDate={minDeliveryDate}
              catalogueLabel={catalogueLabel}
              hasAgency={hasAgency}
              brandPickOk={brandPick == null ? null : brandPick.ok}
              submitting={submitting}
              onSubmit={async () => {
                await submit();
              }}
              onCancel={() => setShowForm(false)}
            />
          ) : null}

          {!wizardMode ? (
        <div className="rounded-3xl border border-sky-100 bg-sky-50/40 p-5 space-y-3">
          {menuProducts.length > 0 ? (
            <button
              type="button"
              onClick={addMenuWeek}
              className="w-full sm:w-auto btn-secondary !py-2.5 !px-4 text-xs inline-flex items-center gap-2"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Add this week&apos;s menu products ({menuProducts.length})
            </button>
          ) : (
            <p className="text-xs text-slate-500">
              No mandated menu products yet — DBE must publish breakfast + lunch
              from the approved catalogue under{' '}
              <Link
                href="/dashboard/schools/menu"
                className="font-bold text-[#0077b6] underline"
              >
                Menu
              </Link>
              .
            </p>
          )}

          {(() => {
            const selected = products.find((p) => String(p.id) === productId);
            if (!selected) return null;
            if (!selected.image_url && !selected.province) return null;
            return (
              <div className="flex items-center gap-3 rounded-2xl border border-white bg-white/80 px-3 py-2">
                {selected.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.image_url}
                    alt={selected.name}
                    className="sa-product-photo w-14 h-14 rounded-xl object-contain bg-[#f8f7f5] border border-slate-100"
                  />
                ) : null}
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">
                    {selected.brand_name} — {selected.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {selected.province
                      ? `Supplier province: ${selected.province}`
                      : 'Approved catalogue (DBE)'}
                  </div>
                </div>
              </div>
            );
          })()}
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
                  {p.province ? ` · ${p.province}` : ''}
                  {menuProductIds.includes(p.id) ? ' · on menu' : ''}
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
              placeholder="Unit price (est.)"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="block text-xs">
              <span className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Service provider *
              </span>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={ispId}
                onChange={(e) => setIspId(e.target.value)}
                required
              >
                <option value="">Select SP…</option>
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
            </label>
            <label className="block text-xs">
              <span className="block text-[10px] font-bold uppercase text-sky-800 mb-1">
                Required delivery date * · OTIF on-time
              </span>
              <input
                type="date"
                className={`w-full rounded-xl border px-3 py-2 text-sm font-bold ${
                  expectedDate
                    ? 'border-sky-300 bg-sky-50/50'
                    : 'border-amber-300 bg-amber-50 ring-1 ring-amber-200'
                }`}
                value={expectedDate}
                min={minDeliveryDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                required
              />
            </label>
          </div>
          <p
            className={`text-[11px] -mt-1 ${
              expectedDate ? 'text-slate-500' : 'text-amber-800 font-semibold'
            }`}
          >
            {expectedDate
              ? 'SP must deliver by this date — used for On-Time in OTIFEF scoring.'
              : 'Pick a delivery date (today or later). Without it the PO cannot be sent — On-Time metric needs this.'}
          </p>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes for SP (e.g. delivery gate, preferred pack sizes)…"
          />
          <div className="flex flex-wrap gap-2 items-center">
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
              disabled={
                submitting ||
                !lines.length ||
                !ispId ||
                !expectedDate
              }
              className="btn-primary !py-2 !px-3 text-xs disabled:opacity-40"
              title={
                !expectedDate
                  ? 'Set required delivery date first (OTIF on-time)'
                  : undefined
              }
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                'Send PO to SP'
              )}
            </button>
          </div>
          {links.length === 0 ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              No active SP links. Accept an SP claim or link a
              department-approved SP under{' '}
              <Link
                href="/dashboard/schools/isps"
                className="font-bold underline"
              >
                SPs
              </Link>
              .
            </p>
          ) : null}
          {lines.length > 0 ? (
            <ul className="text-xs space-y-1.5">
              {lines.map((l, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white border border-slate-100 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="font-bold text-emerald-800">
                      {l.brand_name}
                    </span>{' '}
                    · {l.product_name}
                    <span className="text-slate-400"> · {l.uom}</span>
                    {l.unit_price > 0 ? (
                      <span className="text-slate-500">
                        {' '}
                        @ {formatMoney(l.unit_price)}
                      </span>
                    ) : null}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 inline-flex items-center justify-center hover:bg-white"
                      title="Decrease quantity"
                      onClick={() =>
                        setLines((prev) =>
                          prev.map((row, idx) =>
                            idx === i
                              ? {
                                  ...row,
                                  qty: Math.max(1, Math.round(row.qty) - 1),
                                }
                              : row
                          )
                        )
                      }
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      className="w-16 rounded-lg border border-sky-200 bg-sky-50/40 px-2 py-1.5 text-sm font-black tabular-nums text-center"
                      value={l.qty}
                      title="Adjust quantity for school requirements"
                      onChange={(e) => {
                        const v = e.target.value;
                        setLines((prev) =>
                          prev.map((row, idx) =>
                            idx === i
                              ? {
                                  ...row,
                                  qty: Math.max(0, Number(v) || 0),
                                }
                              : row
                          )
                        );
                      }}
                      onBlur={() =>
                        setLines((prev) =>
                          prev.map((row, idx) =>
                            idx === i
                              ? {
                                  ...row,
                                  qty: Math.max(1, Math.round(Number(row.qty) || 1)),
                                }
                              : row
                          )
                        )
                      }
                    />
                    <button
                      type="button"
                      className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 inline-flex items-center justify-center hover:bg-white"
                      title="Increase quantity"
                      onClick={() =>
                        setLines((prev) =>
                          prev.map((row, idx) =>
                            idx === i
                              ? {
                                  ...row,
                                  qty: Math.max(1, Math.round(row.qty) + 1),
                                }
                              : row
                          )
                        )
                      }
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="text-[10px] font-bold text-rose-600 ml-1"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="font-bold text-slate-800">No orders yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Create a PO from the approved catalogue. Your SP will receive it,
            buy from wholesalers, and deliver to school.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary !py-2.5 !px-4 text-sm mt-4"
          >
            New PO
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 overflow-hidden">
          <table className="w-full text-sm min-w-[880px]">
            <thead>
              <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">PO</th>
                <th className="px-3 py-3">Order date</th>
                <th className="px-3 py-3">Required delivery</th>
                <th className="px-3 py-3">SP</th>
                <th className="px-3 py-3">Lines</th>
                <th className="px-3 py-3">Total</th>
                <th className="px-3 py-3">Status / trail</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const lineCount = Array.isArray(o.lines)
                  ? (o.lines as unknown[]).length
                  : 0;
                const status = String(o.status || '').toLowerCase();
                const isDraft =
                  role === 'school' &&
                  (status === 'draft' || status === '');
                const canDeleteDraft = isDraft;
                const canSendDraft = isDraft;
                const spName =
                  o.isp_name ||
                  links.find(
                    (l) =>
                      Number(l.isp_profile_id) === Number(o.isp_profile_id)
                  )?.display_name ||
                  o.isp_profile_id;
                return (
                  <tr
                    key={String(o.id)}
                    className="border-b border-slate-50 hover:bg-sky-50/40"
                  >
                    <td className="px-4 py-2.5 font-bold">
                      <button
                        type="button"
                        onClick={() => openPo(Number(o.id))}
                        className="text-left hover:text-[#0077b6] hover:underline"
                        title="Open PO PDF"
                      >
                        {String(o.po_number || o.id)}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {String(o.order_date || '—').slice(0, 10)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold">
                      {o.expected_date
                        ? String(o.expected_date).slice(0, 10)
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs">{String(spName)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{lineCount}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatMoney(Number(o.total_amount || 0))}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${
                          canDeleteDraft
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {String(o.status)}
                      </span>
                      <div className="mt-1.5 max-w-[14rem]">
                        <PoStatusTrail
                          status={String(o.status)}
                          metadata={
                            o.metadata && typeof o.metadata === 'object'
                              ? (o.metadata as Record<string, unknown>)
                              : null
                          }
                          compact
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1">
                        {canSendDraft ? (
                          <button
                            type="button"
                            disabled={busyPoId === Number(o.id)}
                            onClick={() => openSendDraft(o)}
                            className="text-[11px] font-bold text-white px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 inline-flex items-center gap-1 disabled:opacity-40"
                            title="Send this draft PO to your service provider"
                          >
                            {busyPoId === Number(o.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            Send to SP
                          </button>
                        ) : null}
                        {canDeleteDraft ? (
                          <button
                            type="button"
                            disabled={busyPoId === Number(o.id)}
                            onClick={() => void deleteDraftPo(o)}
                            className="text-[11px] font-bold text-rose-700 px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 inline-flex items-center gap-1 disabled:opacity-40"
                            title="Delete draft — not yet sent to SP"
                          >
                            {busyPoId === Number(o.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            Delete
                          </button>
                        ) : null}
                        <Link
                          href="/dashboard/schools/deliveries"
                          className="text-[11px] font-bold text-emerald-800 px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                        >
                          Track / GRN
                        </Link>
                        <button
                          type="button"
                          onClick={() => openPo(Number(o.id))}
                          className="text-[11px] font-bold text-[#0077b6] px-2 py-1 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Open PDF
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openPo(Number(o.id), { download: true })
                          }
                          className="text-[11px] font-bold text-slate-700 px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 inline-flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" /> Download
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
        <Link
          href="/dashboard/schools/approved-list"
          className="font-bold text-[#0077b6] underline"
        >
          Approved catalogue
        </Link>
        <Link
          href="/dashboard/schools/menu"
          className="font-bold text-[#0077b6] underline"
        >
          DBE menu
        </Link>
        <Link
          href="/dashboard/schools/isps"
          className="font-bold text-[#0077b6] underline"
        >
          Service providers
        </Link>
        <Link
          href="/dashboard/schools/deliveries"
          className="font-bold text-[#0077b6] underline"
        >
          Deliveries / receive
        </Link>
        <Link
          href="/dashboard/schools/kitchen"
          className="font-bold text-[#0077b6] underline"
        >
          Kitchen · suggested reorder
        </Link>
        <span className="inline-flex items-center gap-1 text-amber-800">
          <Trophy className="w-3 h-3" /> On-catalogue orders protect prize &amp;
          claims
        </span>
      </div>

      {/* Send draft kitchen/manual PO to SP */}
      {sendDraft && role === 'school' ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-3">
          <div
            className="w-full max-w-md rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 shadow-xl p-5 space-y-4"
            role="dialog"
            aria-labelledby="send-po-title"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p
                  id="send-po-title"
                  className="text-sm font-black text-slate-900"
                >
                  Send PO to service provider
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {String(sendDraft.po_number || `PO #${sendDraft.id}`)} ·{' '}
                  {Array.isArray(sendDraft.lines)
                    ? (sendDraft.lines as unknown[]).length
                    : 0}{' '}
                  line(s) · draft from kitchen / school
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSendDraft(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>
            {links.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                No active SP link. Accept or link a service provider first.{' '}
                <Link
                  href="/dashboard/schools/isps"
                  className="font-bold underline"
                >
                  SPs →
                </Link>
              </div>
            ) : (
              <label className="block text-xs">
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Service provider
                </span>
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                  value={sendIspId}
                  onChange={(e) => setSendIspId(e.target.value)}
                >
                  <option value="">Select SP…</option>
                  {links.map((l) => (
                    <option
                      key={String(l.isp_profile_id)}
                      value={String(l.isp_profile_id)}
                    >
                      {String(
                        l.display_name ||
                          l.trading_name ||
                          `SP #${l.isp_profile_id}`
                      )}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-xs">
              <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Required delivery date
              </span>
              <input
                type="date"
                min={minDeliveryDate}
                value={sendExpectedDate}
                onChange={(e) => setSendExpectedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold tabular-nums"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Used for SP On-Time (OTIFEF) scoring
              </span>
            </label>
            <div className="flex flex-wrap gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setSendDraft(null)}
                className="btn-secondary !py-2 !px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  busyPoId === Number(sendDraft.id) ||
                  !sendIspId ||
                  !sendExpectedDate ||
                  links.length === 0
                }
                onClick={() => void sendDraftToSp()}
                className="btn-primary !py-2 !px-4 text-xs inline-flex items-center gap-1 disabled:opacity-40"
              >
                {busyPoId === Number(sendDraft.id) ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Send to SP
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SchoolsPage>
  );
}
