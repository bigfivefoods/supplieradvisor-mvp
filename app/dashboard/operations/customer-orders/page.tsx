'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Customer Orders"
      description="Track and fulfill customer orders."
      backHref="/dashboard/operations"
    />
  );
}
