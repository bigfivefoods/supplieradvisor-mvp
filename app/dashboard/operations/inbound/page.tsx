'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Inbound"
      description="Track goods received into warehouses and containers."
      backHref="/dashboard/operations"
    />
  );
}
