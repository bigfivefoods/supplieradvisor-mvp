'use client';

import { MedicalgraphWorkbench } from '@/components/clinic/MedicalgraphWorkbench';
import { AdvisorMemberAccounts } from '@/components/advisors/AdvisorMemberAccounts';

export default function MedicalgraphAccountsPage() {
  return (
    <MedicalgraphWorkbench
      title="Patient accounts"
      titleAccent="pay & proof"
      description="Charge patients, collect Paystack or proof of payment, and post receipts to Customers invoices."
    >
      <AdvisorMemberAccounts module="medicalgraph" />
    </MedicalgraphWorkbench>
  );
}
