'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Home, User, Search, Users, Package, Box, Factory, Truck, DollarSign, FolderTree, Users2, ShieldCheck, Leaf, ChevronDown } from 'lucide-react';

export default function Sidebar() {
  return (
    <div className="w-full h-screen bg-white flex flex-col border-r border-neutral-200 overflow-hidden">
      {/* Real sa-logo.png header */}
      <div className="p-6 border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <Image 
            src="/sa-logo.png" 
            alt="SupplierAdvisor" 
            width={48} 
            height={48} 
            className="rounded-xl" 
            priority 
          />
          <div className="font-black text-3xl tracking-[-1px]">SupplierAdvisor®</div>
        </div>
      </div>

      {/* Navigation – matches your screenshot */}
      <nav className="flex-1 px-3 py-6 overflow-y-auto space-y-1">
        <Link href="/dashboard" className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 rounded-2xl text-neutral-700 hover:text-neutral-950 font-medium">
          <Home className="w-5 h-5" /> Home
        </Link>
        <Link href="/dashboard/profile" className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 rounded-2xl text-neutral-700 hover:text-neutral-950 font-medium">
          <User className="w-5 h-5" /> Profile
        </Link>

        <div className="px-5 py-3.5 flex items-center justify-between text-neutral-700 font-medium hover:bg-neutral-50 rounded-2xl cursor-pointer">
          <div className="flex items-center gap-3"><Search className="w-5 h-5" /> Suppliers</div>
          <ChevronDown className="w-4 h-4" />
        </div>

        <div className="px-5 py-3.5 flex items-center justify-between text-neutral-700 font-medium hover:bg-neutral-50 rounded-2xl cursor-pointer">
          <div className="flex items-center gap-3"><Users className="w-5 h-5" /> Customers</div>
          <ChevronDown className="w-4 h-4" />
        </div>

        <Link href="/dashboard/procurement" className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 rounded-2xl text-neutral-700 hover:text-neutral-950 font-medium">
          <Package className="w-5 h-5" /> Procurement
        </Link>
        <Link href="/dashboard/inventory" className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 rounded-2xl text-neutral-700 hover:text-neutral-950 font-medium">
          <Box className="w-5 h-5" /> Inventory
        </Link>
        <Link href="/dashboard/manufacturing" className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 rounded-2xl text-neutral-700 hover:text-neutral-950 font-medium">
          <Factory className="w-5 h-5" /> Manufacturing
        </Link>
        <Link href="/dashboard/logistics" className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 rounded-2xl text-neutral-700 hover:text-neutral-950 font-medium">
          <Truck className="w-5 h-5" /> Logistics
        </Link>
        <Link href="/dashboard/finance" className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 rounded-2xl text-neutral-700 hover:text-neutral-950 font-medium">
          <DollarSign className="w-5 h-5" /> Finance
        </Link>
        <Link href="/dashboard/projects" className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 rounded-2xl text-neutral-700 hover:text-neutral-950 font-medium">
          <FolderTree className="w-5 h-5" /> Projects
        </Link>
        <Link href="/dashboard/people" className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 rounded-2xl text-neutral-700 hover:text-neutral-950 font-medium">
          <Users2 className="w-5 h-5" /> People
        </Link>
        <Link href="/dashboard/quality" className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 rounded-2xl text-neutral-700 hover:text-neutral-950 font-medium">
          <ShieldCheck className="w-5 h-5" /> Quality
        </Link>
        <Link href="/dashboard/sustainability" className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 rounded-2xl text-neutral-700 hover:text-neutral-950 font-medium">
          <Leaf className="w-5 h-5" /> Sustainability
        </Link>
      </nav>
    </div>
  );
}