'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Legacy route — deep trust search lives at /discover */
export default function SuppliersSearchRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/suppliers/discover');
  }, [router]);
  return (
    <div className="p-16 flex justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
    </div>
  );
}
