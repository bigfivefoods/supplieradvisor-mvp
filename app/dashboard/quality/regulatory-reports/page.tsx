'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Regulatory Reports"
      description="Quality capability on the roadmap — use live inventory lots and operations exceptions for trust and holds today."
      backHref="/dashboard/quality"
      primaryHref="/dashboard/quality"
      primaryLabel="Back to quality hub"
    />
  );
}
