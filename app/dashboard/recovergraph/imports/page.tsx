'use client';

import { ImportView } from '@/components/recovery/book-views';
import { useLiveAccounts } from '@/components/recovery/live-book';
import { useRecoverDesk } from '@/components/recovery/useRecoverDesk';
import { emptyMemory } from '@/lib/recovery/preview-memory';
import { capabilitiesFor } from '@/lib/recovery/roles';

async function postImport(body: Record<string, unknown>) {
  await fetch('/api/recovery/recovergraph/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
}

export default function RecoverImportsPage() {
  const { desk, loading, error } = useRecoverDesk();
  const live = useLiveAccounts();
  const role = desk?.role || 'viewer';
  return (
    <ImportView
      phase={loading ? 'loading' : error ? 'error' : live.phase}
      book={emptyMemory()}
      caps={desk?.capabilities || capabilitiesFor(role)}
      onCommit={(text) => postImport({ action: 'commit', csv: text, file_name: 'book.csv' })}
      onRollback={(id) => postImport({ action: 'rollback', batch_id: id })}
      onLoadDemo={() => postImport({ action: 'load_demo' })}
      onClearDemo={() => postImport({ action: 'clear_demo' })}
    />
  );
}
