'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Contracts"
      description="Supplier Contracts with ratings, RIAD, and on-chain records."
      backHref="/dashboard/suppliers"
    />
  );
}
