'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Legacy connect page used hardcoded requester_id and broken column names.
 * Real connect flow: Discover → Request connect / Add to book.
 */
export default function SupplierConnectRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/suppliers/discover');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-sm text-neutral-500">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      <p>Opening supplier discover…</p>
    </div>
  );
}
