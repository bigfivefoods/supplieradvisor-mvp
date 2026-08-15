'use client';

import {
  RetailgraphPage,
  RetailgraphRequired,
} from '@/components/retail/RetailgraphShell';
import { AdvisorMemberAccounts } from '@/components/advisors/AdvisorMemberAccounts';

export default function RetailAccountsPage() {
  return (
    <RetailgraphRequired>
      <RetailgraphPage
        title="Accounts"
        description="Raise a store bill, then present QR / NFC so the customer pays on SA Member — same desk flow as GymAdvisor and clinics."
      >
        <AdvisorMemberAccounts module="retailgraph" />
      </RetailgraphPage>
    </RetailgraphRequired>
  );
}
