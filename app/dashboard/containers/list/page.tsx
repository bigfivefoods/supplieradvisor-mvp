'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** List redirects to manage (single source of truth for CRUD list). */
export default function ContainersListRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/containers/manage');
  }, [router]);
  return (
    <div className="p-12 text-center text-neutral-500">
      Opening manage containers…
    </div>
  );
}
