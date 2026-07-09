'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Journal Entries"
      description="Create and manage manual and automated journal entries with on-chain anchoring and full audit trail."
      backHref="/dashboard/accounting"
    />
  );
}
