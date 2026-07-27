'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { HealthPage } from '@/components/health/HealthShell';

/** Facilities list lives on DoH desk */
export default function HealthFacilitiesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/health/agency');
  }, [router]);
  return (
    <HealthPage>
      <div className="py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    </HealthPage>
  );
}
