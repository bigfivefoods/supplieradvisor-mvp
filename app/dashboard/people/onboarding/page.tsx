'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Onboarding"
      description="Onboarding Module with ratings, RIAD, and on-chain records."
      backHref="/dashboard/people"
    />
  );
}
