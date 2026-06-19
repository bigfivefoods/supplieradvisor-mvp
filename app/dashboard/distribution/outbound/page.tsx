'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { Truck } from 'lucide-react';

export default function ShipmentsPage() {
  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Shipments</h1>
        <div className="card p-12">
          <h2 className="text-4xl font-bold mb-8">All Active & Completed Shipments</h2>
          <p className="text-xl text-slate-600">Live tracking, status updates, and documents module (ready for expansion).</p>
        </div>
      </div>
    </div>
  );
}