'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Carriers"
      description="Manage carrier partners, contracts, rates, and performance metrics."
      backHref="/dashboard/distribution"
    />
  );
}
