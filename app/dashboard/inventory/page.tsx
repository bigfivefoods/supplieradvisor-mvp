'use client';

import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Box, Layers, Truck, RotateCcw, ArrowLeftRight, Warehouse } from 'lucide-react';

export default function InventoryHub() {
  const nodes = [
    { name: 'Raw Materials', href: '/dashboard/inventory/raw-materials', icon: Box },
    { name: 'Finished Goods', href: '/dashboard/inventory/finished-goods', icon: Layers },
    { name: 'Stock Transfers', href: '/dashboard/inventory/transfers', icon: Truck },
    { name: 'Cycle Counts', href: '/dashboard/inventory/cycle-counts', icon: RotateCcw },
    { name: 'Stock-Take', href: '/dashboard/inventory/stock-take', icon: ArrowLeftRight },
    { name: 'Warehouses', href: '/dashboard/inventory/warehouses', icon: Warehouse },
    { name: 'Warehousing', href: '/dashboard/inventory/warehousing', icon: Warehouse },
    { name: 'Transfers', href: '/dashboard/inventory/transfers', icon: Truck },
  ];

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Inventory</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nodes.map((node, i) => (
            <Link key={i} href={node.href} className="card group hover:border-[#00b4d8] transition-all">
              <div className="flex items-center gap-6 p-8">
                <node.icon size={48} className="text-[#00b4d8]" />
                <div>
                  <h3 className="text-3xl font-bold">{node.name}</h3>
                  <p className="text-slate-600 mt-2">Click to open module →</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}