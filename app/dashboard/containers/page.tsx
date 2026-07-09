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
  Scale,
  ShieldCheck,
} from 'lucide-react';

export default function ContainersHub() {
  return (
    <ModuleHub
      title="Containers"
      description="Retail outlets run by independent contractors — map locations, appoint & train operators, order and receive stock, RIAD register, and manage payouts."
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
          description="Appoint independent contractors, VerifyNow ID checks, training, and payout banking."
          href="/dashboard/containers/contractors"
          icon={Users}
        />
        <HubCard
          title="Container RIAD log"
          description="Risks, issues, actions & decisions for outlets — log, manage, and close items. Contractors can log too."
          href="/dashboard/containers/riad-log"
          icon={Scale}
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
          title="Verify contractors"
          description="SA ID documents and VerifyNow Home Affairs verification."
          href="/dashboard/containers/contractors"
          icon={ShieldCheck}
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
