'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Outbound Logistics"
      description="Manage outbound shipments, order fulfillment, and final-mile delivery."
      backHref="/dashboard/distribution"
    />
  );
}
