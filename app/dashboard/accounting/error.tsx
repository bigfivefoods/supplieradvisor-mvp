'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function AccountingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/dashboard/accounting" backLabel="Back to accounting" />;
}
