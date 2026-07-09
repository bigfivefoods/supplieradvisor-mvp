'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Outlet hub — send operators to the home dashboard which shows metrics + actions */
export default function ContractorOutletIndex() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    // Single-container operators already land on metrics home; multi-outlet uses this path.
    // Prefer inventory as the first operational surface after selecting an outlet.
    router.replace(`/contractor/outlet/${params?.id}/inventory`);
  }, [params?.id, router]);

  return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
    </div>
  );
}
