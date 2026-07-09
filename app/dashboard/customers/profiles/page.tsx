'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Customer Profiles"
      description="Customer Profiles with ratings/reviews and on-chain records."
      backHref="/dashboard/customers"
    />
  );
}
