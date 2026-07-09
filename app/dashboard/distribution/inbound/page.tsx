'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Inbound Logistics"
      description="Track inbound shipments, supplier deliveries, and warehouse receipts."
      backHref="/dashboard/distribution"
    />
  );
}
