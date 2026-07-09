'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Regulatory Reports"
      description="Regulatory Reports with ratings, RIAD, and on-chain records."
      backHref="/dashboard/quality"
    />
  );
}
