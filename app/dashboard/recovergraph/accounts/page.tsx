'use client';

import { AccountsView } from '@/components/recovery/book-views';
import { useLiveAccounts } from '@/components/recovery/live-book';
import { useRecoverDesk } from '@/components/recovery/useRecoverDesk';
import { capabilitiesFor } from '@/lib/recovery/roles';

export default function RecoverAccountsPage() {
  const { desk, loading, error, save } = useRecoverDesk();
  const live = useLiveAccounts();
  const phase = loading ? 'loading' : error ? 'error' : live.phase;
  const role = desk?.role || 'viewer';
  const canAssign = role === 'owner' || role === 'manager';
  return (
    <AccountsView
      phase={phase}
      book={live.book}
      role={role}
      caps={desk?.capabilities || capabilitiesFor(role)}
      placedCount={live.placedCount}
      assignees={(desk?.staff || []).filter((row) => row.status === 'active').map((row) => ({ id: row.id, label: row.email }))}
      onBulkAssign={
        canAssign
          ? async (ids, staffId) => {
              const ok = await save({ op: 'account.bulk_assign', ids, staff_id: staffId, team_id: null });
              if (ok) await live.reload();
              return ok;
            }
          : undefined
      }
      onAssign={
        canAssign
          ? async (accountId, staffId) => {
              const ok = await save({ op: 'account.assign', id: accountId, staff_id: staffId, team_id: null });
              if (ok) await live.reload();
              return ok;
            }
          : undefined
      }
      onMerge={
        canAssign
          ? async (sourceId, targetId) => {
              const ok = await save({ op: 'debtor.merge', source_id: sourceId, target_id: targetId });
              if (ok) await live.reload();
              return ok;
            }
          : undefined
      }
    />
  );
}
