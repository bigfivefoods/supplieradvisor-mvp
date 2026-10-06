'use client';

import { useEffect, useRef } from 'react';
import RouteError from '@/components/app-shell/RouteError';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const loggedErrorRef = useRef<Error | null>(null);

  useEffect(() => {
    if (loggedErrorRef.current === error) return;
    console.error(error);
    loggedErrorRef.current = error;
  }, [error]);

  return <RouteError error={error} reset={reset} backHref="/dashboard" backLabel="Back to dashboard" />;
}
