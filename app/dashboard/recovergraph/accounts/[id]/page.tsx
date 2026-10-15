'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { AccountView } from '@/components/recovery/book-views';
import { useLiveAccounts } from '@/components/recovery/live-book';
import { useRecoverDesk } from '@/components/recovery/useRecoverDesk';
import { capabilitiesFor } from '@/lib/recovery/roles';

export default function RecoverAccountPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');
  const { desk, loading, error, save } = useRecoverDesk();
  const live = useLiveAccounts({ id });
  const role = desk?.role || 'viewer';
  const caps = desk?.capabilities || capabilitiesFor(role);
  const account = live.book.accounts.find((row) => row.id === id) || null;
  const [revealed, setRevealed] = useState('');
  const [notice, setNotice] = useState('');
  return (
    <AccountView
      phase={loading ? 'loading' : error ? 'error' : live.phase}
      account={account}
      role={role}
      caps={caps}
      revealedId={revealed}
      notice={notice}
      onReveal={async (reason) => {
        const response = await fetch('/api/recovery/recovergraph/accounts', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ op: 'account.reveal_id', accountId: id, reason }),
        });
        const body = (await response.json().catch(() => null)) as { id_number?: string; error?: string; reason?: string } | null;
        if (!response.ok || !body?.id_number) {
          const message = body?.reason === 'pii_not_configured'
            ? 'Identity storage is not configured.'
            : body?.error || 'RecoverAdvisor® could not show that identity.';
          setNotice(message);
          return { message };
        }
        setRevealed(body.id_number);
        setNotice('This view was logged.');
        await live.reload();
        return { id_number: body.id_number };
      }}
      onNote={caps.canAddNote ? async (note) => {
        const ok = await save({ op: 'account.add_note', id, note_text: note });
        setNotice(ok ? 'Note recorded.' : 'RecoverAdvisor® could not save that note.');
        if (ok) await live.reload();
        return ok;
      } : undefined}
      onFlag={caps.canMutateAccounts ? async (flag, reason, clear) => {
        const ok = await save({ op: clear ? 'account.clear_flag' : 'account.set_flag', id, flag, reason });
        setNotice(ok ? (clear ? 'Flag cleared.' : 'Flag recorded.') : 'RecoverAdvisor® could not save that flag.');
        if (ok) await live.reload();
        return ok;
      } : undefined}
      onAdjust={caps.canMutateAccounts ? async (cents, reason) => {
        const ok = await save({ op: 'account.adjust', id, adjustment_cents: cents, reason });
        setNotice(ok ? 'Adjustment recorded.' : 'RecoverAdvisor® could not save that adjustment.');
        if (ok) await live.reload();
        return ok;
      } : undefined}
      onRecall={caps.canMutateAccounts ? async (closeReason) => {
        const ok = await save({ op: 'account.recall', id, close_reason: closeReason });
        setNotice(ok ? 'Account recalled.' : 'RecoverAdvisor® could not recall that account.');
        if (ok) await live.reload();
        return ok;
      } : undefined}
    />
  );
}
