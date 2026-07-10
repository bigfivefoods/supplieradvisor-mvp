'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Loader2, Plus, ShoppingBag, Truck } from 'lucide-react';
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
  supplier_name?: string | null;
  created_at?: string | null;
};

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  sent: 'bg-sky-50 text-sky-800 border-sky-200',
  accepted: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  funded: 'bg-violet-50 text-violet-800 border-violet-200',
  completed: 'bg-cyan-50 text-cyan-900 border-cyan-200',
  paid: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  cancelled: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

export default function SupplierOrdersOpsPage() {
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
      const res = await fetch(`/api/suppliers/purchase-orders?${qs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not load purchase orders');
        setPos([]);
      } else {
        setPos(data.purchaseOrders || data.orders || data.pos || []);
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
    ['sent', 'accepted', 'funded', 'in_transit', 'partial', 'open', 'confirmed'].includes(
      String(p.status)
    )
  ).length;

  return (
    <OperationsPage>
      <OperationsHeader
        title="Supplier"
        titleAccent="orders"
        description="Procure-to-pay spine — purchase orders you raise as the buyer. Feeds inbound logistics and material planning."
        action={
          <Link
            href="/dashboard/suppliers/po"
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Open PO workspace
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard label="All POs" value={pos.length} accent="violet" icon={Truck} />
        <TelemetryCard label="Open" value={open} accent="sky" />
        <TelemetryCard
          label="Draft"
          value={pos.filter((p) => p.status === 'draft').length}
          accent="slate"
        />
        <TelemetryCard
          label="Complete"
          value={pos.filter((p) => ['completed', 'paid'].includes(String(p.status))).length}
          accent="emerald"
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <WorkbenchLink
          href="/dashboard/suppliers/po"
          icon={ShoppingBag}
          title="Full PO workspace"
          desc="Create, fund, and manage purchase orders with on-chain options."
        />
        <WorkbenchLink
          href="/dashboard/suppliers"
          icon={Truck}
          title="Supplier network"
          desc="Connected suppliers, OTIF, and commercial documents."
        />
        <WorkbenchLink
          href="/dashboard/manufacturing/mrp"
          icon={ArrowRight}
          title="Run MRP"
          desc="Net material requirements after firming demand."
        />
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : error ? (
        <EmptyMission
          title="Purchase orders unavailable"
          body={error}
          action={
            <Link href="/dashboard/suppliers/po" className="btn-primary !py-2.5 !px-6 text-sm">
              Open SRM PO module
            </Link>
          }
        />
      ) : pos.length === 0 ? (
        <EmptyMission
          title="No supplier purchase orders yet"
          body="Raise a PO against a connected supplier to start the procure → inbound → warehouse chain."
          action={
            <Link href="/dashboard/suppliers/po" className="btn-primary !py-2.5 !px-6 text-sm">
              Create first PO
            </Link>
          }
        />
      ) : (
        <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-slate-50/80 text-left text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  <th className="px-4 py-3">PO</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pos.slice(0, 40).map((p) => (
                  <tr key={p.id} className="border-b border-neutral-50 hover:bg-sky-50/40">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#0077b6]">
                      {p.po_number || `#${p.id}`}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {p.supplier_name || '—'}
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
                        href="/dashboard/suppliers/po"
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
