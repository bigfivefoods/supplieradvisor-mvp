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
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage
} from '@/components/suppliers/SuppliersShell';

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
      <SuppliersPage>
        <SuppliersHeader
          title="Supplier ops"
          titleAccent="board"
          description="Single command center for trusted procurement — connect, buy, escrow, measure, and rate."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {LINKS.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="group relative overflow-hidden rounded-[1.35rem] border border-neutral-200/90 bg-white p-6 transition-all duration-300 hover:border-slate-900 hover:shadow-xl hover:shadow-slate-900/5"
              >
                <div className="flex justify-between mb-4">
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-neutral-100 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all">
                    <Icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-[#00b4d8] transition-colors" />
                </div>
                <h3 className="font-bold text-base tracking-tight mb-1.5">{m.title}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">{m.desc}</p>
              </Link>
            );
          })}
        </div>
      </SuppliersPage>
    </CompanyRequired>
  );
}
