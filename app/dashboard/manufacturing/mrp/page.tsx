'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Material Requirements Planning (MRP)"
      description="Calculate material needs, shortages, and generate planned orders based on demand."
      backHref="/dashboard/manufacturing"
    />
  );
}
