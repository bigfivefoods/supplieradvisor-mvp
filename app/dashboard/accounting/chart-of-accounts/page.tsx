'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Chart of Accounts"
      description="Manage your flexible, multi-dimensional Chart of Accounts with project, entity, and impact tagging."
      backHref="/dashboard/accounting"
    />
  );
}
