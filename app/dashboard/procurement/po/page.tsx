'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText } from 'lucide-react';

/**
 * Legacy procurement raise-PO page.
 * Canonical buyer raise-PO UX is /dashboard/buyer/pos (connected suppliers + server API).
 * Suppliers/po remains the broad supplier-search path.
 */
export default function LegacyRaisePORedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/buyer/pos');
  }, [router]);

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center px-6 text-center">
      <FileText className="w-10 h-10 text-[#00b4d8] mb-3" />
      <p className="text-neutral-600 text-sm mb-4">
        This page is obsolete. Redirecting to the buyer purchase-order workspace…
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        <Link href="/dashboard/buyer/pos" className="btn-primary !py-2.5 !px-4 text-sm">
          Buyer POs
        </Link>
        <Link href="/dashboard/suppliers/po" className="btn-secondary !py-2.5 !px-4 text-sm">
          Suppliers PO (legacy search)
        </Link>
      </div>
    </div>
  );
}
