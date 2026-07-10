'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  ClipboardCheck,
  Loader2,
  Package,
  QrCode,
  Warehouse,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  OperationsHeader,
  OperationsPage,
  TelemetryCard,
  WorkbenchLink,
} from '@/components/operations/OperationsShell';

type InvSummary = {
  products?: number;
  productsActive?: number;
  warehouses?: number;
  stockLines?: number;
  unitsOnHand?: number;
  lowStock?: number;
  rawMaterials?: number;
  finishedGoods?: number;
};

export default function WarehouseOpsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId();
  const [summary, setSummary] = useState<InvSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/summary?companyId=${companyId}`);
      const data = await res.json();
      setSummary(data.summary || null);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = summary;

  return (
    <OperationsPage>
      <OperationsHeader
        title="Warehouse"
        titleAccent="& inventory"
        description="The physical buffer between inbound supply and outbound demand — locations, live stock, receive, transfers, counts."
        action={
          <Link
            href="/dashboard/inventory"
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            Open inventory OS
          </Link>
        }
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <TelemetryCard
              label="Locations"
              value={s?.warehouses ?? 0}
              accent="cyan"
              icon={Warehouse}
              href="/dashboard/inventory/warehouses"
            />
            <TelemetryCard
              label="Products"
              value={s?.products ?? 0}
              sub={`${s?.productsActive ?? 0} active`}
              accent="violet"
              icon={Package}
              href="/dashboard/inventory/products"
            />
            <TelemetryCard
              label="Units on hand"
              value={s?.unitsOnHand ?? 0}
              sub={`${s?.stockLines ?? 0} stock lines`}
              accent="emerald"
              href="/dashboard/inventory/stock"
            />
            <TelemetryCard
              label="Low stock"
              value={s?.lowStock ?? 0}
              accent="amber"
              href="/dashboard/inventory/stock"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <TelemetryCard
              label="Raw materials"
              value={s?.rawMaterials ?? 0}
              accent="sky"
            />
            <TelemetryCard
              label="Finished goods"
              value={s?.finishedGoods ?? 0}
              accent="emerald"
            />
          </div>

          <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-white to-sky-50/60 p-5 mb-8">
            <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-3">
              Warehouse playbook
            </h3>
            <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              {[
                'Master products & locations',
                'Receive inbound to on-hand',
                'Transfer between sites / containers',
                'Count, reconcile, feed production',
              ].map((step, i) => (
                <li
                  key={step}
                  className="rounded-2xl bg-white border border-cyan-50 px-3 py-3 text-slate-600"
                >
                  <span className="text-[10px] font-black text-[#00b4d8] block mb-1">
                    STEP {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <WorkbenchLink
              href="/dashboard/inventory/stock"
              icon={Package}
              title="Live stock"
              desc="Totals by product and location in real time."
            />
            <WorkbenchLink
              href="/dashboard/inventory/scan"
              icon={QrCode}
              title="Receive / scan"
              desc="QR & GS1 put-away with lot pedigree."
            />
            <WorkbenchLink
              href="/dashboard/inventory/stock-transfers"
              icon={ArrowLeftRight}
              title="Transfers"
              desc="Driver GPS and warehouse ↔ container moves."
            />
            <WorkbenchLink
              href="/dashboard/inventory/counts"
              icon={ClipboardCheck}
              title="Cycle counts"
              desc="Physical stock take and variance posting."
            />
            <WorkbenchLink
              href="/dashboard/inventory/lots"
              icon={Package}
              title="Lots & serials"
              desc="Traceability for quality and recall readiness."
            />
            <WorkbenchLink
              href="/dashboard/inventory/warehouses"
              icon={Warehouse}
              title="Locations"
              desc="DCs, plants, supplier and customer sites."
            />
          </div>
        </>
      )}
    </OperationsPage>
  );
}
