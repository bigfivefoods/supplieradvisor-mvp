'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Risk Register"
      description="Risk Register with ratings, RIAD, and on-chain records."
      backHref="/dashboard/projects"
    />
  );
}
