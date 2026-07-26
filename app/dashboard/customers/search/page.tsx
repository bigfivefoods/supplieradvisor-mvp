'use client';

/**
 * Customer search entry — full account book with filters lives on Profiles.
 * Keep URL stable for process rail "Search" step.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function CustomerSearchRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/customers/profiles?focus=search');
  }, [router]);
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-sm text-neutral-500">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      Opening customer search…
    </div>
  );
}
