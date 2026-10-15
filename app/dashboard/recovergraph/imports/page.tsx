'use client';

import { ImportView } from '@/components/recovery/book-views';
import { useLiveBatches } from '@/components/recovery/live-book';
import { useRecoverDesk } from '@/components/recovery/useRecoverDesk';
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
  const live = useLiveBatches();
  const role = desk?.role || 'viewer';
  return (
    <ImportView
      phase={loading || live.phase === 'loading' ? 'loading' : error ? 'error' : live.phase}
      book={live.book}
      caps={desk?.capabilities || capabilitiesFor(role)}
      onCommit={async (text) => {
        await postImport({ action: 'commit', csv: text, file_name: 'book.csv' });
        await live.reload();
      }}
      onRollback={async (id) => {
        await postImport({ action: 'rollback', batch_id: id });
        await live.reload();
      }}
      onLoadDemo={async () => {
        await postImport({ action: 'load_demo' });
        await live.reload();
      }}
      onClearDemo={async () => {
        await postImport({ action: 'clear_demo' });
        await live.reload();
      }}
    />
  );
}
