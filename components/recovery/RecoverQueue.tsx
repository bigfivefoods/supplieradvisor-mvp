'use client';

import { ListChecks } from 'lucide-react';
import { queueNavLabel } from '@/lib/recovery/roles';
import { PendingArt, QueueArt } from './RecoverArt';
import {
  RecoverBanner,
  RecoverButton,
  RecoverDemoGate,
  RecoverEmpty,
  RecoverPendingBanner,
  RecoverRoleChip,
  RecoverScreen,
} from './RecoverChrome';
import { QueueBoard, queueRowsFromAccounts } from './RecoverPreviews';
import { useRecoverDesk, useRecoverIllustration } from './useRecoverDesk';

export function RecoverQueue() {
  const { desk, error, loading } = useRecoverDesk();
  const illustration = useRecoverIllustration();
  const title = desk ? queueNavLabel(desk.role) : 'Queue';
  const manager = desk?.role === 'owner' || desk?.role === 'manager';
  return (
    <RecoverScreen
      title={title}
      description="Accounts assigned for work. This version has no account book yet."
      action={desk ? <RecoverRoleChip role={desk.role} /> : null}
    >
      {error ? <RecoverBanner testId="recover-banner-error" tone="error">{error}</RecoverBanner> : null}
      <RecoverDemoGate desk={desk} />
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
        <div className="space-y-4">
          <RecoverPendingBanner role={desk.role} />
          <RecoverEmpty
            testId="recover-pending-stage"
            icon={ListChecks}
            title="No accounts yet"
            body="Assigned accounts stay hidden until the database setup is approved."
            art={<PendingArt />}
          />
        </div>
      ) : illustration ? (
        <QueueBoard rows={queueRowsFromAccounts(illustration.accounts)} />
      ) : (
        <RecoverEmpty
          testId="recover-queue-empty"
          icon={ListChecks}
          title={title}
          body="No accounts assigned yet. Accounts appear here once a creditor book is imported."
          art={<QueueArt />}
          action={
            manager ? (
              <RecoverButton href="/dashboard/recovergraph/creditors">Open creditors</RecoverButton>
            ) : (
              <RecoverButton href="/dashboard/recovergraph">Back to the desk</RecoverButton>
            )
          }
        />
      )}
    </RecoverScreen>
  );
}
