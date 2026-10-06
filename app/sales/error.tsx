'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function SalesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/sales" backLabel="Back to sales" />;
}
