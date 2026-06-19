'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { Plus, User } from 'lucide-react';
import Link from 'next/link';

export default function ContractorsList() {
  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-2">Contractors</h1>
          <p className="text-xl text-neutral-600">Manage all independent contractors running your containers</p>
        </div>
        <Link 
          href="/dashboard/containers/add"
          className="flex items-center gap-2 bg-[#00b4d8] text-white px-6 py-3 rounded-2xl font-semibold hover:bg-[#0096b8] transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add New Contractor
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-3xl p-6 border">
          <div className="text-sm text-neutral-500">Total Contractors</div>
          <div className="text-4xl font-bold mt-2">47</div>
        </div>
        <div className="bg-white rounded-3xl p-6 border">
          <div className="text-sm text-neutral-500">Active</div>
          <div className="text-4xl font-bold mt-2 text-emerald-600">42</div>
        </div>
        <div className="bg-white rounded-3xl p-6 border">
          <div className="text-sm text-neutral-500">Suspended</div>
          <div className="text-4xl font-bold mt-2 text-amber-600">3</div>
        </div>
        <div className="bg-white rounded-3xl p-6 border">
          <div className="text-sm text-neutral-500">Terminated</div>
          <div className="text-4xl font-bold mt-2 text-red-600">2</div>
        </div>
      </div>

      {/* Placeholder Table Area */}
      <div className="bg-white rounded-3xl border p-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-neutral-400" />
          </div>
        </div>
        <h3 className="text-2xl font-semibold text-neutral-400 mb-2">Contractors List Coming Soon</h3>
        <p className="text-neutral-500 max-w-md mx-auto">
          This page will show a searchable and filterable table of all contractors, 
          their current container, contract status, performance score, and quick actions.
        </p>
      </div>
    </div>
  );
}