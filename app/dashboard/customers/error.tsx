'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function CustomersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/dashboard/customers" backLabel="Back to customers" />;
}
