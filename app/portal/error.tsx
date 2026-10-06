'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/portal" backLabel="Back to portal" />;
}
