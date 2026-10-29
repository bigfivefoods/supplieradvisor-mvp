'use client';

import GymDebitFlow from '@/components/fitness/netcash/GymDebitFlow';
import { SettingsLive } from '@/components/fitness/netcash/LiveDesks';
import { FitgraphWorkbench } from '@/components/fitness/FitgraphWorkbench';

export default function NetcashSettingsPage() {
  return (
    <FitgraphWorkbench
      title="Netcash"
      titleAccent="test mode"
      description="Merchant account and Debit Order service key for this gym only. The key is sealed on the server. Test mode is the default and live calls are refused."
    >
      <GymDebitFlow />
      <SettingsLive />
    </FitgraphWorkbench>
  );
}
