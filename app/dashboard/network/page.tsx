'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { Users, UserPlus, Building2, Link as LinkIcon } from 'lucide-react';

export default function NetworkHub() {
  return (
    <ModuleHub
      title="Network"
      description="Connect with businesses, manage relationships, and grow your ecosystem."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <HubCard
          title="Business Directory"
          description="Browse and discover businesses across the platform."
          href="/dashboard/suppliers/directory"
          icon={Building2}
        />

        <HubCard
          title="My Connections"
          description="View and manage your accepted and pending connections."
          href="/dashboard/connections"
          icon={LinkIcon}
        />

        <HubCard
          title="Invite Business"
          description="Send invitations to bring new businesses into your network."
          href="/dashboard/invite-business"
          icon={UserPlus}
        />

        <HubCard
          title="Suppliers"
          description="Access your supplier profiles and raise purchase orders."
          href="/dashboard/suppliers"
          icon={Users}
        />

        <HubCard
          title="Customers"
          description="Manage customer relationships and raise invoices."
          href="/dashboard/customers"
          icon={Users}
        />

      </div>
    </ModuleHub>
  );
}