'use client';

import Link from 'next/link';
import { Mail, UserPlus } from 'lucide-react';
import { CompanyRequired, CustomersHeader } from '@/components/customers/CustomersShell';

export default function CustomerInvitesPage() {
  return (
    <CompanyRequired>
      <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
        <CustomersHeader
          title="Customer invitations"
          description="Invite customers into your network / portal. Onboard accounts and link them to the CRM pipeline."
          action={
            <Link href="/dashboard/customers/onboard" className="btn-primary !py-2.5 !px-5 text-sm">
              <UserPlus className="w-4 h-4" /> Add customer
            </Link>
          }
        />
        <div className="bg-white border rounded-3xl p-10 text-center max-w-xl mx-auto">
          <Mail className="w-10 h-10 mx-auto mb-3 text-[#00b4d8]" />
          <p className="text-neutral-600 text-sm mb-4">
            Create the customer profile first, then use your network invite tools to grant portal access.
            All commercial activity (quotes, orders, invoices, loyalty) stays on Supabase under this company.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/dashboard/customers/onboard" className="btn-primary !py-2.5 !px-4 text-sm">
              Onboard customer
            </Link>
            <Link href="/dashboard/customers/profiles" className="btn-secondary !py-2.5 !px-4 text-sm">
              View profiles
            </Link>
          </div>
        </div>
      </div>
    </CompanyRequired>
  );
}
