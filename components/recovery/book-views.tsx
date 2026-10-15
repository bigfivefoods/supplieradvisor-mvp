'use client';

import { useState } from 'react';
import { Building2, Flag, ListChecks, ShieldCheck, Upload } from 'lucide-react';
import { HARBOUR_BANNER, HARBOUR_CREDITORS, HARBOUR_TODAY } from '@/lib/recovery/harbour-seed';
import { parseBookCsv, suggestMapping, validateBook, type BookIssue } from '@/lib/recovery/import-book';
import { formatRecoverMoney } from '@/lib/recovery/money';
import type { MemoryAccount, MemoryBatch, MemoryBook } from '@/lib/recovery/preview-memory';
import { visibleAccounts } from '@/lib/recovery/preview-memory';
import type { RecoverCapabilities, RecoverCreditor, RecoverMandate, RecoverRole } from '@/lib/recovery/types';
import { RecoverBanner, RecoverDemoGate, RecoverEmpty, RecoverScreen } from './RecoverChrome';
import { recoverBtn, recoverCard, recoverField, recoverGhost } from './RecoverUi';

export type BookPhase = 'loading' | 'error' | 'ready' | 'pending';

const FLAG_LABEL: Record<string, string> = {
  debt_review: 'Debt review',
  deceased: 'Deceased estate',
  insolvency: 'Insolvency',
  represented: 'Represented',
  dispute: 'Dispute',
  do_not_contact: 'Do not contact',
};

export function BookBanner() {
  return (
    <div data-testid="recover-demo-data" role="status" className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-medium text-[#0f172a]">
      {HARBOUR_BANNER}
    </div>
  );
}

export function AccountsView({
  phase,
  book,
  role,
  caps,
  onOpen,
  showDemo = false,
  placedCount,
}: {
  phase: BookPhase;
  book: MemoryBook;
  role: RecoverRole;
  caps: RecoverCapabilities;
  onOpen?: (id: string) => void;
  showDemo?: boolean;
  placedCount?: number;
}) {
  const rows = visibleAccounts(book, role);
  return (
    <RecoverScreen title="Accounts" description="Placed accounts and their history." testId="recover-accounts">
      <RecoverDemoGate desk={null} />
      {showDemo ? <BookBanner /> : null}
      {phase === 'loading' ? <Skeleton testId="recover-accounts-loading" /> : null}
      {phase === 'pending' ? <PendingFeature /> : null}
      {phase === 'error' ? <RecoverBanner testId="recover-banner-error" tone="error">Accounts could not be opened.</RecoverBanner> : null}
      {phase === 'ready' && role === 'viewer' ? (
        <p data-testid="recover-accounts-counts" className="text-sm text-slate-700">
          {placedCount ?? book.accounts.length} placed accounts. Account rows stay off this view.
        </p>
      ) : null}
      {phase === 'ready' && role !== 'viewer' && rows.length === 0 ? (
        <RecoverEmpty
          testId="recover-accounts-empty"
          icon={ListChecks}
          title="No accounts yet"
          body="Accounts appear here after a book is placed."
          action={<a className={recoverBtn} href="/dashboard/recovergraph/imports">Open imports</a>}
        />
      ) : null}
      {phase === 'ready' && role !== 'viewer' && rows.length > 0 ? (
        <div data-testid="recover-accounts-list" className="grid gap-3">
          <div className="hidden min-w-0 grid-cols-[8rem_1fr_8rem_6rem] gap-3 px-2 text-xs font-bold uppercase tracking-wide text-slate-500 sm:grid">
            <span>Reference</span><span>Debtor</span><span className="text-right">Balance</span><span>State</span>
          </div>
          {[...rows]
            .sort((a, b) => (a.placed_at < b.placed_at ? 1 : a.placed_at > b.placed_at ? -1 : b.ref.localeCompare(a.ref)))
            .slice(0, 50)
            .map((row) => (
            <button key={row.id} type="button" data-testid={`recover-account-${row.ref}`} onClick={() => onOpen?.(row.id)} className={`${recoverCard} grid min-h-11 gap-1 px-4 py-3 text-left sm:grid-cols-[8rem_1fr_8rem_6rem] sm:items-center`}>
              <span className="font-black text-[#0f172a]">{row.ref}</span>
              <span>
                <span className="block text-sm font-semibold">{row.debtor_name}</span>
                <span className="block text-xs text-slate-600">{row.creditor_name} · {row.id_masked}</span>
              </span>
              <span className="text-right text-sm font-black tabular-nums">{formatRecoverMoney(row.balance_cents)}</span>
              <span className="text-xs font-bold uppercase">{row.state}{row.flags.length ? ' · flag' : ''}</span>
            </button>
          ))}
        </div>
      ) : null}
      {caps.canMutateAccounts ? null : null}
    </RecoverScreen>
  );
}

export function AccountView({
  phase,
  account,
  role,
  caps,
  onReveal,
  showDemo = false,
}: {
  phase: BookPhase;
  account: MemoryAccount | null;
  role: RecoverRole;
  caps: RecoverCapabilities;
  onReveal?: () => void;
  showDemo?: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <RecoverScreen title={account?.ref || 'Account'} description="Placed balance; payments are not recorded yet." testId="recover-account">
      {showDemo ? <BookBanner /> : null}
      {phase === 'loading' ? <Skeleton testId="recover-account-loading" /> : null}
      {phase === 'pending' ? <PendingFeature /> : null}
      {phase === 'error' ? <RecoverBanner testId="recover-banner-error" tone="error">This account could not be opened.</RecoverBanner> : null}
      {phase === 'ready' && !account ? (
        <RecoverEmpty testId="recover-account-empty" icon={ListChecks} title="No accounts yet" body="Choose an account from the list." action={<a className={recoverBtn} href="/dashboard/recovergraph/accounts">Back to accounts</a>} />
      ) : null}
      {phase === 'ready' && account ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            {account.flags.length ? (
              <div data-testid="recover-stop-banner" className="flex gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-[#0f172a]">
                <Flag className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  {account.flags.map((flag) => FLAG_LABEL[flag.key] || flag.key).join(', ')} recorded. Nothing in RecoverAdvisor® contacts a debtor yet.
                </p>
              </div>
            ) : null}
            <ol data-testid="recover-timeline" className="space-y-2">
              {account.events.map((event) => (
                <li key={`${event.type}-${event.at}`} className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm">
                  <span className="font-bold">{event.label}</span>
                  <span className="ml-2 text-slate-600">{event.at}</span>
                </li>
              ))}
              {account.notes.map((note) => (
                <li key={note.at} className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm">{note.text}</li>
              ))}
            </ol>
          </div>
          <div className="space-y-3">
            <section className={`${recoverCard} p-4`}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Placed balance</p>
              <p className="text-2xl font-black tabular-nums">{formatRecoverMoney(account.balance_cents)}</p>
              <p className="mt-1 text-xs text-slate-600">Placed balance; payments are not recorded yet.</p>
              <dl className="mt-3 space-y-1 text-sm">
                <Row k="Original" v={account.original_cents} />
                <Row k="Principal" v={account.principal_cents} />
                <Row k="Interest" v={account.interest_cents} />
                <Row k="Fees" v={account.fees_cents} />
                <Row k="Costs" v={account.costs_cents} />
                <Row k="Adjustment" v={account.adjustment_cents} />
              </dl>
            </section>
            <section className={`${recoverCard} p-4`}>
              <p className="font-black">{account.debtor_name}</p>
              <p className="text-sm text-slate-700">{account.id_masked}</p>
              <p className="mt-1 inline-flex rounded-full bg-cyan-50 px-2 py-1 text-xs font-bold text-[#0077b6]">Placed</p>
              {caps.canRevealId ? (
                <button type="button" className={`${recoverBtn} mt-3 w-full`} data-testid="recover-reveal" onClick={() => setReveal(true)}>
                  Reveal ID
                </button>
              ) : null}
              {reveal ? (
                <form data-testid="recover-reveal-prompt" className="mt-3 space-y-2" onSubmit={(event) => { event.preventDefault(); onReveal?.(); setReveal(false); }}>
                  <p className="text-xs text-slate-600">This view is logged.</p>
                  <input aria-label="Reason" className={recoverField} required />
                  <button className={recoverBtn} type="submit">Show the ID</button>
                </form>
              ) : null}
            </section>
            {caps.canSeeContacts ? (
              <ul className="space-y-2">
                {account.contacts.map((contact) => (
                  <li key={`${contact.kind}-${contact.value}`} className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm">
                    <span className="font-bold">{contact.kind}</span> {contact.value}
                    {contact.s129_delivery_method ? <span className="mt-1 block text-xs text-slate-600">Delivery method recorded: {contact.s129_delivery_method.replace('_', ' ')}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {role === 'agent' && caps.canAddNote ? <button type="button" className={recoverGhost}>Add note</button> : null}
          </div>
        </div>
      ) : null}
    </RecoverScreen>
  );
}

export function ImportView({
  phase,
  book,
  caps,
  onCommit,
  onRollback,
  onLoadDemo,
  onClearDemo,
  showDemo = false,
}: {
  phase: BookPhase;
  book: MemoryBook;
  caps: RecoverCapabilities;
  showDemo?: boolean;
  onCommit?: (text: string) => void;
  onRollback?: (id: string) => void;
  onLoadDemo?: () => void;
  onClearDemo?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [text, setText] = useState('');
  const [dry, setDry] = useState(false);
  const [issues, setIssues] = useState<BookIssue[]>([]);
  const [summary, setSummary] = useState<{ will_create: number; already_placed: number; errors: number; warnings: number } | null>(null);
  return (
    <RecoverScreen title="Imports & batches" description="Bring in a creditor's book." testId="recover-imports">
      {showDemo ? <BookBanner /> : null}
      {phase === 'loading' ? <Skeleton testId="recover-imports-loading" /> : null}
      {phase === 'pending' ? <PendingFeature /> : null}
      {phase === 'error' ? <RecoverBanner testId="recover-banner-error" tone="error">Imports could not be opened.</RecoverBanner> : null}
      {phase === 'ready' ? (
        <div data-testid="recover-import-wizard" className="space-y-4">
          <ol className="flex flex-wrap gap-2 text-xs font-bold">
            {['Creditor and mandate', 'File', 'Map columns', 'Dry run', 'Commit'].map((label, index) => (
              <li key={label} className={`rounded-full px-3 py-2 ${step === index + 1 ? 'bg-[#00b4d8] text-[#0f172a]' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>{index + 1} {label}</li>
            ))}
          </ol>
          {step === 1 ? (
            <div className="space-y-2">
              {HARBOUR_CREDITORS.filter((row) => row.nca_regulated || row.key).slice(0, 5).map((row) => (
                <p key={row.key} className="text-sm">{row.name} · active mandate</p>
              ))}
              <button type="button" className={recoverBtn} onClick={() => setStep(2)}>Continue</button>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="space-y-2">
              <p className="rounded-full bg-cyan-50 px-3 py-2 text-xs font-bold text-[#0f172a]" data-testid="recover-xlsx-chip">Excel (.xlsx): launching soon</p>
              <textarea data-testid="recover-csv" className={recoverField} rows={5} value={text} onChange={(event) => { setText(event.target.value); setDry(false); }} placeholder="Paste a CSV" />
              <p className="text-xs text-slate-600">UTF-8 CSV up to 2 MiB and 2,000 rows.</p>
              <button type="button" className={recoverBtn} onClick={() => setStep(3)}>Continue</button>
            </div>
          ) : null}
          {step === 3 ? (
            <div className="space-y-2">
              <p className="text-sm">Columns are suggested from the header names. Required: account reference, debtor name, principal.</p>
              <button type="button" className={recoverBtn} onClick={() => setStep(4)}>Continue</button>
            </div>
          ) : null}
          {step === 4 ? (
            <div className="space-y-2" data-testid="recover-dry-run">
              <p className="text-sm">Dry run shows counts and row, field, and code only.</p>
              <button
                type="button"
                className={recoverBtn}
                onClick={() => {
                  const parsed = parseBookCsv(text);
                  if (!parsed.ok) {
                    setIssues([{ row: 0, field: 'file', code: parsed.code }]);
                    setSummary({ will_create: 0, already_placed: 0, errors: 1, warnings: 0 });
                    setDry(true);
                    return;
                  }
                  const result = validateBook(parsed, suggestMapping(parsed.headers), { today: HARBOUR_TODAY });
                  setIssues([...result.errors, ...result.warnings]);
                  setSummary(result.summary);
                  setDry(true);
                }}
              >
                Run dry run
              </button>
              {summary ? (
                <div data-testid="recover-dry-errors" className="rounded-2xl border border-[#e2e8f0] bg-white p-3 text-sm">
                  <p>{summary.will_create} to place. {summary.errors} errors. {summary.warnings} warnings. {summary.already_placed} already placed.</p>
                  <ul className="mt-2 space-y-1">
                    {issues.map((issue) => (
                      <li key={`${issue.row}-${issue.field}-${issue.code}`}>Row {issue.row} · {issue.field} · {issue.code}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <button
                type="button"
                className={recoverBtn}
                disabled={!dry}
                data-testid="recover-commit"
                onClick={() => {
                  void Promise.resolve(onCommit?.(text)).then(() => setStep(5));
                }}
              >
                Commit
              </button>
            </div>
          ) : null}
          {step === 5 ? <p data-testid="recover-commit-result">Commit uses the dry run of this file.</p> : null}
          <div className="flex flex-wrap gap-2">
            {caps.canImport ? (
              <button type="button" className={recoverGhost} data-testid="recover-load-demo" onClick={onLoadDemo}>Load the fictional Harbour demo book</button>
            ) : null}
            {caps.canClearDemo ? (
              <button type="button" className={recoverGhost} data-testid="recover-clear-demo" onClick={onClearDemo}>Clear demo book</button>
            ) : null}
          </div>
          <BatchList batches={book.batches} onRollback={onRollback} />
        </div>
      ) : null}
    </RecoverScreen>
  );
}

export function CreditorBookView({
  phase,
  creditors,
  mandates,
  showDemo = false,
}: {
  phase: BookPhase;
  creditors: RecoverCreditor[];
  mandates: RecoverMandate[];
  showDemo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = creditors.find((row) => row.id === selected) || null;
  return (
    <RecoverScreen title="Creditors" description="Clients who place accounts." testId="recover-creditor-book">
      {showDemo ? <BookBanner /> : null}
      {phase === 'loading' ? <Skeleton testId="recover-creditors-loading" /> : null}
      {phase === 'pending' ? <PendingFeature /> : null}
      {phase === 'error' ? <RecoverBanner testId="recover-banner-error" tone="error">Creditors could not be opened.</RecoverBanner> : null}
      {phase === 'ready' && creditors.length === 0 ? (
        <RecoverEmpty testId="recover-creditors-empty" icon={Building2} title="No creditors yet" body="Add the first client who will place accounts." action={<button type="button" className={recoverBtn} data-testid="recover-creditor-add" onClick={() => setOpen(true)}>Add your first creditor</button>} />
      ) : null}
      {phase === 'ready' && creditors.length > 0 ? (
        <div data-testid="recover-creditors-list" className="grid gap-3 sm:grid-cols-2">
          {creditors.map((row) => (
            <article key={row.id} className={`${recoverCard} p-4`}>
              <h2 className="font-black">{row.name}</h2>
              <p className="text-sm text-slate-600">{row.reg_no || 'No registration recorded'}</p>
              <p className="text-sm">{row.mandate_count ?? mandates.filter((item) => item.creditor_id === row.id).length} mandates · {row.account_count ?? 0} accounts</p>
              <button type="button" className={`${recoverGhost} mt-3`} data-testid="recover-creditor-open" onClick={() => setSelected(row.id)}>Open creditor</button>
            </article>
          ))}
          {chosen ? (
            <section data-testid="recover-creditor-detail" className={`${recoverCard} p-4 sm:col-span-2`}>
              <h2 className="text-xl font-black">{chosen.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{chosen.reg_no || 'No registration recorded'}</p>
              <p className="mt-2 text-sm">{chosen.account_count ?? 0} placed accounts under the active mandate.</p>
              <p className="mt-2 text-sm text-slate-700">RecoverAdvisor® gives no legal advice.</p>
            </section>
          ) : null}
          <button type="button" className={recoverBtn} data-testid="recover-creditor-add" onClick={() => setOpen(true)}>Add a creditor</button>
        </div>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 sm:items-center" data-testid="recover-creditor-drawer">
          <form className="w-full max-w-lg rounded-t-3xl bg-white p-5 sm:rounded-3xl" onSubmit={(event) => { event.preventDefault(); setOpen(false); }}>
            <h2 className="text-xl font-black">Creditor</h2>
            <label className="mt-3 block text-xs font-bold">Name<input className={recoverField} name="name" required /></label>
            <div className="mt-4 flex gap-2">
              <button className={recoverBtn} type="submit">Save creditor</button>
              <button className={recoverGhost} type="button" onClick={() => setOpen(false)}>Close</button>
            </div>
          </form>
        </div>
      ) : null}
    </RecoverScreen>
  );
}

export function MandateBookView({ phase, mandates }: { phase: BookPhase; mandates: RecoverMandate[] }) {
  const [open, setOpen] = useState(false);
  return (
    <RecoverScreen title="Mandates" description="Authority to collect." testId="recover-mandates-book">
      {phase === 'loading' ? <Skeleton testId="recover-mandates-loading" /> : null}
      {phase === 'pending' ? <PendingFeature /> : null}
      {phase === 'error' ? <RecoverBanner testId="recover-banner-error" tone="error">Mandates could not be opened.</RecoverBanner> : null}
      {phase === 'ready' && mandates.length === 0 ? (
        <RecoverEmpty testId="recover-mandates-empty" icon={ShieldCheck} title="No mandates yet" body="A mandate records the authority to collect." action={<button type="button" className={recoverBtn} onClick={() => setOpen(true)}>Add a mandate</button>} />
      ) : null}
      {phase === 'ready' && mandates.length > 0 ? (
        <div className="grid gap-3">
          {mandates.map((row) => (
            <article key={row.id} className={`${recoverCard} p-4`}>
              <h2 className="font-black">{row.creditor_name}</h2>
              <p className="text-sm">{row.product_type} · {row.status}</p>
              {row.nca_regulated ? <p className="mt-2 text-sm text-slate-700">Accounts under this mandate will follow the credit-agreement notice steps when the workflow arrives; RecoverAdvisor® does not apply them yet.</p> : null}
              <p className="mt-2 text-sm text-slate-700">Commission is recorded for later; no fee is calculated or charged by RecoverAdvisor® yet.</p>
              <p className="mt-2 text-xs text-slate-600">Allocation order ⚖ VERIFY. The agreement document itself is not stored yet.</p>
            </article>
          ))}
          <button type="button" className={recoverBtn} data-testid="recover-mandate-add" onClick={() => setOpen(true)}>Add a mandate</button>
        </div>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-900/40 sm:items-center sm:justify-center" data-testid="recover-mandate-drawer">
          <form className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" onSubmit={(event) => { event.preventDefault(); setOpen(false); }}>
            <h2 className="text-xl font-black">Mandate</h2>
            <p className="mt-2 text-sm">Accounts under this mandate will follow the credit-agreement notice steps when the workflow arrives; RecoverAdvisor® does not apply them yet.</p>
            <p className="mt-2 text-sm">Recorded for later; no fee is calculated or charged by RecoverAdvisor® yet.</p>
            <p className="mt-2 text-xs">Allocation order ⚖ VERIFY. The document itself is not stored yet. Authority to litigate and bureau authority are recorded only. RecoverAdvisor® gives no legal advice.</p>
            <button className={`${recoverBtn} mt-4`} type="submit">Save mandate</button>
          </form>
        </div>
      ) : null}
    </RecoverScreen>
  );
}

function BatchList({ batches, onRollback }: { batches: MemoryBatch[]; onRollback?: (id: string) => void }) {
  if (batches.length === 0) {
    return (
      <RecoverEmpty testId="recover-batches-empty" icon={Upload} title="No batches yet" body="A committed file appears here." action={<span className={recoverBtn}>Start an import</span>} />
    );
  }
  return (
    <ul className="space-y-2" data-testid="recover-batches">
      {batches.map((batch) => (
        <li key={batch.id} className={`${recoverCard} p-4 text-sm`}>
          <p className="font-black">{batch.file_name}</p>
          <p>{batch.status} · {batch.created} placed · {batch.skipped} skipped</p>
          <button type="button" className={`${recoverGhost} mt-2`} data-testid={batch.file_name === 'upload.csv' ? 'recover-rollback-upload' : `recover-rollback-${batch.id}`} onClick={() => onRollback?.(batch.id)}>Rollback</button>
        </li>
      ))}
    </ul>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{k}</dt>
      <dd className="tabular-nums">{formatRecoverMoney(v)}</dd>
    </div>
  );
}

function Skeleton({ testId }: { testId: string }) {
  return <div data-testid={testId} className="h-40 animate-pulse rounded-3xl bg-slate-100 motion-reduce:animate-none" aria-busy="true" />;
}

function PendingFeature() {
  return (
    <RecoverBanner testId="recover-banner-feature-pending" tone="pending">
      Database setup pending for this feature.
    </RecoverBanner>
  );
}
