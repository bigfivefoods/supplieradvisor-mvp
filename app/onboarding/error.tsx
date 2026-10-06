'use client';

import RouteError from '@/components/app-shell/RouteError';

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} backHref="/onboarding" backLabel="Back to onboarding" />;
}
