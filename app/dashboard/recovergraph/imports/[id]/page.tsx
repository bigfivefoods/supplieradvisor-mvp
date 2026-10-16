'use client';

import { ImportView } from '@/components/recovery/book-views';
import { useLiveAccounts } from '@/components/recovery/live-book';
import { useRecoverDesk } from '@/components/recovery/useRecoverDesk';
import { emptyMemory } from '@/lib/recovery/preview-memory';
import { capabilitiesFor } from '@/lib/recovery/roles';

export default function RecoverImportDetailPage() {
  const { desk, loading, error } = useRecoverDesk();
  const live = useLiveAccounts();
  const role = desk?.role || 'viewer';
  return (
    <ImportView
      phase={loading ? 'loading' : error ? 'error' : live.phase}
      book={emptyMemory()}
      caps={desk?.capabilities || capabilitiesFor(role)}
    />
  );
}
