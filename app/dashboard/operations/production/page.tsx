'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Production"
      description="Monitor production orders, recipes, and output."
      backHref="/dashboard/operations"
    />
  );
}
