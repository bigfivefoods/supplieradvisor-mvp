'use client';

import { VetgraphWorkbench } from '@/components/clinic/VetgraphWorkbench';
import { AdvisorMemberAccounts } from '@/components/advisors/AdvisorMemberAccounts';

export default function VetgraphAccountsPage() {
  return (
    <VetgraphWorkbench
      title="Patient accounts"
      titleAccent="pay & proof"
      description="Charge patients, collect card / Apple Pay (settles to your bank, 1% admin) or proof of payment, and post receipts to Customers invoices."
    >
      <AdvisorMemberAccounts module="vetgraph" />
    </VetgraphWorkbench>
  );
}
