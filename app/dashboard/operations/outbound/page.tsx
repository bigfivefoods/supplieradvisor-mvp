'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Outbound"
      description="Manage dispatches, shipments, and deliveries."
      backHref="/dashboard/operations"
    />
  );
}
