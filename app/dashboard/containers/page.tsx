'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { 
  Package, 
  Plus, 
  BarChart3, 
  Users, 
  FileText, 
  Settings 
} from 'lucide-react';

export default function ContainersHub() {
  return (
    <ModuleHub
      title="Containers"
      description="Manage your retail outlets (containers), appoint and track independent contractors, monitor performance, inventory, sales, and payouts."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <HubCard
          title="All Containers"
          description="View, search, and manage all your retail containers and their status."
          href="/dashboard/containers/list"
          icon={Package}
        />

        <HubCard
          title="Add New Container"
          description="Onboard a new container and appoint an independent contractor."
          href="/dashboard/containers/add"
          icon={Plus}
        />

        <HubCard
          title="Performance Metrics"
          description="Aggregate view of container performance, top performers, and issues."
          href="/dashboard/containers/metrics"
          icon={BarChart3}
        />

        <HubCard
          title="Contractors"
          description="Manage all independent contractors running your containers."
          href="/dashboard/containers/contractors"
          icon={Users}
        />

        <HubCard
          title="Reports"
          description="Generate performance, payout, inventory, and compliance reports."
          href="/dashboard/containers/reports"
          icon={FileText}
        />

        <HubCard
          title="Settings"
          description="Configure container types, commission structures, and defaults."
          href="/dashboard/containers/settings"
          icon={Settings}
        />

      </div>
    </ModuleHub>
  );
}