'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import {
  ADVISOR_MODULE_CORE_HREF,
  enabledAdvisorModules,
} from '@/lib/product/advisor-core-unlocks';

export function AdvisorCoreBridge({
  surface,
}: {
  surface: 'people' | 'customers' | 'accounting';
}) {
  const { isCompanyModuleEnabled } = useCompanyRole();
  const advisors = enabledAdvisorModules(isCompanyModuleEnabled);
  if (!advisors.length) return null;

  const title =
    surface === 'people'
      ? 'Advisor staff live here'
      : surface === 'customers'
        ? 'Advisor members live here'
        : 'Advisor fees land here';
  const blurb =
    surface === 'people'
      ? 'Employed coaches and clinicians dual-write into this People directory. Open the Advisor book to manage their diary and rates.'
      : surface === 'customers'
        ? 'Members, patients and hirers are written into Customers so quotes, invoices and AR stay on the same book.'
        : 'Membership, clinic and hire charges post to Customers invoices. Collect from Advisor Accounts or this Finance hub.';

  return (
    <div className="mb-4 rounded-2xl border border-cyan-100 bg-gradient-to-r from-sky-50/80 to-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
        One OS
      </p>
      <p className="text-sm font-black text-slate-900">{title}</p>
      <p className="mt-0.5 text-[12px] text-slate-600">{blurb}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {advisors.map((id) => {
          const href =
            surface === 'people'
              ? ADVISOR_MODULE_CORE_HREF[id].staff
              : surface === 'customers'
                ? ADVISOR_MODULE_CORE_HREF[id].book
                : ADVISOR_MODULE_CORE_HREF[id].money;
          return (
            <li key={id}>
              <Link
                href={href}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-[11px] font-bold text-cyan-900"
              >
                {ADVISOR_MODULE_CORE_HREF[id].label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
