'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function ResellerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/reseller" backLabel="Back to reseller" />;
}
