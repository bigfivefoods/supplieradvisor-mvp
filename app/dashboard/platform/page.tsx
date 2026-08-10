'use client';

import {
  PlatformGateState,
  PlatformOverview,
  PlatformShell,
  usePlatformConsole,
} from '@/components/platform/PlatformConsole';

/**
 * SupplierAdvisor platform admin console — system-wide control plane.
 * Owners: craig@bigfivefoods.com · craig@bigfivegroup.africa
 */
export default function PlatformConsolePage() {
  const { data, loading, error, forbidden, load, switchToPlatform } =
    usePlatformConsole();

  return (
    <PlatformShell
      title="Platform"
      description="Admin portal for supplieradvisor.com — how the whole system is working."
      onRefresh={() => void load()}
      loading={loading}
    >
      <PlatformGateState
        loading={loading}
        forbidden={forbidden}
        error={error}
        onRetry={() => void load()}
      />
      {!loading && !forbidden && !error && data ? (
        <PlatformOverview data={data} onSwitch={switchToPlatform} />
      ) : null}
    </PlatformShell>
  );
}
