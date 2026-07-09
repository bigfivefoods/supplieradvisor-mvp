'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Search Customers"
      description="Customer Search with ratings/reviews."
      backHref="/dashboard/customers"
    />
  );
}
