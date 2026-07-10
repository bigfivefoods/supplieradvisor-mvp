'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Factory,
  Layers,
  Loader2,
  Network,
  Play,
  Workflow,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  PO_STATUS_META,
  completionPct,
  type ProductionOrderStatus,
} from '@/lib/manufacturing/types';
import {
  CompanyRequired,
  EmptyMission,
  OperationsHeader,
  OperationsPage,
  StatusPill,
  TelemetryCard,
  WorkbenchLink,
} from '@/components/operations/OperationsShell';

type Order = {
  id: number;
  order_number: string;
  product_name?: string | null;
  status: ProductionOrderStatus | string;
  qty_planned: number;
  qty_completed: number;
  priority?: number;
  work_center_code?: string | null;
};

export default function ProductionOpsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [mfg, setMfg] = useState<{
    oee?: number;
    bomsActive?: number;
    workCenters?: number;
    workOrdersInProgress?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [oRes, sRes] = await Promise.all([
        fetch(`/api/manufacturing/production-orders?companyId=${companyId}`),
        fetch(`/api/manufacturing/summary?companyId=${companyId}`),
      ]);
      const oData = await oRes.json();
      const sData = await sRes.json();
      setOrders(oData.orders || []);
      setMfg(sData.summary || null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const inFlight = orders.filter((o) =>
    ['released', 'in_progress', 'hold'].includes(String(o.status))
  );

  return (
    <OperationsPage>
      <OperationsHeader
        title="Production"
        titleAccent="operations"
        description="Convert materials into finished goods — work orders, BOMs, cells, MPS, and MRP in one operational view."
        action={
          <Link
            href="/dashboard/manufacturing/production-orders"
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            <Play className="w-4 h-4" /> Work orders
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard
          label="Work orders"
          value={orders.length}
          accent="emerald"
          icon={Factory}
        />
        <TelemetryCard
          label="In flight"
          value={inFlight.length}
          sub={`${orders.filter((o) => o.status === 'hold').length} hold`}
          accent="cyan"
        />
        <TelemetryCard
          label="OEE proxy"
          value={`${mfg?.oee ?? 0}%`}
          accent="violet"
        />
        <TelemetryCard
          label="Active BOMs"
          value={mfg?.bomsActive ?? 0}
          sub={`${mfg?.workCenters ?? 0} cells`}
          accent="sky"
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        <WorkbenchLink
          href="/dashboard/manufacturing/production-orders"
          icon={Factory}
          title="Work order execution"
          desc="Release, start, hold, complete with live progress."
        />
        <WorkbenchLink
          href="/dashboard/manufacturing/bills-of-materials"
          icon={Network}
          title="Bills of materials"
          desc="Versioned structures MRP and WOs trust."
        />
        <WorkbenchLink
          href="/dashboard/manufacturing/master-production-schedules"
          icon={Layers}
          title="Master schedule"
          desc="Firm weekly demand into the plan."
        />
        <WorkbenchLink
          href="/dashboard/manufacturing/mrp"
          icon={Layers}
          title="MRP netting"
          desc="Explode demand → make/buy shortages."
        />
        <WorkbenchLink
          href="/dashboard/manufacturing/work-centers"
          icon={Workflow}
          title="Work cells"
          desc="Capacity, efficiency, WIP load."
        />
        <WorkbenchLink
          href="/dashboard/manufacturing"
          icon={Factory}
          title="Manufacturing command"
          desc="Full factory control tower."
        />
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyMission
          title="No production orders"
          body="Create work orders from MPS firm demand or launch them directly when you are ready to make."
          action={
            <Link
              href="/dashboard/manufacturing/production-orders"
              className="btn-primary !py-2.5 !px-6 text-sm"
            >
              Open work orders
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">
            Priority queue
          </h3>
          {orders.slice(0, 25).map((o) => {
            const meta =
              PO_STATUS_META[o.status as ProductionOrderStatus] || PO_STATUS_META.planned;
            const pct = completionPct(Number(o.qty_planned), Number(o.qty_completed));
            return (
              <div
                key={o.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs font-black text-[#0077b6]">
                      {o.order_number}
                    </span>
                    <StatusPill label={meta.label} className={meta.tone} pulse={meta.pulse} />
                    {o.priority != null && (
                      <span className="text-[10px] font-bold text-neutral-400">P{o.priority}</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {o.product_name || 'Product'}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {o.qty_completed}/{o.qty_planned}
                    {o.work_center_code && ` · CELL ${o.work_center_code}`}
                  </div>
                </div>
                <div className="w-full sm:w-32">
                  <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#00b4d8] to-emerald-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-bold text-neutral-400 text-right mt-0.5">
                    {pct}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </OperationsPage>
  );
}
