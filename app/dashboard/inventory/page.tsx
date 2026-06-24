'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { 
  Package, 
  Box, 
  ArrowLeftRight, 
  RefreshCw, 
  ClipboardCheck, 
  Warehouse,
  ShoppingBag          // ← New icon for Products
} from 'lucide-react';

export default function InventoryHub() {
  return (
    <ModuleHub
      title="Inventory"
      description="Manage raw materials, finished goods, stock movements, and warehouse operations."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <HubCard
          title="Products"
          description="Manage your full product master data, categories, and specifications."
          href="/dashboard/inventory/products"
          icon={ShoppingBag}
        />

        <HubCard
          title="Raw Materials"
          description="View and manage all raw material stock levels."
          href="/dashboard/inventory/raw-materials"
          icon={Package}
        />

        <HubCard
          title="Finished Goods"
          description="Track finished goods inventory and availability."
          href="/dashboard/inventory/finished-goods"
          icon={Box}
        />

        <HubCard
          title="Warehouses"
          description="Manage multiple warehouses and storage locations."
          href="/dashboard/inventory/warehouses"
          icon={Warehouse}
        />

        <HubCard
          title="Stock Transfers"
          description="Move stock between warehouses and locations."
          href="/dashboard/inventory/stock-transfers"
          icon={ArrowLeftRight}
        />

        <HubCard
          title="Cycle Counts"
          description="Schedule and perform regular cycle counts."
          href="/dashboard/inventory/cycle-counts"
          icon={RefreshCw}
        />

        <HubCard
          title="Stock Take"
          description="Conduct full stock takes and reconcile inventory."
          href="/dashboard/inventory/stock-take"
          icon={ClipboardCheck}
        />

      </div>
    </ModuleHub>
  );
}