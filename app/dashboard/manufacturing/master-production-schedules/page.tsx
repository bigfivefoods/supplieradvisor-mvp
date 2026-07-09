'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Master Production Schedules"
      description="Plan and schedule production across time horizons and demand forecasts."
      backHref="/dashboard/manufacturing"
    />
  );
}
