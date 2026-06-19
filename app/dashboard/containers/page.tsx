'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { Package, BarChart3, Plus, Truck } from 'lucide-react';

export default function ContainersHub() {
  return (
    <ModuleHub
      title="Containers"
      description="Manage your container fleet, track shipments, and monitor performance metrics."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <HubCard
          title="Manage Containers"
          description="View, add, and manage all your containers in one place."
          href="/dashboard/containers"
          icon={Package}
        />

        <HubCard
          title="Container Metrics"
          description="Track OTIF, utilization, turnaround time, and other key metrics."
          href="/dashboard/containers/metrics"
          icon={BarChart3}
        />

        <HubCard
          title="Add New Container"
          description="Register a new container into your fleet."
          href="/dashboard/containers/new"
          icon={Plus}
        />

        <HubCard
          title="Logistics & Shipments"
          description="View active shipments and container movements."
          href="/dashboard/distribution/logistics"
          icon={Truck}
        />

      </div>
    </ModuleHub>
  );
}