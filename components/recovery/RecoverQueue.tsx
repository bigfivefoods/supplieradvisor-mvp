'use client';

import { ListChecks } from 'lucide-react';
import { RECOVER_PENDING_BANNER } from '@/lib/recovery/brand';
import { queueNavLabel } from '@/lib/recovery/roles';
import {
  RecoverBanner,
  RecoverButton,
  RecoverEmpty,
  RecoverRoleChip,
  RecoverScreen,
} from './RecoverChrome';
import { useRecoverDesk } from './useRecoverDesk';

export function RecoverQueue() {
  const { desk, error, loading } = useRecoverDesk();
  const title = desk ? queueNavLabel(desk.role) : 'Queue';
  const manager = desk?.role === 'owner' || desk?.role === 'manager';
  return (
    <RecoverScreen
      title={title}
      description="Accounts assigned for work. This version has no account book yet."
      action={desk ? <RecoverRoleChip role={desk.role} /> : null}
    >
      {error ? <RecoverBanner testId="recover-banner-error" tone="error">{error}</RecoverBanner> : null}
      {loading ? (
        <div data-testid="recover-queue-skeleton" className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : desk && !desk.ready ? (
        <RecoverBanner testId="recover-banner-pending" tone="pending">
          {RECOVER_PENDING_BANNER}
        </RecoverBanner>
      ) : (
        <RecoverEmpty
          testId="recover-queue-empty"
          icon={ListChecks}
          title={title}
          body="No accounts assigned yet. Accounts appear here once a creditor book is imported."
          legend={['Account', 'Creditor', 'Next action', 'Clock']}
          action={
            manager ? (
              <RecoverButton href="/dashboard/recovergraph/creditors">Open creditors</RecoverButton>
            ) : undefined
          }
        />
      )}
    </RecoverScreen>
  );
}
