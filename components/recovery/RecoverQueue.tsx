'use client';

import { ListChecks } from 'lucide-react';
import { RECOVER_PENDING_BANNER } from '@/lib/recovery/brand';
import { queueNavLabel } from '@/lib/recovery/roles';
import { PendingArt, QueueArt } from './RecoverArt';
import {
  RecoverBanner,
  RecoverButton,
  RecoverEmpty,
  RecoverRoleChip,
  RecoverSample,
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
        <div className="space-y-4">
          <RecoverBanner testId="recover-banner-pending" tone="pending">
            {RECOVER_PENDING_BANNER}
          </RecoverBanner>
          <RecoverEmpty
            testId="recover-pending-stage"
            icon={ListChecks}
            title="The queue is waiting"
            body="Assigned accounts stay hidden until the database setup is approved."
            art={<PendingArt />}
            preview={
              <RecoverSample title="How a queue row will look">
                <div className="grid gap-2">
                  {['Sample account', 'Sample creditor', 'Sample next step'].map((label) => (
                    <div
                      key={label}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[#e2e8f0] bg-white px-3"
                    >
                      <span className="text-sm font-semibold text-slate-900">{label}</span>
                      <span className="text-sm font-black tabular-nums text-slate-600">—</span>
                    </div>
                  ))}
                </div>
              </RecoverSample>
            }
          />
        </div>
      ) : (
        <RecoverEmpty
          testId="recover-queue-empty"
          icon={ListChecks}
          title={title}
          body="No accounts assigned yet. Accounts appear here once a creditor book is imported."
          legend={['Account', 'Creditor', 'Next action', 'Clock']}
          art={<QueueArt />}
          action={
            manager ? (
              <RecoverButton href="/dashboard/recovergraph/creditors">Open creditors</RecoverButton>
            ) : (
              <RecoverButton href="/dashboard/recovergraph">Back to the desk</RecoverButton>
            )
          }
          preview={
            <RecoverSample title="How a queue row will look">
              <div className="grid gap-2">
                {['Sample account', 'Sample creditor', 'Sample next step'].map((label) => (
                  <div
                    key={label}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[#e2e8f0] bg-white px-3"
                  >
                    <span className="text-sm font-semibold text-slate-900">{label}</span>
                    <span className="text-sm font-black tabular-nums text-slate-600">—</span>
                  </div>
                ))}
              </div>
            </RecoverSample>
          }
        />
      )}
    </RecoverScreen>
  );
}
