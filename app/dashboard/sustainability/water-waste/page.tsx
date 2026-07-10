'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Water Waste"
      description="Sustainability metrics are on the roadmap. Trade and leadership already advance ethical sourcing outcomes."
      backHref="/dashboard/sustainability"
      primaryHref="/dashboard/suppliers"
      primaryLabel="Open suppliers (ethical trade)"
    />
  );
}
