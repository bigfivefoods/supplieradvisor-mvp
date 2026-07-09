'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Customer Portal"
      description="Customer Portal with ratings, RIAD, and on-chain records."
      backHref="/dashboard/customers"
    />
  );
}
