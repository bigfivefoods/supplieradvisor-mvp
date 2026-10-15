'use client';

import { useParams } from 'next/navigation';
import { AccountView } from '@/components/recovery/book-views';
import { useLiveAccounts } from '@/components/recovery/live-book';
import { useRecoverDesk } from '@/components/recovery/useRecoverDesk';
import { capabilitiesFor } from '@/lib/recovery/roles';

export default function RecoverAccountPage() {
  const params = useParams<{ id: string }>();
  const { desk, loading, error } = useRecoverDesk();
  const live = useLiveAccounts();
  const role = desk?.role || 'viewer';
  const account = live.book.accounts.find((row) => row.id === String(params?.id || '')) || null;
  return (
    <AccountView
      phase={loading ? 'loading' : error ? 'error' : live.phase}
      account={account}
      role={role}
      caps={desk?.capabilities || capabilitiesFor(role)}
    />
  );
}
