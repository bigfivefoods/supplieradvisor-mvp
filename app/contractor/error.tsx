'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function ContractorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/contractor" backLabel="Back to contractor" />;
}
