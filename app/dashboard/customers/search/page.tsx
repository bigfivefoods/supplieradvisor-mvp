'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Search lives on Profiles + Leads — redirect to profiles as primary search */
export default function CustomerSearchRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/customers/profiles');
  }, [router]);
  return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
    </div>
  );
}
