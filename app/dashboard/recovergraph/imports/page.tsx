'use client';

import { useState } from 'react';
import { ImportView, type ImportActionResult, type ImportCommitInput } from '@/components/recovery/book-views';
import { useLiveBatches } from '@/components/recovery/live-book';
import { useRecoverDesk } from '@/components/recovery/useRecoverDesk';
import { capabilitiesFor } from '@/lib/recovery/roles';
import type { BookIssue } from '@/lib/recovery/import-book';

async function postImport(body: Record<string, unknown>): Promise<ImportActionResult & { sha?: string; summary?: ImportActionResult['summary']; errors?: BookIssue[] }> {
  const response = await fetch('/api/recovery/recovergraph/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    ok?: boolean;
    code?: string;
    created?: number;
    accounts?: number;
    sha?: string;
    errors?: BookIssue[];
    summary?: ImportActionResult['summary'];
    reason?: string;
  } | null;
  if (!response.ok || !payload || payload.error || payload.ok === false) {
    const message = payload?.error
      || (payload?.code === 'rollback_refused' ? 'That batch can no longer be rolled back.' : '')
      || (payload?.reason === 'migration_pending' ? 'Database setup is still pending.' : '')
      || 'RecoverAdvisor® could not finish that import.';
    return { ok: false, message, errors: payload?.errors, summary: payload?.summary, sha: payload?.sha };
  }
  if (payload.sha && !payload.code) {
    return { ok: true, message: 'Dry run finished.', sha: payload.sha, errors: payload.errors, summary: payload.summary };
  }
  if (payload.code === 'imported') return { ok: true, message: `Placed ${payload.created ?? 0} accounts.` };
  if (payload.code === 'rolled_back') return { ok: true, message: `Rolled back ${payload.accounts ?? 0} accounts.` };
  if (payload.code === 'loaded' || payload.code === 'already_loaded') return { ok: true, message: 'The fictional Harbour demo book is on this workspace.' };
  if (payload.code === 'cleared') return { ok: true, message: 'The demo book was cleared.' };
  if (payload.code === 'already_imported') return { ok: false, message: 'That file is already placed for this creditor.' };
  return { ok: true, message: 'Saved.' };
}

export default function RecoverImportsPage() {
  const { desk, loading, error } = useRecoverDesk();
  const live = useLiveBatches();
  const role = desk?.role || 'viewer';
  const [notice, setNotice] = useState('');
  const creditors = (desk?.creditors || []).map((row) => ({ id: row.id, name: row.name }));
  const mandates = (desk?.mandates || [])
    .filter((row) => row.status === 'active')
    .map((row) => ({ id: row.id, creditor_id: row.creditor_id, status: row.status, label: row.creditor_name }));
  return (
    <ImportView
      phase={loading || live.phase === 'loading' ? 'loading' : error ? 'error' : live.phase}
      book={live.book}
      caps={desk?.capabilities || capabilitiesFor(role)}
      creditors={creditors}
      mandates={mandates}
      notice={notice}
      onDryRun={async ({ csv, mapping }) => postImport({ action: 'dry_run', csv, mapping })}
      onCommit={async (input: ImportCommitInput) => {
        const result = await postImport({
          action: 'commit',
          csv: input.csv,
          file_name: input.fileName,
          creditor_id: input.creditorId,
          mandate_id: input.mandateId,
          mapping: input.mapping,
          dry_sha: input.drySha,
        });
        if (result.ok) await live.reload();
        setNotice(result.message);
        return result;
      }}
      onRollback={async (id) => {
        const result = await postImport({ action: 'rollback', batch_id: id });
        await live.reload();
        setNotice(result.message);
        return result;
      }}
      onLoadDemo={async () => {
        const result = await postImport({ action: 'load_demo' });
        await live.reload();
        setNotice(result.message);
        return result;
      }}
      onClearDemo={async () => {
        const result = await postImport({ action: 'clear_demo' });
        await live.reload();
        setNotice(result.message);
        return result;
      }}
    />
  );
}
