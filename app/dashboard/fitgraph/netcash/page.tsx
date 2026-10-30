'use client';

import { CredentialsLive } from '@/components/fitness/netcash/CredentialsCard';
import GymDebitFlow from '@/components/fitness/netcash/GymDebitFlow';
import { SettingsLive } from '@/components/fitness/netcash/LiveDesks';
import { FitgraphWorkbench } from '@/components/fitness/FitgraphWorkbench';

export default function NetcashSettingsPage() {
  return (
    <FitgraphWorkbench
      title="Netcash"
      titleAccent="test mode"
      description="Merchant account and Debit Order service key for this gym only. GymAdvisor® seals the key on SupplierAdvisor® and does not show it again. Test connection uses Netcash test mode. Live calls stay off."
    >
      <GymDebitFlow />
      <CredentialsLive />
      <SettingsLive />
    </FitgraphWorkbench>
  );
}
