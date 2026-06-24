'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { 
  Package, 
  Plus, 
  BarChart3, 
  Users, 
  Edit3,
  GraduationCap 
} from 'lucide-react';

export default function ContainersHub() {
  return (
    <ModuleHub
      title="Containers"
      description="Manage your retail outlets (containers), appoint and track independent contractors, monitor performance, inventory, sales, and payouts."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* All Containers */}
        <HubCard
          title="All Containers"
          description="View, search, and manage all your retail containers and their status."
          href="/dashboard/containers/list"
          icon={Package}
        />

        {/* Manage Containers */}
        <HubCard
          title="Manage Containers"
          description="Create, edit, assign contractors, update status, upload photos, and manage full container records."
          href="/dashboard/containers/manage"
          icon={Edit3}
        />

        {/* Add New Container */}
        <HubCard
          title="Add New Container"
          description="Onboard a new container and appoint an independent contractor."
          href="/dashboard/containers/add"
          icon={Plus}
        />

        {/* Contractors */}
        <HubCard
          title="Contractors"
          description="Manage all independent contractors running your containers."
          href="/dashboard/containers/contractors"
          icon={Users}
        />

        {/* Training Hub */}
        <HubCard
          title="Training Hub"
          description="Access training materials, track contractor onboarding, completion status, and certifications."
          href="/dashboard/containers/training"
          icon={GraduationCap}
        />

        {/* Performance Metrics */}
        <HubCard
          title="Performance Metrics"
          description="Aggregate view of container performance, top performers, and issues."
          href="/dashboard/containers/metrics"
          icon={BarChart3}
        />

      </div>
    </ModuleHub>
  );
}