'use client';

import { PhysiographWorkbench } from '@/components/clinic/PhysiographWorkbench';
import { AdvisorMemberAccounts } from '@/components/advisors/AdvisorMemberAccounts';

export default function PhysiographAccountsPage() {
  return (
    <PhysiographWorkbench
      title="Patient accounts"
      titleAccent="pay & proof"
      description="Charge patients, collect card / Apple Pay (settles to your bank, 1% admin) or proof of payment, and post receipts to Customers invoices."
    >
      <AdvisorMemberAccounts module="physiograph" />
    </PhysiographWorkbench>
  );
}
