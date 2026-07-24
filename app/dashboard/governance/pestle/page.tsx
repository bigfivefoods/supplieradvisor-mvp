'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** PESTLE → materiality / sustainability until dedicated module ships. */
export default function PestleRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/sustainability/materiality');
  }, [router]);
  return (
    <div className="py-24 flex flex-col items-center text-sm text-neutral-500">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
      Opening materiality…
    </div>
  );
}
