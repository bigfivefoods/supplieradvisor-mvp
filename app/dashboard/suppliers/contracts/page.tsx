'use client';

import Link from 'next/link';
import { FileText, ArrowRight } from 'lucide-react';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage
} from '@/components/suppliers/SuppliersShell';

/**
 * Supplier contracts — routes commercial agreements into the shared document vault
 * (share/unshare with connected suppliers). Full clause/renewal CRM can layer on later.
 */
export default function SupplierContractsPage() {
  return (
    <CompanyRequired>
      <SuppliersPage>
        <SuppliersHeader
          title="Supplier contracts"
          description="Store supply agreements, SLAs, and NDAs in the supplier document vault. Share with connected suppliers so both parties see the same version in real time."
        />
        <div className="bg-white border border-neutral-200/90 rounded-[1.35rem] p-10 max-w-xl">
          <div className="p-3 rounded-2xl bg-slate-900 text-white w-fit mb-4">
            <FileText className="w-6 h-6 text-[#00b4d8]" />
          </div>
          <h2 className="font-bold text-xl mb-2 tracking-tight">Use the document vault</h2>
          <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
            Tag documents as type <strong>contract</strong> or <strong>sla</strong>, attach a file
            URL, and share once the supplier has accepted your connection. Content-hash updates bump
            the version so counterparties know when terms change.
          </p>
          <Link href="/dashboard/suppliers/documents" className="btn-primary !py-2.5 !px-5 text-sm">
            Open documents <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </SuppliersPage>
    </CompanyRequired>
  );
}
