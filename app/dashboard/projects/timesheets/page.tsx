'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Timesheets"
      description="Timesheets with ratings, RIAD, and on-chain records."
      backHref="/dashboard/projects"
    />
  );
}
