'use client';

import { DentalgraphWorkbench } from '@/components/dental/DentalgraphWorkbench';
import { AdvisorMemberAccounts } from '@/components/advisors/AdvisorMemberAccounts';

export default function DentalgraphAccountsPage() {
  return (
    <DentalgraphWorkbench
      title="Patient accounts"
      titleAccent="pay & proof"
      description="Charge patients, collect Paystack or proof of payment, and post receipts to Customers invoices."
    >
      <AdvisorMemberAccounts module="dentalgraph" />
    </DentalgraphWorkbench>
  );
}
