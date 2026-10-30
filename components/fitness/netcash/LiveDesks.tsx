'use client';

import { useEffect, useState } from 'react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { AccessHold, AuditEvent, BillingLine, BillingRun, Mandate, NetcashSettings } from '@/lib/fitness/netcash/types';
import type { CollectionsOverview } from '@/lib/fitness/netcash/overview';
import { CollectionsDesk, MandateDesk, ModeBanner, RunsDesk, StatementDesk, btn, ghost } from '@/components/fitness/netcash/Desks';

type Book = {
  overview?: CollectionsOverview;
  runs?: BillingRun[];
  lines?: BillingLine[];
  holds?: AccessHold[];
  audit?: AuditEvent[];
  mandates?: Mandate[];
  settings?: NetcashSettings;
  error?: string;
};

function useBook(path: string) {
  const [book, setBook] = useState<Book>({});
  const [loading, setLoading] = useState(true);
  const companyId = typeof window === 'undefined' ? null : getSelectedCompanyId();
  useEffect(() => {
    const id = getSelectedCompanyId();
    if (!id) {
      setLoading(false);
      setBook({ error: 'Select a company to open debit orders.' });
      return;
    }
    let cancelled = false;
    fetch(`${path}${path.includes('?') ? '&' : '?'}companyId=${id}`, { credentials: 'include' })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as Book;
        if (!response.ok) throw new Error(data.error || 'Could not load debit orders.');
        if (!cancelled) setBook(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setBook({ error: error instanceof Error ? error.message : 'Could not load debit orders.' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return { book, loading, companyId };
}

function Note({ loading, error }: { loading: boolean; error?: string }) {
  if (loading) return <p className="text-sm font-bold text-slate-500">Loading debit orders…</p>;
  if (!error) return null;
  return <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0f172a]">{error}</p>;
}

export function CollectionsLive() {
  const { book, loading } = useBook('/api/fitness/netcash/overview');
  if (loading || book.error || !book.overview) return <Note loading={loading} error={book.error} />;
  return (
    <CollectionsDesk
      overview={book.overview}
      lines={book.lines || []}
      holds={book.holds || []}
      mode={book.settings?.mode || 'test'}
      statementHref={(memberId) => `/dashboard/fitgraph/collections/statement?member=${encodeURIComponent(memberId)}`}
    />
  );
}

async function postJson(path: string, body: Record<string, unknown>) {
  const companyId = getSelectedCompanyId();
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, companyId }),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || 'Request failed.');
}

export function MandatesLive() {
  const { book, loading } = useBook('/api/fitness/netcash/mandates');
  const [note, setNote] = useState('');
  if (loading || book.error) return <Note loading={loading} error={book.error} />;
  return (
    <div>
      {note ? <p className="mb-3 text-sm font-bold">{note}</p> : null}
      <MandateDesk mandates={book.mandates || []} />
      <div className="mt-4 flex flex-wrap gap-2">
        {(book.mandates || []).filter((mandate) => mandate.status === 'pending' && mandate.validationStatus === 'valid').map((mandate) => (
          <button
            key={mandate.id}
            type="button"
            className={btn}
            onClick={() => {
              void fetch(`/api/fitness/netcash/mandates/${mandate.id}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId: getSelectedCompanyId(), status: 'active' }),
              }).then(async (response) => {
                const data = (await response.json().catch(() => ({}))) as { error?: string };
                setNote(response.ok ? `${mandate.memberName} is on the masterfile.` : data.error || 'Could not activate.');
              });
            }}
          >
            Activate {mandate.memberName}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RunsLive() {
  const { book, loading } = useBook('/api/fitness/netcash/runs');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading || book.error) return <Note loading={loading} error={book.error} />;
  const preview = (book.runs || []).find((run) => run.status === 'preview' || run.status === 'polling' || run.status === 'submitted');
  async function act(action: 'preview' | 'approve' | 'submit' | 'poll') {
    setBusy(true);
    setNote('');
    try {
      if (action === 'preview') await postJson('/api/fitness/netcash/runs', { action: 'preview' });
      else if (preview) await postJson(`/api/fitness/netcash/runs/${preview.id}`, { action });
      setNote(action === 'preview' ? 'Preview updated.' : action === 'approve' ? 'This run is approved. It can be submitted.' : action === 'submit' ? 'Batch submitted in test mode.' : 'Results fetched.');
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={busy} onClick={() => void act('preview')}>Preview run</button>
        <button type="button" className={ghost} disabled={busy || !preview} onClick={() => void act('approve')}>Approve run</button>
        <button type="button" className={ghost} disabled={busy || !preview} onClick={() => void act('submit')}>Submit batch</button>
        <button type="button" className={ghost} disabled={busy || !preview} onClick={() => void act('poll')}>Fetch results</button>
        <a className={ghost} href={`/api/fitness/netcash/export?companyId=${getSelectedCompanyId() || ''}&format=csv`}>Export CSV</a>
      </div>
      {note ? <p className="mb-3 text-sm font-bold">{note}</p> : null}
      <RunsDesk runs={book.runs || []} audit={book.audit || []} />
    </div>
  );
}

export function SettingsLive() {
  const { book, loading } = useBook('/api/fitness/netcash/settings');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'test' | 'live'>('test');
  const [debitDay, setDebitDay] = useState('1');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!book.settings || loaded) return;
    setMode(book.settings.mode);
    setDebitDay(String(book.settings.debitDay));
    setLoaded(true);
  }, [book.settings, loaded]);
  if (loading || book.error || !book.settings) return <Note loading={loading} error={book.error} />;
  return (
    <form
      className="max-w-xl space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const companyId = getSelectedCompanyId();
        void fetch('/api/fitness/netcash/settings', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            mode,
            debitDay: Number(debitDay),
          }),
        }).then(async (response) => {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          setNote(response.ok ? 'Schedule saved.' : data.error || 'Could not save.');
        });
      }}
    >
      <ModeBanner mode={mode} />
      <label className="block text-sm font-bold">Debit day
        <input className="mt-1 w-full min-h-11 rounded-2xl border border-slate-200 px-3" inputMode="numeric" value={debitDay} onChange={(event) => setDebitDay(event.target.value)} />
      </label>
      <div className="flex gap-2">
        <button type="button" className={mode === 'test' ? btn : ghost} onClick={() => setMode('test')}>Test</button>
        <button type="button" className={mode === 'live' ? btn : ghost} onClick={() => setMode('live')}>Live</button>
      </div>
      <button type="submit" className={btn}>Save schedule</button>
      {note ? <p className="text-sm font-bold">{note}</p> : null}
    </form>
  );
}

export function StatementLive({ memberId }: { memberId: string }) {
  const { book, loading } = useBook('/api/fitness/netcash/overview');
  if (loading || book.error) return <Note loading={loading} error={book.error} />;
  const lines = (book.lines || []).filter((line) => line.memberId === memberId);
  const name = lines[0]?.memberName || 'Member';
  return <StatementDesk memberName={name} lines={lines} runs={book.runs || []} />;
}
