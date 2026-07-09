'use client';

import Link from 'next/link';
import {
  FileText,
  Truck,
  Star,
  FolderOpen,
  ArrowRight,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { CompanyRequired, SuppliersHeader } from '@/components/suppliers/SuppliersShell';

const LINKS = [
  {
    href: '/dashboard/suppliers/po',
    icon: Truck,
    title: 'Purchase orders',
    desc: 'Raise standard & on-chain escrow POs, capture delivery for OTIFEF',
  },
  {
    href: '/dashboard/suppliers/performance',
    icon: TrendingUp,
    title: 'OTIFEF scorecards',
    desc: 'On-Time × In-Full × Error-Free portfolio performance',
  },
  {
    href: '/dashboard/suppliers/ratings',
    icon: Star,
    title: 'Ratings',
    desc: 'Peer rate quality, delivery, communication, value',
  },
  {
    href: '/dashboard/suppliers/documents',
    icon: FolderOpen,
    title: 'Shared documents',
    desc: 'Contracts & certs — share with connected suppliers',
  },
  {
    href: '/dashboard/suppliers/discover',
    icon: Shield,
    title: 'Discover trusted suppliers',
    desc: 'Deep metadata search across the network',
  },
  {
    href: '/dashboard/suppliers/network',
    icon: FileText,
    title: 'My network',
    desc: 'Company-scoped supplier book',
  },
] as const;

/**
 * Supplier ops board — seller/buyer procurement command center for SRM.
 */
export default function SupplierPortalPage() {
  return (
    <CompanyRequired>
      <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
        <SuppliersHeader
          title="Supplier ops board"
          description="Single command center for trusted procurement — connect, buy, escrow, measure, and rate."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LINKS.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="group bg-white border rounded-3xl p-6 hover:border-[#00b4d8] hover:shadow-md transition-all"
              >
                <div className="flex justify-between mb-4">
                  <div className="p-3 rounded-2xl bg-neutral-100 group-hover:bg-[#00b4d8] group-hover:text-white transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-neutral-300 group-hover:text-[#00b4d8]" />
                </div>
                <h3 className="font-bold text-lg mb-1">{m.title}</h3>
                <p className="text-sm text-neutral-600">{m.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </CompanyRequired>
  );
}
