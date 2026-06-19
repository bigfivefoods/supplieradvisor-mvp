'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { 
  Truck, 
  Users, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  MapPin, 
  FileText 
} from 'lucide-react';

export default function DistributionHub() {
  return (
    <ModuleHub
      title="Distribution"
      description="Manage carriers, fleet & drivers, inbound & outbound logistics, shipment tracking, and Incoterms."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <HubCard
          title="Carriers"
          description="Manage carrier partners, contracts, and performance."
          href="/dashboard/distribution/carriers"
          icon={Truck}
        />

        <HubCard
          title="Fleet & Drivers"
          description="Manage company fleet, vehicles, and driver assignments."
          href="/dashboard/distribution/fleet-drivers"
          icon={Users}
        />

        <HubCard
          title="Inbound Logistics"
          description="Track inbound shipments, receipts, and supplier deliveries."
          href="/dashboard/distribution/inbound"
          icon={ArrowDownToLine}
        />

        <HubCard
          title="Outbound Logistics"
          description="Manage outbound shipments, dispatches, and deliveries."
          href="/dashboard/distribution/outbound"
          icon={ArrowUpFromLine}
        />

        <HubCard
          title="Tracking & Visibility"
          description="Real-time shipment tracking and delivery visibility."
          href="/dashboard/distribution/tracking"
          icon={MapPin}
        />

        <HubCard
          title="Incoterms"
          description="Define and manage international commercial terms."
          href="/dashboard/distribution/incoterms"
          icon={FileText}
        />

      </div>
    </ModuleHub>
  );
}