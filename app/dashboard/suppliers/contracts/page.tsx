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
        <div className="bg-white border border-neutral-200 rounded-3xl p-10 max-w-xl">
          <div className="w-12 h-12 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-[#00b4d8]" />
          </div>
          <h2 className="font-bold text-xl mb-2 tracking-tight text-slate-800">Use the document vault</h2>
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
