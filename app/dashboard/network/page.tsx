'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Legacy route — connection requests live under /dashboard/connections.
 * Keep this path so old bookmarks and sidebar caches still work.
 */
export default function NetworkRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/connections');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-sm text-neutral-500">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      <p>Opening connection network…</p>
    </div>
  );
}
