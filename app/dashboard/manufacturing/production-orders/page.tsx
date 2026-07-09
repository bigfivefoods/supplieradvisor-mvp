'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Production Orders"
      description="Create, schedule, track, and manage all production orders and work orders."
      backHref="/dashboard/manufacturing"
    />
  );
}
