'use client';

import ComingSoon from '@/components/ComingSoon';

export default function CustomerContractsPage() {
  return (
    <ComingSoon
      title="Customer Contracts"
      description="Manage commercial agreements, SLAs, and contract renewals with your customers."
      backHref="/dashboard/customers"
      features={[
        'Contract repository with version history',
        'Renewal and expiry alerts',
        'Link contracts to orders and invoices',
      ]}
    />
  );
}
