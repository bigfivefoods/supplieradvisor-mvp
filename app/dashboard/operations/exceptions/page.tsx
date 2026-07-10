'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Factory,
  Loader2,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  EmptyMission,
  OperationsHeader,
  OperationsPage,
  StatusPill,
  TelemetryCard,
  WorkbenchLink,
} from '@/components/operations/OperationsShell';

type ExceptionItem = {
  id: string;
  domain: string;
  title: string;
  detail: string;
  severity: 'warning' | 'critical' | 'info';
  href: string;
  status: string;
};

export default function ExceptionsOpsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId();
  const [items, setItems] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [ships, wos, ops] = await Promise.all([
        fetch(`/api/distribution/shipments?companyId=${companyId}`),
        fetch(`/api/manufacturing/production-orders?companyId=${companyId}`),
        fetch(`/api/operations/summary?companyId=${companyId}`),
      ]);
      const shipData = await ships.json();
      const woData = await wos.json();
      const opsData = await ops.json();

      const list: ExceptionItem[] = [];

      for (const s of shipData.shipments || []) {
        if (s.status === 'exception' || s.status === 'hold') {
          list.push({
            id: `ship-${s.id}`,
            domain: s.direction || 'logistics',
            title: s.shipment_number || `Shipment #${s.id}`,
            detail: `${s.origin_name || s.origin || 'Origin'} → ${s.destination_name || s.destination || 'Dest'}`,
            severity: s.status === 'exception' ? 'critical' : 'warning',
            href: '/dashboard/distribution/tracking',
            status: s.status,
          });
        }
      }

      for (const o of woData.orders || []) {
        if (o.status === 'hold') {
          list.push({
            id: `wo-${o.id}`,
            domain: 'production',
            title: o.order_number || `WO #${o.id}`,
            detail: o.product_name || 'Work order on hold',
            severity: 'warning',
            href: '/dashboard/manufacturing/production-orders',
            status: o.status,
          });
        }
      }

      if ((opsData.summary?.qualityOpen || 0) > 0) {
        list.push({
          id: 'qi-open',
          domain: 'quality',
          title: `${opsData.summary.qualityOpen} open inspections`,
          detail: 'Quality hold points may block release to stock or ship.',
          severity: 'warning',
          href: '/dashboard/quality/inspections',
          status: 'open',
        });
      }

      if ((opsData.summary?.lowStock || 0) > 0) {
        // lowStock not always in summary - skip if missing
      }

      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const critical = items.filter((i) => i.severity === 'critical').length;

  return (
    <OperationsPage>
      <OperationsHeader
        title="Exceptions"
        titleAccent="& holds"
        description="Anything blocking flow — logistics exceptions, production holds, quality open points. Clear these to restore throughput."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard
          label="Open issues"
          value={items.length}
          accent="rose"
          icon={AlertTriangle}
        />
        <TelemetryCard label="Critical" value={critical} accent="rose" />
        <TelemetryCard
          label="Warnings"
          value={items.length - critical}
          accent="amber"
        />
        <TelemetryCard
          label="Focus"
          value={items.length === 0 ? 'Clear' : 'Act'}
          accent={items.length === 0 ? 'emerald' : 'violet'}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <WorkbenchLink
          href="/dashboard/distribution/tracking"
          icon={Truck}
          title="Logistics tower"
          desc="Resolve shipment exceptions and delays."
        />
        <WorkbenchLink
          href="/dashboard/manufacturing/production-orders"
          icon={Factory}
          title="Production floor"
          desc="Release holds and restart work orders."
        />
        <WorkbenchLink
          href="/dashboard/quality"
          icon={ShieldAlert}
          title="Quality"
          desc="Inspections, HACCP, and release gates."
        />
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : items.length === 0 ? (
        <EmptyMission
          title="No active exceptions"
          body="The chain is clear — no logistics exceptions, production holds, or flagged quality gates in this snapshot."
          action={
            <Link href="/dashboard/operations" className="btn-primary !py-2.5 !px-6 text-sm">
              Back to command
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all ${
                item.severity === 'critical'
                  ? 'border-rose-200 bg-rose-50/40'
                  : 'border-amber-200 bg-amber-50/30'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-white flex items-center justify-center shrink-0">
                <AlertTriangle
                  className={`w-5 h-5 ${
                    item.severity === 'critical' ? 'text-rose-600' : 'text-amber-600'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <StatusPill
                    label={item.domain}
                    className="bg-white text-slate-700 border-neutral-200"
                  />
                  <StatusPill
                    label={item.status}
                    className={
                      item.severity === 'critical'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-amber-100 text-amber-900 border-amber-200'
                    }
                  />
                </div>
                <div className="font-bold text-slate-800">{item.title}</div>
                <div className="text-xs text-neutral-600 mt-0.5">{item.detail}</div>
              </div>
              <span className="text-xs font-bold text-[#00b4d8] inline-flex items-center gap-1 shrink-0">
                Resolve <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </OperationsPage>
  );
}
