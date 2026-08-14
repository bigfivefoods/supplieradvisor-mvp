'use client';

import { HiregraphWorkbench } from '@/components/hire/HiregraphWorkbench';
import { AdvisorMemberAccounts } from '@/components/advisors/AdvisorMemberAccounts';

export default function HiregraphAccountsPage() {
  return (
    <HiregraphWorkbench
      title="Hirer accounts"
      titleAccent="pay & proof"
      description="Charge hirers, collect Paystack or proof of payment, and post receipts to Customers invoices."
    >
      <AdvisorMemberAccounts module="hiregraph" />
    </HiregraphWorkbench>
  );
}
