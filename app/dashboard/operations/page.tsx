'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { 
  Truck, 
  ArrowDownToLine, 
  Factory, 
  ArrowUpFromLine, 
  ShoppingCart 
} from 'lucide-react';

export default function OperationsHub() {
  return (
    <ModuleHub
      title="Operations"
      description="Manage end-to-end operations — from supplier orders through inbound, production, outbound, and customer orders."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <HubCard
          title="Supplier Orders"
          description="Manage purchase orders and supplier deliveries."
          href="/dashboard/operations/supplier-orders"
          icon={Truck}
        />

        <HubCard
          title="Inbound"
          description="Track goods received into warehouses and containers."
          href="/dashboard/operations/inbound"
          icon={ArrowDownToLine}
        />

        <HubCard
          title="Production"
          description="Monitor production orders, recipes, and output."
          href="/dashboard/operations/production"
          icon={Factory}
        />

        <HubCard
          title="Outbound"
          description="Manage dispatches, shipments, and deliveries."
          href="/dashboard/operations/outbound"
          icon={ArrowUpFromLine}
        />

        <HubCard
          title="Customer Orders"
          description="Track and fulfill customer orders."
          href="/dashboard/operations/customer-orders"
          icon={ShoppingCart}
        />

      </div>
    </ModuleHub>
  );
}
