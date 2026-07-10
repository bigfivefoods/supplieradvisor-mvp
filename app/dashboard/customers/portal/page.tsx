'use client';

import Link from 'next/link';
import { Globe, Users, FileText, ShoppingCart, Award } from 'lucide-react';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';

/** Seller-side ops board for connected customers — not the buyer portal */
export default function CustomerPortalPage() {
  return (
    <CompanyRequired>
      <CustomersPage>
        <CustomersHeader
          title="Connected customers ops board"
          description="Seller team workspace for the customer lifecycle — accounts, quotes, orders, invoices, and loyalty. Buyer self-service lives under Buyer workspace."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[
            { href: '/dashboard/customers/profiles', icon: Users, title: 'Accounts', desc: 'Customer master data' },
            { href: '/dashboard/customers/quotes', icon: FileText, title: 'Quotes', desc: 'Proposals customers can accept' },
            { href: '/dashboard/customers/orders', icon: ShoppingCart, title: 'Orders', desc: 'Confirmed purchases' },
            { href: '/dashboard/customers/invoices', icon: FileText, title: 'Invoices', desc: 'Billing & payments' },
            { href: '/dashboard/customers/loyalty', icon: Award, title: 'Loyalty', desc: 'Points & tiers' },
            { href: '/dashboard/customers/invites', icon: Globe, title: 'Invites', desc: 'Portal invitation status' },
            { href: '/dashboard/customers/leads', icon: Users, title: 'Pipeline', desc: 'Leads & opportunities' },
            { href: '/dashboard/customers/riad-log', icon: Award, title: 'RIAD', desc: 'Risks & decisions' },
          ].map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="bg-white border border-neutral-200 rounded-3xl p-5 hover:border-[#00b4d8] hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center mb-3">
                <m.icon className="w-5 h-5 text-[#00b4d8]" />
              </div>
              <div className="font-bold text-slate-800 group-hover:text-[#0077b6]">{m.title}</div>
              <div className="text-sm text-neutral-500 mt-1">{m.desc}</div>
            </Link>
          ))}
        </div>
      </CustomersPage>
    </CompanyRequired>
  );
}
