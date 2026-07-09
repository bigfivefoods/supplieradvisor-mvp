'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Accounts Payable"
      description="Manage supplier invoices, bills, credit notes, approvals, and payment runs."
      backHref="/dashboard/accounting"
    />
  );
}
