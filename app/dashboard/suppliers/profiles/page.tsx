'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Legacy route — company-scoped network is /network; marketplace is /discover */
export default function SuppliersProfilesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/suppliers/network');
  }, [router]);
  return (
    <div className="p-16 flex justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
    </div>
  );
}
