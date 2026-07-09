'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import {
  Package,
  Plus,
  Map,
  Users,
  Edit3,
  Boxes,
  GraduationCap,
  BarChart3,
} from 'lucide-react';

export default function ContainersHub() {
  return (
    <ModuleHub
      title="Containers"
      description="Retail outlets run by independent contractors — map locations, appoint & train operators, order and receive stock, and manage payouts."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <HubCard
          title="Manage containers"
          description="Create, edit, search, and delete retail outlets. Full CRUD for every container."
          href="/dashboard/containers/manage"
          icon={Edit3}
        />
        <HubCard
          title="Map"
          description="See every outlet on a live map with GPS pins and contractor status."
          href="/dashboard/containers/map"
          icon={Map}
        />
        <HubCard
          title="Add container"
          description="Onboard a new retail container and pin its location."
          href="/dashboard/containers/add"
          icon={Plus}
        />
        <HubCard
          title="Contractors"
          description="Appoint independent contractors, track training, and store payout banking details."
          href="/dashboard/containers/contractors"
          icon={Users}
        />
        <HubCard
          title="Training hub"
          description="Monitor contractor training and certification status."
          href="/dashboard/containers/training"
          icon={GraduationCap}
        />
        <HubCard
          title="All outlets list"
          description="Browse containers with status, location, and contractor."
          href="/dashboard/containers/list"
          icon={Package}
        />
        <HubCard
          title="Inventory & orders"
          description="Open manage, then pick an outlet to order, receive, and track stock."
          href="/dashboard/containers/manage"
          icon={Boxes}
        />
        <HubCard
          title="Metrics"
          description="Performance overview across your container network."
          href="/dashboard/containers/metrics"
          icon={BarChart3}
        />
      </div>
    </ModuleHub>
  );
}
