'use client';

import { PsychiatrygraphWorkbench } from '@/components/clinic/PsychiatrygraphWorkbench';
import { AdvisorMemberAccounts } from '@/components/advisors/AdvisorMemberAccounts';

export default function PsychiatrygraphAccountsPage() {
  return (
    <PsychiatrygraphWorkbench
      title="Patient accounts"
      titleAccent="pay & proof"
      description="Charge patients, collect card / Apple Pay (settles to your bank, 1% admin) or proof of payment, and post receipts to Customers invoices."
    >
      <AdvisorMemberAccounts module="psychiatrygraph" />
    </PsychiatrygraphWorkbench>
  );
}
