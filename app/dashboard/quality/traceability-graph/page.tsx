'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Traceability Graph"
      description="Traceability Graph with ratings, RIAD, and on-chain records."
      backHref="/dashboard/quality"
    />
  );
}
