'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Supplier Orders"
      description="Manage purchase orders and supplier deliveries."
      backHref="/dashboard/operations"
    />
  );
}
