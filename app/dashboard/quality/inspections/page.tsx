'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Inspections"
      description="Quality capability on the roadmap — use live inventory lots and operations exceptions for trust and holds today."
      backHref="/dashboard/quality"
      primaryHref="/dashboard/operations/exceptions"
      primaryLabel="Open ops exceptions"
    />
  );
}
