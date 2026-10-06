'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function InventoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/dashboard/inventory" backLabel="Back to inventory" />;
}
