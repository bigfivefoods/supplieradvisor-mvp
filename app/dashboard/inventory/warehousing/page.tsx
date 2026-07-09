'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Alias — warehousing is served by live warehouses page */
export default function WarehousingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/inventory/warehouses');
  }, [router]);
  return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
    </div>
  );
}
