'use client';

import { FitgraphWorkbench } from '@/components/fitness/FitgraphWorkbench';
import { AdvisorMemberAccounts } from '@/components/advisors/AdvisorMemberAccounts';
import { AdvisorApplePaySetup } from '@/components/advisors/AdvisorApplePaySetup';

export default function FitgraphAccountsPage() {
  return (
    <FitgraphWorkbench
      title="Member accounts"
      titleAccent="pay & proof"
      description="Charge members, collect card / Apple Pay (settles to your bank, 1% admin) or proof of payment, and post receipts to Customers invoices."
    >
      <div className="space-y-5">
        <AdvisorApplePaySetup />
        <AdvisorMemberAccounts module="fitgraph" />
      </div>
    </FitgraphWorkbench>
  );
}
