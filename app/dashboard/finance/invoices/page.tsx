'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Invoices & Payments"
      description="Invoice creation, approvals, and payment tracking module.."
      backHref="/dashboard/finance"
    />
  );
}
