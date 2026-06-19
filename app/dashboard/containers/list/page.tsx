'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function ContainersList() {
  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-2">All Containers</h1>
          <p className="text-xl text-neutral-600">Manage and monitor all your retail outlets</p>
        </div>
        <Link 
          href="/dashboard/containers/add"
          className="flex items-center gap-2 bg-[#00b4d8] text-white px-6 py-3 rounded-2xl font-semibold hover:bg-[#0096b8] transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add New Container
        </Link>
      </div>

      {/* Placeholder for table */}
      <div className="bg-white rounded-3xl p-12 border text-center">
        <p className="text-2xl font-semibold text-neutral-400 mb-2">Container List Coming Soon</p>
        <p className="text-neutral-500">This page will show a searchable, filterable table of all containers with status, location, contractor, and performance metrics.</p>
      </div>
    </div>
  );
}