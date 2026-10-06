'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function ManufacturingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/dashboard/manufacturing" backLabel="Back to manufacturing" />;
}
