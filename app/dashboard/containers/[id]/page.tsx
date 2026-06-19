'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { 
  MapPin, 
  User, 
  TrendingUp, 
  Package, 
  DollarSign, 
  FileText, 
  AlertCircle 
} from 'lucide-react';

export default function ContainerDetail() {
  const params = useParams();
  const containerId = params.id;

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />
      
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-4 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">Active</span>
            <span className="text-neutral-500">Container #{containerId}</span>
          </div>
          <h1 className="text-5xl font-black tracking-[-2.5px] text-[#00b4d8]">Nongoma Spaza 03</h1>
          <p className="text-xl text-neutral-600 mt-1 flex items-center gap-2">
            <MapPin className="w-5 h-5" /> Nongoma, KwaZulu-Natal
          </p>
        </div>

        <div className="flex gap-3">
          <Link 
            href={`/dashboard/containers/${containerId}/contractor`}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl border hover:bg-neutral-50"
          >
            <User className="w-4 h-4" /> Manage Contractor
          </Link>
          <Link 
            href={`/dashboard/containers/${containerId}/performance`}
            className="flex items-center gap-2 bg-[#00b4d8] text-white px-5 py-3 rounded-2xl hover:bg-[#0096b8]"
          >
            <TrendingUp className="w-4 h-4" /> View Performance
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-3xl p-6 border">
          <div className="text-sm text-neutral-500">This Month Revenue</div>
          <div className="text-3xl font-bold mt-1">R 87,450</div>
          <div className="text-emerald-600 text-sm mt-1">+12% vs last month</div>
        </div>
        <div className="bg-white rounded-3xl p-6 border">
          <div className="text-sm text-neutral-500">Gross Margin</div>
          <div className="text-3xl font-bold mt-1">34.2%</div>
        </div>
        <div className="bg-white rounded-3xl p-6 border">
          <div className="text-sm text-neutral-500">Contractor</div>
          <div className="text-xl font-semibold mt-1">Sipho Dlamini</div>
          <div className="text-sm text-neutral-500">Since Jan 2025</div>
        </div>
        <div className="bg-white rounded-3xl p-6 border">
          <div className="text-sm text-neutral-500">Commission Rate</div>
          <div className="text-3xl font-bold mt-1">15%</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-3xl border p-2 mb-8">
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/containers/${containerId}/performance`} className="flex items-center gap-2 px-5 py-3 rounded-2xl hover:bg-neutral-100 text-sm font-medium">
            <TrendingUp className="w-4 h-4" /> Performance
          </Link>
          <Link href={`/dashboard/containers/${containerId}/inventory`} className="flex items-center gap-2 px-5 py-3 rounded-2xl hover:bg-neutral-100 text-sm font-medium">
            <Package className="w-4 h-4" /> Inventory
          </Link>
          <Link href={`/dashboard/containers/${containerId}/sales`} className="flex items-center gap-2 px-5 py-3 rounded-2xl hover:bg-neutral-100 text-sm font-medium">
            <DollarSign className="w-4 h-4" /> Sales
          </Link>
          <Link href={`/dashboard/containers/${containerId}/payouts`} className="flex items-center gap-2 px-5 py-3 rounded-2xl hover:bg-neutral-100 text-sm font-medium">
            <DollarSign className="w-4 h-4" /> Payouts
          </Link>
          <Link href={`/dashboard/containers/${containerId}/contractor`} className="flex items-center gap-2 px-5 py-3 rounded-2xl hover:bg-neutral-100 text-sm font-medium">
            <User className="w-4 h-4" /> Contractor
          </Link>
          <Link href={`/dashboard/containers/${containerId}/compliance`} className="flex items-center gap-2 px-5 py-3 rounded-2xl hover:bg-neutral-100 text-sm font-medium">
            <AlertCircle className="w-4 h-4" /> Compliance
          </Link>
        </div>
      </div>

      {/* Overview Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-8 border">
          <h3 className="font-bold text-xl mb-4">Location Details</h3>
          <div className="space-y-3 text-sm">
            <div><span className="text-neutral-500">Address:</span> Main Road, Nongoma</div>
            <div><span className="text-neutral-500">Province:</span> KwaZulu-Natal, South Africa</div>
            <div><span className="text-neutral-500">Coordinates:</span> -27.8923, 31.4567</div>
            <div><span className="text-neutral-500">Deployed:</span> 12 March 2024</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border">
          <h3 className="font-bold text-xl mb-4">Current Contract</h3>
          <div className="space-y-3 text-sm">
            <div><span className="text-neutral-500">Contractor:</span> Sipho Dlamini</div>
            <div><span className="text-neutral-500">Start Date:</span> 01 Jan 2025</div>
            <div><span className="text-neutral-500">Commission:</span> 15%</div>
            <div><span className="text-neutral-500">Status:</span> <span className="text-emerald-600 font-medium">Active</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}