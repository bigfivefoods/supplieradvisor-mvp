'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Allocate lives on Clients — one people book. */
export default function MembershipAllocateRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/fitgraph/clients');
  }, [router]);
  return null;
}
