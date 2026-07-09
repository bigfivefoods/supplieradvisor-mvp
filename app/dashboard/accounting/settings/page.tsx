'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Accounting Settings"
      description="Configure accounting periods, legal entities, currencies, approval workflows, and system defaults."
      backHref="/dashboard/accounting"
    />
  );
}
