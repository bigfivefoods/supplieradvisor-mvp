'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  PlatformGateState,
  PlatformShell,
} from '@/components/platform/PlatformConsole';
import { SaMemberAccessReportView } from '@/components/platform/SaMemberAccessReport';
import { getCanonicalUserId } from '@/lib/auth/identity';
import type { SaMemberAccessReport } from '@/lib/system/sa-member-access-report';

export default function PlatformSaMembersPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const privyEmail =
    user?.email?.address ||
    (user as { google?: { email?: string } } | null)?.google?.email ||
    null;

  const [report, setReport] = useState<SaMemberAccessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (privyUserId) q.set('privyUserId', privyUserId);
      if (privyEmail) q.set('email', String(privyEmail).toLowerCase());
      const res = await fetch(`/api/system/platform-console/sa-members?${q}`, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          ...(privyUserId ? { 'x-privy-user-id': privyUserId } : {}),
          ...(privyEmail
            ? { 'x-platform-email': String(privyEmail).toLowerCase() }
            : {}),
        },
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setForbidden(true);
        setReport(null);
        setError(json.error || 'Not authorised');
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load members');
      setForbidden(false);
      setReport(json.report || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [privyUserId, privyEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PlatformShell
      title="SA Member access"
      description="Who signed in as a consumer, when they last opened the app, which gym / clinic / hire PWA they used, and how long they stayed."
      onRefresh={() => void load()}
      loading={loading}
    >
      <PlatformGateState
        loading={loading}
        forbidden={forbidden}
        error={error}
        onRetry={() => void load()}
      />
      {!loading && !forbidden && !error && report ? (
        <SaMemberAccessReportView report={report} />
      ) : null}
    </PlatformShell>
  );
}
