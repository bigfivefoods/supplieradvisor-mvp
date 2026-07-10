'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Deep-link into company CRM pipeline (data owned by the business). */
export default function SalesPipelineRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/customers/leads');
  }, [router]);
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      <p className="text-sm text-slate-400">Opening your company pipeline…</p>
    </div>
  );
}
