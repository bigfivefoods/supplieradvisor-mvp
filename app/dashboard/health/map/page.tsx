'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { HealthPage } from '@/components/health/HealthShell';

/** Reuse schools map for now (health facilities share school_profiles). */
export default function HealthMapRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/schools/map');
  }, [router]);
  return (
    <HealthPage>
      <div className="py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    </HealthPage>
  );
}
