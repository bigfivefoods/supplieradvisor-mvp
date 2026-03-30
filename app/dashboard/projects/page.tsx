'use client';

import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { FolderTree, Columns3, Calendar, Users, Target, DollarSign, AlertTriangle, Clock, BarChart3 } from 'lucide-react';

export default function ProjectsPage() {
  const nodes = [
    { name: 'Project Portfolio', href: '/dashboard/projects/portfolio', icon: FolderTree },
    { name: 'Kanban Boards', href: '/dashboard/projects/kanban-boards', icon: Columns3 },
    { name: 'Gantt Charts', href: '/dashboard/projects/gantt', icon: Calendar },
    { name: 'Resource Allocation', href: '/dashboard/projects/resource-allocation', icon: Users },
    { name: 'Milestones', href: '/dashboard/projects/milestones', icon: Target },
    { name: 'Budgeting', href: '/dashboard/projects/budgeting', icon: DollarSign },
    { name: 'Risk Register', href: '/dashboard/projects/risk-register', icon: AlertTriangle },
    { name: 'Timesheets', href: '/dashboard/projects/timesheets', icon: Clock },
    { name: 'Reporting', href: '/dashboard/projects/reporting', icon: BarChart3 },
  ];

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Projects</h1>
        <p className="text-xl text-slate-600 mb-12">World-class project management with on-chain milestones, ratings, RIAD, and full audit trail.</p>

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
