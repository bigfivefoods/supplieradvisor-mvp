'use client';

import {
  PlatformGateState,
  PlatformShell,
  SystemReportView,
  usePlatformConsole,
} from '@/components/platform/PlatformConsole';

/** System reports — health, integrations, schema, Paystack, CIPC, deploy. */
export default function PlatformSystemReportPage() {
  const { data, loading, error, forbidden, load } = usePlatformConsole();

  return (
    <PlatformShell
      title="System reports"
      description="Infrastructure, integrations, schema probes, payment rails, and production readiness."
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
        <SystemReportView system={data.system} />
      ) : null}
    </PlatformShell>
  );
}
