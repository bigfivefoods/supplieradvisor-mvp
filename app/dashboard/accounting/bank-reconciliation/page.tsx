'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Bank & Reconciliation"
      description="Manage bank accounts, YOCO, crypto wallets, and automated bank reconciliation."
      backHref="/dashboard/accounting"
    />
  );
}
