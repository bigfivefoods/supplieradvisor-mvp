'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Payments"
      description="Run supplier payments, customer receipts, and manage multi-currency treasury operations."
      backHref="/dashboard/accounting"
    />
  );
}
