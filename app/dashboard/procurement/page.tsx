'use client';

import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { BarChart3, Gavel, FileText, ShoppingCart, Package, ClipboardList } from 'lucide-react';

export default function ProcurementHub() {
  const nodes = [
    { name: 'Analytics', href: '/dashboard/procurement/analytics', icon: BarChart3 },
    { name: 'Bids', href: '/dashboard/procurement/bids', icon: Gavel },
    { name: 'Invoices', href: '/dashboard/procurement/invoices', icon: FileText },
    { name: 'Purchase Orders', href: '/dashboard/procurement/po', icon: ShoppingCart },
    { name: 'Receipts', href: '/dashboard/procurement/receipts', icon: Package },
    { name: 'Requisitions', href: '/dashboard/procurement/requisitions', icon: ClipboardList },
  ];

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Procurement</h1>
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