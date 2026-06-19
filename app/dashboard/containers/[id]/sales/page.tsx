'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function ContainerSales() {
  const params = useParams();
  const containerId = params.id;

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-5xl font-black tracking-[-2.5px] text-[#00b4d8]">Sales</h1>
          <p className="text-neutral-600">Transaction history for Container #{containerId}</p>
        </div>
        <Link href={`/dashboard/containers/${containerId}`} className="text-sm text-neutral-600 hover:text-neutral-900">← Back to Overview</Link>
      </div>

      <div className="bg-white rounded-3xl p-12 border text-center">
        <p className="text-2xl font-semibold text-neutral-400">Sales History Coming Soon</p>
        <p className="text-neutral-500 mt-2">Daily sales, top products, returns, and transaction logs will appear here.</p>
      </div>
    </div>
  );
}