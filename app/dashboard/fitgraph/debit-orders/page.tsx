'use client';

import GymDebitFlow from '@/components/fitness/netcash/GymDebitFlow';
import { MandatesLive } from '@/components/fitness/netcash/LiveDesks';
import { FitgraphWorkbench } from '@/components/fitness/FitgraphWorkbench';

export default function DebitOrdersPage() {
  return (
    <FitgraphWorkbench
      title="Debit orders"
      titleAccent="mandates"
      description="Signed member mandates for GymAdvisor®. The account number stays sealed. Activate a valid mandate to upload it on the Netcash masterfile."
    >
      <GymDebitFlow />
      <MandatesLive />
    </FitgraphWorkbench>
  );
}
