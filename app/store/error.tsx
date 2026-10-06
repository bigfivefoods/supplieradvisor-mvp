'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/store" backLabel="Back to storefront" />;
}
