'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowRight,
  Loader2,
  MapPin,
  PackageCheck,
  QrCode,
  Truck,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  SHIPMENT_STATUS_META,
  type ShipmentStatus,
} from '@/lib/distribution/types';
import {
  CompanyRequired,
  EmptyMission,
  OperationsHeader,
  OperationsPage,
  StatusPill,
  TelemetryCard,
  WorkbenchLink,
} from '@/components/operations/OperationsShell';

type Shipment = {
  id: number;
  shipment_number?: string | null;
  status: string;
  mode?: string | null;
  origin_name?: string | null;
  destination_name?: string | null;
  origin?: string | null;
  destination?: string | null;
  carrier_name?: string | null;
  progress_pct?: number | null;
  eta?: string | null;
};

export default function InboundOpsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/distribution/shipments?companyId=${companyId}&direction=inbound`
      );
      const data = await res.json();
      setShipments(data.shipments || []);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const motion = shipments.filter((s) =>
    ['picked_up', 'in_transit', 'at_hub', 'customs', 'out_for_delivery', 'booked'].includes(
      s.status
    )
  ).length;

  return (
    <OperationsPage>
      <OperationsHeader
        title="Inbound"
        titleAccent="operations"
        description="Goods into your network — supplier pickups, ports, and DC receipts. From ASN mindset to put-away."
        action={
          <Link
            href="/dashboard/distribution/inbound"
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            Manage inbound <ArrowRight className="w-4 h-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard
          label="Inbound ships"
          value={shipments.length}
          accent="sky"
          icon={ArrowDownToLine}
        />
        <TelemetryCard label="In motion" value={motion} accent="emerald" icon={Truck} />
        <TelemetryCard
          label="Delivered"
          value={shipments.filter((s) => s.status === 'delivered').length}
          accent="cyan"
        />
        <TelemetryCard
          label="Exceptions"
          value={shipments.filter((s) => s.status === 'exception').length}
          accent="rose"
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <WorkbenchLink
          href="/dashboard/distribution/inbound"
          icon={Truck}
          title="Inbound logistics"
          desc="Create legs, assign carriers, advance status, log events."
        />
        <WorkbenchLink
          href="/dashboard/inventory/scan"
          icon={QrCode}
          title="Receive to stock"
          desc="Scan QR / GS1 and put units on hand with lot pedigree."
        />
        <WorkbenchLink
          href="/dashboard/inventory/stock-transfers"
          icon={PackageCheck}
          title="Internal transfers"
          desc="Move received goods between warehouses and containers."
        />
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : shipments.length === 0 ? (
        <EmptyMission
          title="No inbound shipments"
          body="Create inbound logistics from Distribution, or start with a supplier PO and plan the receive."
          action={
            <Link
              href="/dashboard/distribution/inbound"
              className="btn-primary !py-2.5 !px-6 text-sm"
            >
              Create inbound shipment
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {shipments.map((s) => {
            const meta =
              SHIPMENT_STATUS_META[s.status as ShipmentStatus] || SHIPMENT_STATUS_META.planned;
            return (
              <div
                key={s.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-black text-[#0077b6]">
                      {s.shipment_number || `#${s.id}`}
                    </span>
                    <StatusPill label={meta.label} className={meta.tone} pulse={meta.pulse} />
                  </div>
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {s.origin_name || s.origin || 'Origin'} →{' '}
                    {s.destination_name || s.destination || 'Destination'}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {s.carrier_name || 'No carrier'}
                    {s.eta && ` · ETA ${new Date(s.eta).toLocaleString()}`}
                  </div>
                </div>
                <Link
                  href="/dashboard/distribution/tracking"
                  className="text-xs font-bold text-[#00b4d8] inline-flex items-center gap-1 shrink-0"
                >
                  <MapPin className="w-3.5 h-3.5" /> Track
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </OperationsPage>
  );
}
