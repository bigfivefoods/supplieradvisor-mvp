'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SubscriptionsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/fitgraph/membership');
  }, [router]);
  return null;
}
