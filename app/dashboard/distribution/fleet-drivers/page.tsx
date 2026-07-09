'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Fleet & Drivers"
      description="Manage company fleet, vehicles, driver assignments, and compliance."
      backHref="/dashboard/distribution"
    />
  );
}
