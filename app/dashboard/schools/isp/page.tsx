'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  CompanyRequired,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

/**
 * SP-only entry — lands on command hub which auto-detects SP role,
 * with deep-link preference to deliveries.
 */
export default function IspWorkspacePage() {
  return (
    <CompanyRequired>
      <Redirect />
    </CompanyRequired>
  );
}

function Redirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/schools/deliveries');
  }, [router]);
  return (
    <SchoolsPage>
      <div className="py-24 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-semibold">Opening SP deliveries…</p>
      </div>
    </SchoolsPage>
  );
}
