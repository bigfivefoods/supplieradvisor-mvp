'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function MemberError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/member" backLabel="Back to member area" />;
}
