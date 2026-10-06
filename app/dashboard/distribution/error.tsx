'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function DistributionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/dashboard/distribution" backLabel="Back to distribution" />;
}
