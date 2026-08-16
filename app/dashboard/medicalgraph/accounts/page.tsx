'use client';

import { MedicalgraphWorkbench } from '@/components/clinic/MedicalgraphWorkbench';
import { AdvisorMemberAccounts } from '@/components/advisors/AdvisorMemberAccounts';

export default function MedicalgraphAccountsPage() {
  return (
    <MedicalgraphWorkbench
      title="Patient accounts"
      titleAccent="pay & proof"
      description="Charge patients, collect card / Apple Pay (settles to your bank, 1% admin) or proof of payment, and post receipts to Customers invoices."
    >
      <AdvisorMemberAccounts module="medicalgraph" />
    </MedicalgraphWorkbench>
  );
}
