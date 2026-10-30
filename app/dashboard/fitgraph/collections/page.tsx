'use client';

import GymDebitFlow from '@/components/fitness/netcash/GymDebitFlow';
import { CollectionsLive } from '@/components/fitness/netcash/LiveDesks';
import { FitgraphWorkbench } from '@/components/fitness/FitgraphWorkbench';

export default function CollectionsPage() {
  return (
    <FitgraphWorkbench
      title="Collections"
      titleAccent="debit orders"
      description="Expected against collected for this gym. Unpaid reason codes, the next run, and each member statement sit with SupplierAdvisor® finance."
    >
      <GymDebitFlow />
      <CollectionsLive />
    </FitgraphWorkbench>
  );
}
