'use client';

import {
  ManagementReportView,
  PlatformGateState,
  PlatformShell,
  usePlatformConsole,
} from '@/components/platform/PlatformConsole';

/** Management reports — companies, people, commercial, network, trade. */
export default function PlatformManagementReportPage() {
  const { data, loading, error, forbidden, load } = usePlatformConsole();

  return (
    <PlatformShell
      title="Management reports"
      description="Sign-ups (latest first), subscriptions, people, network density, trade funnel, and vertical module adoption."
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
        <ManagementReportView management={data.management} />
      ) : null}
    </PlatformShell>
  );
}
