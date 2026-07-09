'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Supplier Portal"
      description="Supplier Portal with ratings, RIAD, and on-chain records."
      backHref="/dashboard/suppliers"
    />
  );
}
