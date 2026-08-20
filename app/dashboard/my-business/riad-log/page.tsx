'use client';

import Link from 'next/link';
import { Scale, ArrowRight, Building2, Users, ContactRound } from 'lucide-react';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

export default function BusinessRiadPage() {
  return (
    <CompanyRequired>
      <BusinessPage>
        <BusinessHeader
          title="Company"
          titleAccent="risks"
          description="Risks, issues, actions, and decisions — company, suppliers, and customers on the same RIAD pattern."
        />
        <div className="grid sm:grid-cols-3 gap-4 max-w-5xl">
          <Panel>
            <div className="p-6">
              <div className="w-10 h-10 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center mb-4">
                <Building2 className="w-5 h-5 text-[#00b4d8]" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-slate-800">Company</h3>
              <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
                Internal workspace risks — capacity, compliance, cash, people.
                Use Governance for the full PESTLE / RAID boards.
              </p>
              <Link
                href="/dashboard/governance"
                className="btn-secondary !py-2.5 !px-4 text-sm"
              >
                Open governance <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Panel>
          <Panel>
            <div className="p-6">
              <div className="w-10 h-10 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center mb-4">
                <ContactRound className="w-5 h-5 text-[#00b4d8]" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-slate-800">Suppliers</h3>
              <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
                Supply-base risks, OTIF issues, capacity decisions — full register
                with status chips and filters.
              </p>
              <Link
                href="/dashboard/suppliers/riad-log"
                className="btn-primary !py-2.5 !px-4 text-sm"
              >
                Supplier RIAD <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Panel>
          <Panel>
            <div className="p-6">
              <div className="w-10 h-10 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-[#00b4d8]" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-slate-800">Customers</h3>
              <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
                Credit, delivery, quality, and relationship items for CRM accounts.
              </p>
              <Link
                href="/dashboard/customers/riad-log"
                className="btn-secondary !py-2.5 !px-4 text-sm"
              >
                Customer RIAD <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Panel>
        </div>
        <p className="mt-5 max-w-3xl text-xs text-neutral-500 leading-relaxed flex items-start gap-2">
          <Scale className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#00b4d8]" />
          RIAD is the same register pattern across Company, Suppliers, and Customers —
          one language for risks, issues, actions, and decisions.
        </p>
      </BusinessPage>
    </CompanyRequired>
  );
}
