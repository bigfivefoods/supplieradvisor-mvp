'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/dashboard" backLabel="Back to dashboard" />;
}
