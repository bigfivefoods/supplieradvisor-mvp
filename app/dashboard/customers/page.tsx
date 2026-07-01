'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { 
  Users, 
  UserPlus, 
  ShoppingCart, 
  FileText, 
  AlertTriangle, 
  Award, 
  Globe, 
  Search,
  Target   // ← new import for Leads
} from 'lucide-react';

export default function CustomersHub() {
  return (
    <ModuleHub
      title="Customers"
      description="Manage your customer base — profiles, onboarding, orders, quotes, claims, loyalty, and the full sales pipeline."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* NEW LEADS CARD - placed prominently */}
        <HubCard
          title="Leads & Opportunities"
          description="Track prospects, opportunities, estimated value, and conversion pipeline."
          href="/dashboard/customers/leads"
          icon={Target}
        />

        <HubCard
          title="Customer Profiles"
          description="View and manage all customer profiles and details."
          href="/dashboard/customers/profiles"
          icon={Users}
        />

        <HubCard
          title="Onboard New Customer"
          description="Add and onboard new customers into the system."
          href="/dashboard/customers/onboard"
          icon={UserPlus}
        />

        <HubCard
          title="Orders"
          description="Track and manage customer orders."
          href="/dashboard/customers/orders"
          icon={ShoppingCart}
        />

        <HubCard
          title="Quotes"
          description="Create and manage customer quotes."
          href="/dashboard/customers/quotes"
          icon={FileText}
        />

        <HubCard
          title="Claims"
          description="Handle customer claims and complaints."
          href="/dashboard/customers/claims"
          icon={AlertTriangle}
        />

        <HubCard
          title="Loyalty Program"
          description="Manage customer loyalty points and rewards."
          href="/dashboard/customers/loyalty"
          icon={Award}
        />

        <HubCard
          title="Customer Portal"
          description="Access the self-service customer portal."
          href="/dashboard/customers/portal"
          icon={Globe}
        />

        <HubCard
          title="Search Customers"
          description="Advanced search across all customer data."
          href="/dashboard/customers/search"
          icon={Search}
        />

      </div>
    </ModuleHub>
  );
}