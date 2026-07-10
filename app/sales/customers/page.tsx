'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SalesCustomersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/customers/profiles');
  }, [router]);
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      <p className="text-sm text-slate-400">Opening company customer book…</p>
    </div>
  );
}
