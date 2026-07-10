'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SalesQuotesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/customers/quotes');
  }, [router]);
  return (
    <div className="flex justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
    </div>
  );
}
