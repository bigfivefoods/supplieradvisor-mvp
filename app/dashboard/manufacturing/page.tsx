'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { 
  Factory, 
  FileText, 
  Calendar, 
  Layers 
} from 'lucide-react';

export default function ManufacturingHub() {
  return (
    <ModuleHub
      title="Manufacturing"
      description="Manage production orders, bills of materials, master schedules, and material requirements planning."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <HubCard
          title="Production Orders"
          description="Create, track, and manage production orders and work orders."
          href="/dashboard/manufacturing/production-orders"
          icon={Factory}
        />

        <HubCard
          title="Bills of Materials"
          description="Define and manage product recipes and component structures."
          href="/dashboard/manufacturing/bills-of-materials"
          icon={FileText}
        />

        <HubCard
          title="Master Production Schedules"
          description="Plan and schedule production across time horizons."
          href="/dashboard/manufacturing/master-production-schedules"
          icon={Calendar}
        />

        <HubCard
          title="MRP"
          description="Material Requirements Planning — calculate material needs and shortages."
          href="/dashboard/manufacturing/mrp"
          icon={Layers}
        />

      </div>
    </ModuleHub>
  );
}