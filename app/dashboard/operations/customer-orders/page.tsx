'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpFromLine,
  ExternalLink,
  Loader2,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  EmptyMission,
  OperationsHeader,
  OperationsPage,
  StatusPill,
  TelemetryCard,
  WorkbenchLink,
} from '@/components/operations/OperationsShell';

type Po = {
  id: number;
  po_number?: string | null;
  status?: string;
  total?: number | null;
  currency?: string | null;
  buyer_name?: string | null;
  created_at?: string | null;
};

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  sent: 'bg-sky-50 text-sky-800 border-sky-200',
  accepted: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  funded: 'bg-violet-50 text-violet-800 border-violet-200',
  shipped: 'bg-amber-50 text-amber-900 border-amber-200',
  completed: 'bg-cyan-50 text-cyan-900 border-cyan-200',
  paid: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  cancelled: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

export default function CustomerOrdersOpsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [pos, setPos] = useState<Po[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) qs.set('privyUserId', privyUserId);
      const res = await fetch(`/api/customers/purchase-orders?${qs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not load customer orders');
        setPos([]);
      } else {
        setPos(data.purchaseOrders || []);
      }
    } catch {
      setError('Network error');
      setPos([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = pos.filter((p) =>
    ['sent', 'accepted', 'funded', 'in_transit', 'partial', 'open', 'confirmed', 'shipped'].includes(
      String(p.status)
    )
  ).length;

  return (
    <OperationsPage>
      <OperationsHeader
        title="Customer"
        titleAccent="fulfillment"
        description="Orders you fulfill as the seller — accept, allocate, ship, and close. The demand signal for outbound and production."
        action={
          <Link
            href="/dashboard/customers/orders"
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            CRM orders workspace
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard
          label="Customer POs"
          value={pos.length}
          accent="rose"
          icon={ShoppingCart}
        />
        <TelemetryCard label="Open" value={open} accent="amber" />
        <TelemetryCard
          label="Complete"
          value={pos.filter((p) => ['completed', 'paid'].includes(String(p.status))).length}
          accent="emerald"
        />
        <TelemetryCard
          label="Need ship"
          value={pos.filter((p) =>
            ['accepted', 'funded', 'confirmed'].includes(String(p.status))
          ).length}
          accent="cyan"
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <WorkbenchLink
          href="/dashboard/customers/orders"
          icon={ShoppingCart}
          title="Orders workspace"
          desc="Full CRM order lifecycle and documents."
        />
        <WorkbenchLink
          href="/dashboard/operations/outbound"
          icon={ArrowUpFromLine}
          title="Dispatch outbound"
          desc="Turn accepted orders into tracked shipments."
        />
        <WorkbenchLink
          href="/dashboard/customers"
          icon={Users}
          title="Customer hub"
          desc="Profiles, quotes, invoices, loyalty."
        />
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : error ? (
        <EmptyMission
          title="Customer orders unavailable"
          body={error}
          action={
            <Link href="/dashboard/customers/orders" className="btn-primary !py-2.5 !px-6 text-sm">
              Open CRM orders
            </Link>
          }
        />
      ) : pos.length === 0 ? (
        <EmptyMission
          title="No customer orders yet"
          body="When buyers raise POs against you, they appear here for fulfillment — accept, ship, and close."
          action={
            <Link href="/dashboard/customers" className="btn-primary !py-2.5 !px-6 text-sm">
              Open customers
            </Link>
          }
        />
      ) : (
        <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-slate-50/80 text-left text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pos.slice(0, 40).map((p) => (
                  <tr key={p.id} className="border-b border-neutral-50 hover:bg-rose-50/20">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#0077b6]">
                      {p.po_number || `#${p.id}`}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        label={String(p.status || '—')}
                        className={
                          STATUS_TONE[String(p.status)] ||
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {p.total != null
                        ? `${p.currency || ''} ${Number(p.total).toLocaleString()}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href="/dashboard/customers/orders"
                        className="text-[#00b4d8] hover:text-[#0077b6] inline-flex"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </OperationsPage>
  );
}
