'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Pulse Dashboard"
      description="Real-time view of operational, financial, supply chain, and impact metrics across the business."
      backHref="/dashboard/intelligence"
    />
  );
}
