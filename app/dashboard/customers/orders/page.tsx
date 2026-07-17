'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  Loader2,
  CheckCircle,
  DollarSign,
  XCircle,
  PackageCheck,
  Inbox,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import DocumentWorkspace from '@/components/customers/DocumentWorkspace';
import {
  CompanyRequired,
  CustomersHeader,
} from '@/components/customers/CustomersShell';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { SELLER_PO_TRANSITIONS } from '@/lib/procurement/types';

type Tab = 'sales' | 'inbound';

interface InboundPO {
  id: number;
  buyer_profile_id?: number | null;
  buyer_name?: string | null;
  supplier_id?: number | null;
  supplier_profile_id?: number | null;
  seller_customer_id?: number | null;
  total_amount?: number | null;
  subtotal?: number | null;
  status: string;
  description?: string | null;
  currency?: string | null;
  source?: string | null;
  promised_date?: string | null;
  payment_terms?: string | null;
  created_at?: string;
  items?: Array<{
    item_name?: string;
    name?: string;
    quantity?: number;
    unit_price?: number;
    uom?: string | null;
  }> | null;
  line_count?: number;
  metadata?: Record<string, unknown> | null;
}

const ACTION_LABELS: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle }
> = {
  accepted: {
    label: 'Accept',
    className: 'bg-blue-600 text-white hover:bg-blue-700',
    icon: CheckCircle,
  },
  paid: {
    label: 'Mark paid',
    className: 'bg-emerald-600 text-white hover:bg-emerald-700',
    icon: DollarSign,
  },
  completed: {
    label: 'Complete',
    className: 'bg-teal-600 text-white hover:bg-teal-700',
    icon: PackageCheck,
  },
  cancelled: {
    label: 'Decline',
    className: 'bg-red-600 text-white hover:bg-red-700',
    icon: XCircle,
  },
};

function money(n: number, currency = 'ZAR') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'ZAR',
      maximumFractionDigits: 2,
    }).format(n || 0);
  } catch {
    return `${currency} ${Number(n || 0).toLocaleString()}`;
  }
}

function OrdersTabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="flex gap-2 mb-4">
      <button
        type="button"
        onClick={() => setTab('sales')}
        className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
          tab === 'sales'
            ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
        }`}
      >
        Sales orders
      </button>
      <button
        type="button"
        onClick={() => setTab('inbound')}
        className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all inline-flex items-center gap-1.5 ${
          tab === 'inbound'
            ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
        }`}
      >
        <Inbox className="w-3.5 h-3.5" />
        Inbound POs
      </button>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <CompanyRequired>
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        }
      >
        <OrdersInner />
      </Suspense>
    </CompanyRequired>
  );
}

function OrdersInner() {
  const searchParams = useSearchParams();
  const initial =
    searchParams.get('tab') === 'inbound' ? 'inbound' : 'sales';
  const [tab, setTab] = useState<Tab>(initial);

  useEffect(() => {
    if (searchParams.get('tab') === 'inbound') setTab('inbound');
  }, [searchParams]);

  if (tab === 'sales') {
    return (
      <DocumentWorkspace
        type="order"
        beforeHeader={<OrdersTabs tab={tab} setTab={setTab} />}
      />
    );
  }

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <CustomersHeader
        title="Inbound"
        titleAccent="purchase orders"
        description="POs raised against your company from connected buyers. Accept, fulfil, mark paid, or decline — then the buyer can capture OTIFEF and rate you."
      />
      <OrdersTabs tab={tab} setTab={setTab} />
      <InboundPosList />
    </div>
  );
}

function InboundPosList() {
  const { user } = usePrivy();
  const companyId = getSelectedCompanyId()!;
  const privyUserId = getCanonicalUserId(user?.id);
  const searchParams = useSearchParams();
  const deepPoId = Number(searchParams.get('po') || 0) || null;
  const [pos, setPos] = useState<InboundPO[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    sent: 0,
    accepted: 0,
    open: 0,
    completed: 0,
    cancelled: 0,
  });
  const [filter, setFilter] = useState<
    'all' | 'sent' | 'accepted' | 'completed' | 'cancelled'
  >('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!privyUserId) {
      setLoading(false);
      setPos([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        privyUserId,
      });
      const res = await fetch(`/api/customers/purchase-orders?${params}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to load inbound POs');
        setPos([]);
        return;
      }
      setPos(json.purchaseOrders || []);
      if (json.counts) setCounts(json.counts);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Deep-link from notification: ?tab=inbound&po=123
  useEffect(() => {
    if (!deepPoId || loading || !pos.length) return;
    const hit = pos.find((p) => Number(p.id) === deepPoId);
    if (!hit) return;
    setExpanded(deepPoId);
    if (String(hit.status) === 'sent') setFilter('sent');
    // Scroll into view once
    const el = document.getElementById(`inbound-po-${deepPoId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [deepPoId, loading, pos]);

  const filtered = useMemo(() => {
    if (filter === 'all') return pos;
    if (filter === 'completed') {
      return pos.filter((p) =>
        ['completed', 'paid'].includes(String(p.status))
      );
    }
    return pos.filter((p) => String(p.status) === filter);
  }, [pos, filter]);

  const transition = async (poId: number, status: string) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    if (
      status === 'cancelled' &&
      !confirm(`Decline / cancel PO #${poId}? The buyer will see cancelled.`)
    ) {
      return;
    }
    setBusyId(poId);
    try {
      const res = await fetch('/api/customers/purchase-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id: poId,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Transition failed');
        return;
      }
      if (status === 'accepted') {
        toast.success(`PO #${poId} accepted — buyer notified`, {
          duration: 10000,
          action: {
            label: 'Invoice now',
            onClick: () => {
              void invoiceNow(poId);
            },
          },
        });
      } else {
        toast.success(`PO #${poId} → ${status}`);
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  /** One-click draft invoice from accepted PO lines */
  const invoiceNow = async (
    poId: number,
    buyerProfileId?: number | null
  ) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setBusyId(poId);
    toast.loading(`Creating invoice from PO #${poId}…`, { id: 'inv-now' });
    try {
      let res = await fetch('/api/customers/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          type: 'invoice',
          action: 'create_from_po',
          poId,
          buyerProfileId: buyerProfileId || undefined,
        }),
      });
      let data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'DUPLICATE_FROM_PO' && data.existing?.id) {
          toast.message('Invoice already exists', {
            id: 'inv-now',
            action: {
              label: 'Open',
              onClick: () => {
                window.location.href = `/dashboard/customers/invoices?fromPo=${poId}`;
              },
            },
          });
          return;
        }
        if (data.code === 'OVER_CREDIT_LIMIT') {
          const ok = window.confirm(
            `${data.error}\n\nOverride credit limit and create invoice?`
          );
          if (!ok) {
            toast.dismiss('inv-now');
            return;
          }
          res = await fetch('/api/customers/docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId,
              type: 'invoice',
              action: 'create_from_po',
              poId,
              buyerProfileId: buyerProfileId || undefined,
              acknowledgeCredit: true,
            }),
          });
          data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Failed');
        } else {
          throw new Error(data.error || 'Invoice failed');
        }
      }
      const invId = Number(data.document?.id || data.existing?.id || 0);
      toast.success(`Draft invoice created for PO #${poId}`, {
        id: 'inv-now',
        description: data.invoiceSharedToBuyer
          ? 'Shared with buyer'
          : 'Review and share when ready',
        duration: 14000,
        action: {
          label: invId > 0 ? 'Email PDF' : 'Open invoices',
          onClick: () => {
            if (invId > 0) {
              void emailInvoicePdf(invId, poId);
            } else {
              window.location.href = `/dashboard/customers/invoices?fromPo=${poId}`;
            }
          },
        },
      });
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed', { id: 'inv-now' });
    } finally {
      setBusyId(null);
    }
  };

  const emailInvoicePdf = async (invoiceId: number, poId: number) => {
    toast.loading('Emailing invoice PDF…', { id: 'inv-email' });
    try {
      const res = await fetch('/api/customers/docs/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          type: 'invoice',
          id: invoiceId,
          quiet: true,
          acknowledgeSoftWarnings: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Email failed');
      }
      toast.success(`Invoice emailed${data.to ? ` to ${data.to}` : ''}`, {
        id: 'inv-email',
        action: {
          label: 'Open',
          onClick: () => {
            window.location.href = `/dashboard/customers/invoices?fromPo=${poId}`;
          },
        },
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Email failed', {
        id: 'inv-email',
        description: 'Open invoices to email manually',
        action: {
          label: 'Open invoices',
          onClick: () => {
            window.location.href = `/dashboard/customers/invoices?fromPo=${poId}`;
          },
        },
      });
    }
  };

  const setFulfilment = async (
    poId: number,
    fulfilmentStatus: 'preparing' | 'ready' | 'shipped'
  ) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setBusyId(poId);
    try {
      const res = await fetch('/api/customers/purchase-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id: poId,
          fulfilmentStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Update failed');
        return;
      }
      toast.success(
        fulfilmentStatus === 'shipped'
          ? `PO #${poId} marked shipped — buyer can see the cue`
          : `PO #${poId} → ${fulfilmentStatus}`
      );
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#00b4d8]" />
            Inbound purchase orders
          </h2>
          <p className="text-sm text-neutral-500 max-w-xl">
            Integration loop: buyer raises PO from{' '}
            <strong>your catalogue</strong> → you accept here → deliver → they
            rate. Paid/completed unlocks reviews.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {counts.sent > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>{counts.sent}</strong> PO
            {counts.sent === 1 ? '' : 's'} awaiting accept
          </span>
          <button
            type="button"
            onClick={() => setFilter('sent')}
            className="text-xs font-bold text-amber-900 underline"
          >
            Show waiting
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { k: 'total', label: 'Total', n: counts.total },
          { k: 'sent', label: 'Awaiting', n: counts.sent },
          { k: 'open', label: 'In flight', n: counts.open },
          { k: 'completed', label: 'Done', n: counts.completed },
        ].map((c) => (
          <div
            key={c.k}
            className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {c.label}
            </div>
            <div className="text-lg font-black text-slate-900">{c.n}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {(
          [
            ['all', 'All'],
            ['sent', 'Awaiting accept'],
            ['accepted', 'Accepted'],
            ['completed', 'Completed'],
            ['cancelled', 'Declined'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition ${
              filter === k
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-sky-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">No inbound POs</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
            When a connected buyer raises a PO against your sellable products or
            price list, it appears here. Publish inventory as finished goods /
            services and share pricing agreements.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
            <Link
              href="/dashboard/inventory/products?type=finished_good"
              className="font-bold text-[#00b4d8] hover:underline"
            >
              Finished goods →
            </Link>
            <Link
              href="/dashboard/connections/pricing"
              className="font-bold text-slate-600 hover:underline"
            >
              Pricing agreements →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((po) => {
            const amount = Number(po.total_amount ?? po.subtotal ?? 0);
            const ccy = po.currency || 'ZAR';
            const allowed = SELLER_PO_TRANSITIONS[po.status] || [];
            const buyerLabel =
              po.buyer_name ||
              (po.buyer_profile_id
                ? `Buyer ${po.buyer_profile_id}`
                : 'Unknown buyer');
            const items = Array.isArray(po.items) ? po.items : [];
            const isOpen = expanded === po.id;
            const st = String(po.status || '').toLowerCase();
            const fulfilmentHint =
              st === 'sent'
                ? {
                    title: 'Next: Accept or decline',
                    body: 'Buyer is waiting. Accept to confirm supply; decline if you cannot fulfil.',
                  }
                : st === 'accepted'
                  ? {
                      title: 'Next: Fulfil the order',
                      body: 'Prepare / ship against promised date. Buyer will record delivery (OTIFEF) and may rate you.',
                    }
                  : st === 'funded'
                    ? {
                        title: 'Next: Escrow funded — ship',
                        body: 'Complete shipment so the buyer can confirm delivery and release funds.',
                      }
                    : st === 'completed' || st === 'paid'
                      ? {
                          title: 'Trade complete',
                          body: 'Buyer may leave a rating. Keep inventory and pricing current for the next PO.',
                        }
                      : null;
            return (
              <div
                id={`inbound-po-${po.id}`}
                key={po.id}
                className={`border rounded-2xl p-5 ${
                  deepPoId === po.id
                    ? 'border-[#00b4d8] ring-2 ring-[#00b4d8]/25 bg-sky-50/40'
                    : 'border-neutral-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-lg">
                      PO #{po.id} · {buyerLabel}
                    </div>
                    {po.description && (
                      <div className="text-sm text-neutral-600 mt-0.5">
                        {po.description}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-neutral-500">
                      <span className="capitalize px-2 py-0.5 rounded-full bg-neutral-100 font-semibold">
                        {po.status}
                      </span>
                      {po.source && (
                        <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                          {po.source}
                        </span>
                      )}
                      {po.promised_date && (
                        <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
                          Promise {po.promised_date}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-slate-50">
                        {po.line_count ?? items.length} line
                        {(po.line_count ?? items.length) === 1 ? '' : 's'}
                      </span>
                      {po.created_at && (
                        <span>{new Date(po.created_at).toLocaleString()}</span>
                      )}
                    </div>
                    {items.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(isOpen ? null : po.id)
                        }
                        className="mt-2 text-xs font-bold text-[#00b4d8] hover:underline"
                      >
                        {isOpen ? 'Hide lines' : 'Show lines'}
                      </button>
                    )}
                    {isOpen && items.length > 0 && (
                      <ul className="mt-2 text-sm text-slate-700 space-y-1 border-t border-slate-100 pt-2">
                        {items.map((line, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span className="truncate">
                              {line.item_name || line.name || 'Line'}
                              <span className="text-neutral-400">
                                {' '}
                                × {line.quantity ?? 1}{' '}
                                {line.uom || 'ea'}
                              </span>
                            </span>
                            <span className="shrink-0 font-medium tabular-nums">
                              {money(
                                Number(line.quantity || 0) *
                                  Number(line.unit_price || 0),
                                ccy
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {fulfilmentHint && (
                      <div
                        className={`mt-3 rounded-xl border px-3 py-2 text-[11px] leading-relaxed ${
                          st === 'sent'
                            ? 'border-amber-100 bg-amber-50/90 text-amber-950'
                            : st === 'accepted' || st === 'funded'
                              ? 'border-sky-100 bg-sky-50/90 text-sky-950'
                              : 'border-emerald-100 bg-emerald-50/80 text-emerald-950'
                        }`}
                      >
                        <span className="font-bold">{fulfilmentHint.title}</span>
                        {' — '}
                        {fulfilmentHint.body}
                        {(st === 'accepted' || st === 'funded') && (
                          <span className="block mt-1 space-x-2">
                            <Link
                              href={`/dashboard/customers/invoices?fromPo=${po.id}${
                                po.buyer_profile_id
                                  ? `&buyerProfileId=${po.buyer_profile_id}`
                                  : ''
                              }`}
                              className="font-bold underline text-emerald-800"
                            >
                              Create invoice from this PO
                            </Link>
                            <Link
                              href="/dashboard/inventory/products?type=finished_good"
                              className="font-bold underline"
                            >
                              Catalogue
                            </Link>
                            <Link
                              href="/dashboard/operations/outbound"
                              className="font-bold underline"
                            >
                              Outbound
                            </Link>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                    <div className="text-right sm:mr-2">
                      <div className="text-2xl font-bold text-[#00b4d8]">
                        {money(amount, ccy)}
                      </div>
                      {po.payment_terms && (
                        <div className="text-[10px] text-neutral-400">
                          {po.payment_terms}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/* Deep-link from notifications: big Accept/Decline when awaiting */}
                      {deepPoId === po.id && st === 'sent' && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === po.id}
                            onClick={() => void transition(po.id, 'accepted')}
                            className="px-5 py-2.5 rounded-2xl text-sm font-bold bg-emerald-600 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                          >
                            {busyId === po.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Accept PO
                          </button>
                          <button
                            type="button"
                            disabled={busyId === po.id}
                            onClick={() => void transition(po.id, 'cancelled')}
                            className="px-4 py-2.5 rounded-2xl text-sm font-bold border border-red-200 bg-white text-red-600 flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" /> Decline
                          </button>
                        </>
                      )}
                      {allowed.map((next) => {
                        if (
                          deepPoId === po.id &&
                          st === 'sent' &&
                          (next === 'accepted' || next === 'cancelled')
                        ) {
                          return null; // already shown as primary actions
                        }
                        const cfg = ACTION_LABELS[next] || {
                          label: next,
                          className: 'bg-neutral-700 text-white',
                          icon: CheckCircle,
                        };
                        const Icon = cfg.icon;
                        return (
                          <button
                            key={next}
                            type="button"
                            disabled={busyId === po.id}
                            onClick={() => void transition(po.id, next)}
                            className={`px-4 py-2 rounded-2xl text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 touch-manipulation ${cfg.className}`}
                          >
                            {busyId === po.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Icon className="w-3.5 h-3.5" />
                            )}
                            {cfg.label}
                          </button>
                        );
                      })}
                      {['accepted', 'funded', 'paid', 'open', 'confirmed'].includes(st) && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === po.id}
                            onClick={() => void invoiceNow(po.id, po.buyer_profile_id)}
                            className="px-4 py-2 rounded-2xl text-sm font-bold bg-[#00b4d8] text-white inline-flex items-center gap-1.5 hover:bg-[#0096c7] disabled:opacity-50"
                            title="Create draft invoice from PO lines in one click"
                          >
                            {busyId === po.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : null}
                            Invoice now
                          </button>
                          <Link
                            href={`/dashboard/customers/invoices?fromPo=${po.id}${
                              po.buyer_profile_id
                                ? `&buyerProfileId=${po.buyer_profile_id}`
                                : ''
                            }`}
                            className="px-3 py-2 rounded-2xl text-xs font-bold border border-sky-200 bg-white text-sky-900 inline-flex items-center gap-1.5 hover:bg-sky-50"
                          >
                            Review form
                          </Link>
                          <button
                            type="button"
                            disabled={busyId === po.id}
                            onClick={() => void setFulfilment(po.id, 'preparing')}
                            className="px-3 py-2 rounded-2xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Preparing
                          </button>
                          <button
                            type="button"
                            disabled={busyId === po.id}
                            onClick={() => void setFulfilment(po.id, 'shipped')}
                            className="px-3 py-2 rounded-2xl text-xs font-bold border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 disabled:opacity-50"
                          >
                            Mark shipped
                          </button>
                        </>
                      )}
                      {po.metadata &&
                        typeof po.metadata === 'object' &&
                        (po.metadata as { fulfilment_status?: string })
                          .fulfilment_status && (
                          <span className="text-[10px] font-bold uppercase self-center px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                            {
                              (po.metadata as { fulfilment_status?: string })
                                .fulfilment_status
                            }
                          </span>
                        )}
                      {allowed.length === 0 &&
                        !['accepted', 'funded', 'paid'].includes(st) && (
                          <span className="text-xs text-neutral-400 self-center">
                            No actions
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
