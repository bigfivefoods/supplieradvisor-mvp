'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Receipts"
      description="Receipts Module with ratings, RIAD, and on-chain records."
      backHref="/dashboard/procurement"
    />
  );
}
