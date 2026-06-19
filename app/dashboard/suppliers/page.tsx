'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { 
  Building2, 
  Plus, 
  Users, 
  FileText, 
  File, 
  Globe, 
  AlertTriangle, 
  Link as LinkIcon, 
  Search 
} from 'lucide-react';

export default function SuppliersHub() {
  return (
    <ModuleHub
      title="Suppliers"
      description="Manage your supplier ecosystem — directory, onboarding, contracts, purchase orders, and risk monitoring."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <HubCard
          title="Supplier Directory"
          description="Browse and search all suppliers in your network."
          href="/dashboard/suppliers/directory"
          icon={Building2}
        />

        <HubCard
          title="Add New Supplier"
          description="Onboard a new supplier into the system."
          href="/dashboard/suppliers/add"
          icon={Plus}
        />

        <HubCard
          title="Profiles & My Suppliers"
          description="View and manage your active supplier profiles."
          href="/dashboard/suppliers/profiles"
          icon={Users}
        />

        <HubCard
          title="Purchase Orders"
          description="Create, track, and manage purchase orders."
          href="/dashboard/suppliers/po"
          icon={FileText}
        />

        <HubCard
          title="Contracts"
          description="View and manage supplier contracts and agreements."
          href="/dashboard/suppliers/contracts"
          icon={File}
        />

        <HubCard
          title="Supplier Portal"
          description="Access the self-service portal for suppliers."
          href="/dashboard/suppliers/portal"
          icon={Globe}
        />

        <HubCard
          title="Risk Alerts"
          description="Monitor supplier risk, compliance, and alerts."
          href="/dashboard/suppliers/risk-alerts"
          icon={AlertTriangle}
        />

        <HubCard
          title="Connect & Onboarding"
          description="Manage supplier connection and onboarding flows."
          href="/dashboard/suppliers/connect"
          icon={LinkIcon}
        />

        <HubCard
          title="Search Suppliers"
          description="Advanced search across all supplier data."
          href="/dashboard/suppliers/search"
          icon={Search}
        />

      </div>
    </ModuleHub>
  );
}