'use client';

import { FitgraphWorkbench } from '@/components/fitness/FitgraphWorkbench';
import { AdvisorMemberAccounts } from '@/components/advisors/AdvisorMemberAccounts';

export default function FitgraphAccountsPage() {
  return (
    <FitgraphWorkbench
      title="Member accounts"
      titleAccent="pay & proof"
      description="Charge members, collect Paystack or proof of payment, and post receipts to Customers invoices."
    >
      <AdvisorMemberAccounts module="fitgraph" />
    </FitgraphWorkbench>
  );
}
