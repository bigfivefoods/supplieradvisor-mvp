'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Simulation Lab folded into Scorecards + Forecasts — keep route for bookmarks. */
export default function SimulationLabRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/intelligence/custom-scorecards');
  }, [router]);
  return (
    <div className="py-28 flex flex-col items-center text-sm text-neutral-500">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8] mb-3" />
      Opening scorecards…
    </div>
  );
}
