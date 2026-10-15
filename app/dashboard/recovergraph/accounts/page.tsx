'use client';

import { AccountsView } from '@/components/recovery/book-views';
import { useLiveAccounts } from '@/components/recovery/live-book';
import { useRecoverDesk } from '@/components/recovery/useRecoverDesk';
import { capabilitiesFor } from '@/lib/recovery/roles';

export default function RecoverAccountsPage() {
  const { desk, loading, error } = useRecoverDesk();
  const live = useLiveAccounts();
  const phase = loading ? 'loading' : error ? 'error' : live.phase;
  const role = desk?.role || 'viewer';
  return (
    <AccountsView
      phase={phase}
      book={live.book}
      role={role}
      caps={desk?.capabilities || capabilitiesFor(role)}
      placedCount={live.placedCount}
    />
  );
}
