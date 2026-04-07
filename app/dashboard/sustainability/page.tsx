'use client';

import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Leaf, Droplet, Wind, Recycle, BarChart3 } from 'lucide-react';

export default function SustainabilityHub() {
  const nodes = [
    { name: 'Carbon Tracking', href: '/dashboard/sustainability/carbon-tracking', icon: Leaf },
    { name: 'Water & Waste', href: '/dashboard/sustainability/water-waste', icon: Droplet },
    { name: 'Ethical Sourcing', href: '/dashboard/sustainability/ethical-sourcing', icon: Wind },
    { name: 'Green Certificates', href: '/dashboard/sustainability/green-certificates', icon: Recycle },
    { name: 'Regenerative Dashboard', href: '/dashboard/sustainability/regenerative-dashboard', icon: Leaf },
    { name: 'Sustainability Reports', href: '/dashboard/sustainability/reports', icon: BarChart3 },
  ];

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Sustainability</h1>
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