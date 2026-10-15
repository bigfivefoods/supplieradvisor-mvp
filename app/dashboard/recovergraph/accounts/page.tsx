'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccountsView } from '@/components/recovery/book-views';
import { useLiveAccounts } from '@/components/recovery/live-book';
import { useRecoverDesk } from '@/components/recovery/useRecoverDesk';
import { capabilitiesFor } from '@/lib/recovery/roles';

export default function RecoverAccountsPage() {
  const router = useRouter();
  const { desk, loading, error, save } = useRecoverDesk();
  const [filters, setFilters] = useState({ q: '', state: '', assigned: '' });
  const [history, setHistory] = useState<{ after: string; afterId: string }[]>([{ after: '', afterId: '' }]);
  const cursor = history[history.length - 1];
  const live = useLiveAccounts({ ...filters, after: cursor.after, afterId: cursor.afterId });
  const phase = loading ? 'loading' : error ? 'error' : live.phase;
  const role = desk?.role || 'viewer';
  const canAssign = role === 'owner' || role === 'manager';
  const collectors = (desk?.staff || []).filter((row) => row.status === 'active' && row.role === 'collector');
  return (
    <AccountsView
      phase={phase}
      book={live.book}
      role={role}
      caps={desk?.capabilities || capabilitiesFor(role)}
      placedCount={desk?.book?.placedCount ?? live.placedCount}
      stats={desk?.book ?? null}
      assignees={collectors.map((row) => ({ id: row.id, label: row.email }))}
      serverQuery
      duplicates={live.duplicates}
      nextCursor={live.next}
      hasPrevious={history.length > 1}
      onQuery={(next) => {
        if (next.back) {
          setHistory((items) => (items.length > 1 ? items.slice(0, -1) : items));
          return;
        }
        setFilters({ q: next.q, state: next.state, assigned: next.assigned });
        if (!next.after) {
          setHistory([{ after: '', afterId: '' }]);
          return;
        }
        setHistory((items) => [...items, { after: next.after || '', afterId: next.afterId || '' }]);
      }}
      onOpen={(id) => router.push(`/dashboard/recovergraph/accounts/${id}`)}
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
