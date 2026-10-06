'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function MeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/me" backLabel="Back to SA Member" />;
}
