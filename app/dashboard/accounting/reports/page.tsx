'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Reports & Analytics"
      description="Financial statements, P&L, Balance Sheet, Cash Flow, and integrated Impact reports."
      backHref="/dashboard/accounting"
    />
  );
}
