'use client';

import Link from 'next/link';
import { Search, Plus, FileText, TrendingUp, Award, AlertTriangle } from 'lucide-react';
import Breadcrumb from '../../../components/ui/Breadcrumb';

export default function SuppliersPage() {
  return (
    <div className="pl-0">
      <Breadcrumb />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-6xl font-black tracking-tighter text-[#00b4d8]">Suppliers</h1>
          <p className="text-2xl text-slate-600">Manage verified suppliers • Connect • Raise POs • Track OTIFEF</p>
        </div>

        {/* NEW: Add Supplier Button */}
        <Link 
          href="/dashboard/suppliers/add" 
          className="flex items-center gap-3 bg-[#00b4d8] hover:bg-[#0096b8] text-white px-6 py-3 rounded-2xl font-semibold transition-all"
        >
          <Plus size={20} />
          Add Supplier
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <Link href="/dashboard/suppliers/search" className="card hover:shadow-xl transition-all group">
          <div className="flex items-center gap-4 mb-6">
            <Search size={36} className="text-[#00b4d8]" />
            <h3 className="text-3xl font-bold">Search Suppliers</h3>
          </div>
          <p className="text-slate-600">Deep search by name, region, industry, certifications and trust score</p>
          <div className="mt-8 text-[#00b4d8] font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
            Open Search →
          </div>
        </Link>

        <Link href="/dashboard/suppliers/connect" className="card hover:shadow-xl transition-all group">
          <div className="flex items-center gap-4 mb-6">
            <Plus size={36} className="text-[#00b4d8]" />
            <h3 className="text-3xl font-bold">Connect</h3>
          </div>
          <p className="text-slate-600">Send connection requests • Only approved connections can transact</p>
          <div className="mt-8 text-[#00b4d8] font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
            Manage Connections →
          </div>
        </Link>

        <Link href="/dashboard/procurement/po" className="card hover:shadow-xl transition-all group">
          <div className="flex items-center gap-4 mb-6">
            <FileText size={36} className="text-[#00b4d8]" />
            <h3 className="text-3xl font-bold">Raise PO</h3>
          </div>
          <p className="text-slate-600">Create purchase orders with auto-filled metadata</p>
          <div className="mt-8 text-[#00b4d8] font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
            Raise New PO →
          </div>
        </Link>

        <Link href="/otifef" className="card hover:shadow-xl transition-all group">
          <div className="flex items-center gap-4 mb-6">
            <TrendingUp size={36} className="text-[#00b4d8]" />
            <h3 className="text-3xl font-bold">OTIFEF Metrics</h3>
          </div>
          <p className="text-slate-600">On-Time • In-Full • Error-Free performance tracking</p>
          <div className="mt-8 text-[#00b4d8] font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
            View OTIFEF Dashboard →
          </div>
        </Link>
      </div>
    </div>
  );
}