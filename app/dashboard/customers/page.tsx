'use client';

import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Users, Search, Plus, Gift, FileText, Heart, BarChart3, Quote } from 'lucide-react';

export default function CustomersHub() {
  const nodes = [
    { name: 'Search Customers', href: '/dashboard/customers/search', icon: Search },
    { name: 'Customer Profiles', href: '/dashboard/customers/profiles', icon: Users },
    { name: 'Onboard New Customer', href: '/dashboard/customers/onboard', icon: Plus },
    { name: 'Orders & Quotes', href: '/dashboard/customers/orders', icon: FileText },
    { name: 'Loyalty & Rewards', href: '/dashboard/customers/loyalty', icon: Gift },
    { name: 'Claims & Support', href: '/dashboard/customers/claims', icon: Heart },
    { name: 'Customer Portal', href: '/dashboard/customers/portal', icon: BarChart3 },
    { name: 'Quotes', href: '/dashboard/customers/quotes', icon: Quote },
  ];

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Customers</h1>
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