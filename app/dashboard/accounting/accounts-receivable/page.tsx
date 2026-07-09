'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Accounts Receivable"
      description="Manage customer invoices, credit notes, collections, and aging reports."
      backHref="/dashboard/accounting"
    />
  );
}
