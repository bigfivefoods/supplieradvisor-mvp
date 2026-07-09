'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Fixed Assets"
      description="Manage asset register, depreciation schedules, revaluations, and disposals."
      backHref="/dashboard/accounting"
    />
  );
}
