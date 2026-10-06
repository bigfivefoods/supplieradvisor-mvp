'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function ProcurementError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/dashboard/procurement" backLabel="Back to procurement" />;
}
