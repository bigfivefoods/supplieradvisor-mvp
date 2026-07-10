'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpFromLine,
  Loader2,
  MapPin,
  Package,
  Ship,
  Truck,
  Users,
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
import { ProcessLifecycle } from '@/components/relationship/RelationshipChrome';

type Shipment = {
  id: number;
  shipment_number?: string | null;
  status: string;
  origin_name?: string | null;
  destination_name?: string | null;
  origin?: string | null;
  destination?: string | null;
  carrier_name?: string | null;
  eta?: string | null;
};

export default function OutboundOpsPage() {
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
        `/api/distribution/shipments?companyId=${companyId}&direction=outbound`
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
        title="Outbound"
        titleAccent="operations"
        description="Pick, pack, ship — from last-mile vans to ocean containers. Prove delivery with event-level tracking."
        action={
          <Link
            href="/dashboard/distribution/outbound"
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            Manage outbound <ArrowRight className="w-4 h-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard
          label="Outbound ships"
          value={shipments.length}
          accent="amber"
          icon={ArrowUpFromLine}
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        <WorkbenchLink
          href="/dashboard/distribution/outbound"
          icon={Ship}
          title="Outbound logistics"
          desc="Create dispatches, assign fleet/carriers, log POD events."
        />
        <WorkbenchLink
          href="/dashboard/distribution/tracking"
          icon={MapPin}
          title="Live tracking tower"
          desc="Control-tower view of every outbound leg."
        />
        <WorkbenchLink
          href="/dashboard/distribution/fleet-drivers"
          icon={Users}
          title="Fleet & drivers"
          desc="Own capacity for last-mile and regional runs."
        />
        <WorkbenchLink
          href="/dashboard/distribution/carriers"
          icon={Truck}
          title="Carrier network"
          desc="3PL and global partners."
        />
        <WorkbenchLink
          href="/dashboard/inventory/stock"
          icon={Package}
          title="Allocate stock"
          desc="Confirm finished goods available to ship."
        />
        <WorkbenchLink
          href="/dashboard/operations/customer-orders"
          icon={ArrowRight}
          title="Customer orders"
          desc="Link outbound to fulfillment promises."
        />
      </div>

      <ProcessLifecycle
        title="Outbound lifecycle"
        intro="Confirm demand, allocate stock, book the leg, then track to POD."
        steps={[
          {
            label: 'Customer order',
            href: '/dashboard/operations/customer-orders',
            desc: 'Confirm what must ship and when.',
          },
          {
            label: 'Allocate stock',
            href: '/dashboard/inventory/stock',
            desc: 'Pick finished goods that are free to ship.',
          },
          {
            label: 'Book leg',
            href: '/dashboard/distribution/outbound',
            desc: 'Assign carrier, fleet, mode, and Incoterms.',
          },
          {
            label: 'Track → POD',
            href: '/dashboard/distribution/tracking',
            desc: 'Events from dock to customer door.',
          },
        ]}
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : shipments.length === 0 ? (
        <EmptyMission
          title="No outbound shipments"
          body="When finished goods are ready, create outbound legs and track them to the customer door."
          action={
            <Link
              href="/dashboard/distribution/outbound"
              className="btn-primary !py-2.5 !px-6 text-sm"
            >
              Create outbound shipment
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
                  className="text-xs font-bold text-[#00b4d8] inline-flex items-center gap-1"
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
