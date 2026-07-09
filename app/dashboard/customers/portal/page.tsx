'use client';

import Link from 'next/link';
import { Globe, Users, FileText, ShoppingCart, Award } from 'lucide-react';
import { CompanyRequired, CustomersHeader } from '@/components/customers/CustomersShell';

/** Seller-side ops board for connected customers — not the buyer portal */
export default function CustomerPortalPage() {
  return (
    <CompanyRequired>
      <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
        <CustomersHeader
          title="Connected customers ops board"
          description="Seller team workspace for the customer lifecycle — accounts, quotes, orders, invoices, and loyalty. Buyer self-service lives under Buyer workspace."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { href: '/dashboard/customers/profiles', icon: Users, title: 'Accounts', desc: 'Customer master data' },
            { href: '/dashboard/customers/quotes', icon: FileText, title: 'Quotes', desc: 'Proposals customers can accept' },
            { href: '/dashboard/customers/orders', icon: ShoppingCart, title: 'Orders', desc: 'Confirmed purchases' },
            { href: '/dashboard/customers/invoices', icon: FileText, title: 'Invoices', desc: 'Billing & payments' },
            { href: '/dashboard/customers/loyalty', icon: Award, title: 'Loyalty', desc: 'Points & tiers' },
            { href: '/dashboard/customers/invites', icon: Globe, title: 'Invites', desc: 'Portal invitation status' },
          ].map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="bg-white border rounded-3xl p-6 hover:border-[#00b4d8] transition-all"
            >
              <m.icon className="w-7 h-7 text-[#00b4d8] mb-3" />
              <div className="font-bold text-lg">{m.title}</div>
              <div className="text-sm text-neutral-500 mt-1">{m.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </CompanyRequired>
  );
}
