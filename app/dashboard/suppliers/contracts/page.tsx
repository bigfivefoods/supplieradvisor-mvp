'use client';

import Link from 'next/link';
import { FileText, ArrowRight, Share2, ShieldCheck } from 'lucide-react';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage
} from '@/components/suppliers/SuppliersShell';
import { srmFocus } from '@/components/suppliers/srm/SrmDesk';

const STEPS = [
  {
    icon: FileText,
    title: 'Store the agreement',
    body: 'Put the supply agreement, SLA, or NDA in the document vault. Paste the file link so both sides open the same copy.',
  },
  {
    icon: ShieldCheck,
    title: 'Tag the type',
    body: 'Choose contract, SLA, or NDA. A content change bumps the version so the counterparty can see that terms moved.',
  },
  {
    icon: Share2,
    title: 'Share when they are connected',
    body: 'Share only after the supplier has accepted the connection. Until then the file stays private on your book.',
  },
] as const;

/**
 * Supplier contracts — routes commercial agreements into the shared document vault
 * (share/unshare with connected suppliers).
 */
export default function SupplierContractsPage() {
  return (
    <CompanyRequired>
      <SuppliersPage>
        <SuppliersHeader
          title="Supplier contracts"
          description="Store supply agreements, SLAs, and NDAs in the supplier document vault. Share with connected suppliers so both parties see the same version."
          action={
            <Link href="/dashboard/suppliers/documents" className={`${srmFocus} btn-primary !px-5 !py-2.5 text-sm`}>
              Open documents <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="srm-rise rounded-3xl border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00b4d8]/10 text-xs font-black text-[#0077b6]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <Icon className="h-4 w-4 text-[#00b4d8]" aria-hidden />
                </div>
                <h2 className="font-bold text-slate-900">{step.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </SuppliersPage>
    </CompanyRequired>
  );
}
