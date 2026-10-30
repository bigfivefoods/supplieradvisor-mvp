'use client';

import GymDebitFlow from '@/components/fitness/netcash/GymDebitFlow';
import { RunsLive } from '@/components/fitness/netcash/LiveDesks';
import { FitgraphWorkbench } from '@/components/fitness/FitgraphWorkbench';

export default function BillingRunsPage() {
  return (
    <FitgraphWorkbench
      title="Billing runs"
      titleAccent="preview first"
      description="Preview the month, check the action date, then submit one Netcash batch. The audit log keeps every submission."
    >
      <GymDebitFlow />
      <RunsLive />
    </FitgraphWorkbench>
  );
}
