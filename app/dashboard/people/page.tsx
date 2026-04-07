'use client';

import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Users, UserPlus, Network, DollarSign, Award, BookOpen } from 'lucide-react';

export default function PeopleHub() {
  const nodes = [
    { name: 'Employee Directory', href: '/dashboard/people/employee-directory', icon: Users },
    { name: 'Onboarding', href: '/dashboard/people/onboarding', icon: UserPlus },
    { name: 'Org Chart', href: '/dashboard/people/org-chart', icon: Network },
    { name: 'Payroll', href: '/dashboard/people/payroll', icon: DollarSign },
    { name: 'Performance Reviews', href: '/dashboard/people/performance-reviews', icon: Award },
    { name: 'Training', href: '/dashboard/people/training', icon: BookOpen },
  ];

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">People</h1>
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