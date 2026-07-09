'use client';

import Link from 'next/link';
import { Scale, ArrowRight } from 'lucide-react';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

/**
 * Company RIAD entry — points to the full register patterns used in CRM/SRM.
 * Internal company risks can use the same riad_logs module or dedicated boards.
 */
export default function BusinessRiadPage() {
  return (
    <CompanyRequired>
      <BusinessPage>
        <BusinessHeader
          title="Company"
          titleAccent="RIAD"
          description="Risks, issues, actions, and decisions for the company itself — parallel to customer and supplier RIAD registers."
        />
        <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
          <Panel>
            <div className="p-6">
              <div className="p-2.5 rounded-2xl bg-slate-900 text-[#00b4d8] w-fit mb-4">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg mb-2">Supplier RIAD</h3>
              <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
                Supply-base risks, OTIF issues, capacity decisions — full register with status
                chips and filters.
              </p>
              <Link
                href="/dashboard/suppliers/riad-log"
                className="btn-primary !py-2.5 !px-4 text-sm"
              >
                Open supplier RIAD <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Panel>
          <Panel>
            <div className="p-6">
              <div className="p-2.5 rounded-2xl bg-slate-900 text-[#00b4d8] w-fit mb-4">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg mb-2">Customer RIAD</h3>
              <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
                Credit, delivery, quality, and relationship items for your CRM accounts.
              </p>
              <Link
                href="/dashboard/customers/riad-log"
                className="btn-secondary !py-2.5 !px-4 text-sm"
              >
                Open customer RIAD <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Panel>
        </div>
      </BusinessPage>
    </CompanyRequired>
  );
}
