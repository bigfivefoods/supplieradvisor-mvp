'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function SuppliersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/dashboard/suppliers" backLabel="Back to suppliers" />;
}
