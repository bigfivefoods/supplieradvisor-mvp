'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Onboard Customers"
      description="Customer Onboarding with ratings, reviews, and on-chain verification."
      backHref="/dashboard/customers"
    />
  );
}
