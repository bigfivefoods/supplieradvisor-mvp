'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Flag, HandCoins, ListChecks, ShieldCheck, Upload, Users } from 'lucide-react';
import { HARBOUR_BANNER, HARBOUR_CREDITORS, HARBOUR_TODAY } from '@/lib/recovery/harbour-seed';
import { fileSha256, parseBookCsv, suggestMapping, validateBook, type BookIssue } from '@/lib/recovery/import-book';
import { formatRecoverMoney } from '@/lib/recovery/money';
import type { MemoryAccount, MemoryBatch, MemoryBook } from '@/lib/recovery/preview-memory';
import { visibleAccounts } from '@/lib/recovery/preview-memory';
import type { RecoverBookStats, RecoverCapabilities, RecoverCreditor, RecoverMandate, RecoverRole } from '@/lib/recovery/types';
import { RecoverBanner, RecoverDemoGate, RecoverEmpty, RecoverKpi, RecoverScreen } from './RecoverChrome';
import { useRecoverDesk } from './useRecoverDesk';
import { recoverBtn, recoverCard, recoverField, recoverGhost } from './RecoverUi';

type CreditorSave = {
  op: 'creditor.upsert';
  name: string;
  reg_no?: string;
  contact_email?: string;
  customer_id?: string;
};
type MandateSave = {
  op: 'mandate.upsert';
  creditor_id: string;
  product_type: string;
  nca_regulated?: boolean;
  commission_model?: { kind: string };
};

export type BookPhase = 'loading' | 'error' | 'ready' | 'pending';

const PRODUCT_LABEL: Record<string, string> = {
  nca_credit: 'Credit',
  trade: 'Trade',
  levy: 'Levy',
  rent: 'Rent',
  medical: 'Medical',
  utility: 'Utility',
  other: 'Other',
};

export type ImportCommitInput = {
  csv: string;
  creditorId: string;
  mandateId: string;
  mapping: Record<string, string>;
  drySha: string;
  fileName: string;
};

export type ImportActionResult = {
  ok: boolean;
  message: string;
  errors?: BookIssue[];
  summary?: { will_create: number; already_placed: number; errors: number; warnings: number };
  sha?: string;
};

export const ROLLBACK_REFUSAL =
  'This batch can only be rolled back while no account from the batch has been worked (noted, assigned, flagged, adjusted, merged).';

const MAP_FIELDS: { key: string; label: string }[] = [
  { key: 'creditor_account_ref', label: 'Account reference' },
  { key: 'display_name', label: 'Debtor name' },
  { key: 'principal_cents', label: 'Principal' },
  { key: 'id_type', label: 'Identity type' },
  { key: 'id_number', label: 'Identity number' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'default_date', label: 'Default date' },
];

const ISSUE_LABEL: Record<string, string> = {
  utf8: 'That file is not plain text',
  byte_cap: 'That file is larger than 2 MiB',
  empty: 'That file has no rows',
  row_cap: 'That file has more than 2,000 rows',
  missing_column: 'A required column is not mapped',
  required: 'This value is required',
  duplicate_account: 'That account reference is repeated',
  invalid_id_type: 'Identity type is not recognised',
  invalid_id: 'Identity number could not be checked',
  invalid_phone: 'Phone number could not be read',
  invalid_email: 'Email address could not be read',
  negative: 'Amount cannot be negative',
  scientific: 'Use a plain number',
  nan: 'Amount is not a number',
  format: 'Use a recognised format',
  guard: 'Amount is too large',
  future: 'Date is in the future',
  early: 'Date is too early',
  calendar: 'That date is not on the calendar',
  junk: 'This value could not be read',
};

const FLAG_LABEL: Record<string, string> = {
  debt_review: 'Debt review',
  deceased: 'Deceased estate',
  insolvency: 'Insolvency',
  represented: 'Represented',
  dispute: 'Dispute',
  do_not_contact: 'Do not contact',
};

function counted(count: number, one: string, many: string) {
  const n = Number(count) || 0;
  return `${n} ${n === 1 ? one : many}`;
}

function issueLabel(code: string) {
  return ISSUE_LABEL[code] || 'This row needs a correction';
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function randsToCents(raw: string): number | null {
  const text = raw.trim().replace(/^R\s*/i, '').replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return null;
  const negative = text.startsWith('-');
  const [whole, frac = ''] = (negative ? text.slice(1) : text).split('.');
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

function mandateOptionLabel(row: { label?: string; product_type?: string; agreement_reference?: string }) {
  if (row.product_type) {
    const product = PRODUCT_LABEL[row.product_type] || row.product_type;
    return `${product} · ${row.agreement_reference?.trim() || 'No reference'}`;
  }
  return row.label || 'Active mandate';
}

function mandateText(account: MemoryAccount) {
  if (!account.product_type) return 'Not recorded';
  if (account.product_type.includes('·')) return account.product_type;
  return PRODUCT_LABEL[account.product_type] || account.product_type;
}

function statusLabel(status: string) {
  const known: Record<string, string> = {
    active: 'Active',
    draft: 'Draft',
    ended: 'Ended',
    suspended: 'Suspended',
    archived: 'Archived',
  };
  return known[status] || status.replaceAll('_', ' ');
}

function StatusChip({ status }: { status: string }) {
  const live = status === 'active';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${live ? 'bg-[#00b4d8] text-[#0f172a]' : 'bg-white text-[#0f172a] ring-1 ring-[#00b4d8]'}`}>
      {statusLabel(status)}
    </span>
  );
}

function StateChip({ state }: { state: string }) {
  const live = state === 'active' || state === 'arrangement';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${live ? 'bg-[#00b4d8] text-[#0f172a]' : 'bg-white text-[#0f172a] ring-1 ring-[#00b4d8]'}`}>
      {state.replaceAll('_', ' ')}
    </span>
  );
}

export function BookBanner() {
  return (
    <div data-testid="recover-demo-data" role="status" className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-medium text-[#0f172a]">
      {HARBOUR_BANNER}
    </div>
  );
}

function AccountKpis({
  rows,
  stats,
  placedCount,
  serverQuery,
}: {
  rows: MemoryAccount[];
  stats?: RecoverBookStats | null;
  placedCount?: number;
  serverQuery: boolean;
}) {
  const placed = stats?.placedCount ?? (serverQuery ? placedCount ?? rows.length : rows.length);
  const balance = stats?.placedBalanceCents ?? rows.reduce((sum, row) => sum + (row.state === 'active' ? row.balance_cents : 0), 0);
  const assigned = stats?.assignedCount ?? rows.filter((row) => row.assignee).length;
  const unassigned = stats?.unassignedCount ?? rows.filter((row) => !row.assignee && row.state === 'active').length;
  const arrangement = stats?.arrangementCount ?? rows.filter((row) => row.state === 'arrangement').length;
  const paid = stats?.paidCount ?? rows.filter((row) => row.state === 'paid').length;
  if (placed <= 0 && rows.length === 0) return null;
  return (
    <div data-testid="recover-account-kpis" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <RecoverKpi testId="recover-kpi-book-placed" label="Placed" value={String(placed)} sub="Accounts on this book" icon={ListChecks} tint="border-sky-100 bg-sky-50" />
      <RecoverKpi testId="recover-kpi-book-balance" label="Balance" value={formatRecoverMoney(balance)} sub="Placed balance. Payments are not recorded yet." icon={HandCoins} tint="border-cyan-100 bg-cyan-50" />
      <RecoverKpi testId="recover-kpi-book-assigned" label="Assigned" value={String(assigned)} sub="With a collector" icon={Users} tint="border-sky-100 bg-sky-50" />
      <RecoverKpi testId="recover-kpi-book-open" label="Unassigned" value={String(unassigned)} sub="Active and not assigned" icon={ShieldCheck} tint="border-cyan-100 bg-cyan-50" />
      {arrangement > 0 ? <RecoverKpi testId="recover-kpi-book-arrangement" label="In arrangement" value={String(arrangement)} sub="Recorded on the account" icon={ListChecks} tint="border-cyan-100 bg-cyan-50" /> : null}
      {paid > 0 ? <RecoverKpi testId="recover-kpi-book-paid" label="Paid" value={String(paid)} sub="Marked paid on this book" icon={HandCoins} tint="border-emerald-100 bg-emerald-50" /> : null}
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
  stats = null,
  assignees = [],
  onBulkAssign,
  onAssign,
  onMerge,
  serverQuery = false,
  duplicates = [],
  nextCursor = null,
  hasPrevious = false,
  onQuery,
  initialState = '',
}: {
  phase: BookPhase;
  book: MemoryBook;
  role: RecoverRole;
  caps: RecoverCapabilities;
  onOpen?: (id: string) => void;
  showDemo?: boolean;
  placedCount?: number;
  stats?: RecoverBookStats | null;
  assignees?: { id: string; label: string }[];
  onBulkAssign?: (ids: string[], staffId: string) => Promise<boolean>;
  onAssign?: (accountId: string, staffId: string) => Promise<boolean>;
  onMerge?: (sourceId: string, targetId: string) => Promise<boolean>;
  serverQuery?: boolean;
  duplicates?: { name: string; match?: 'identity' | 'contact'; debtors: { id: string; display_name: string; id_last4: string | null }[] }[];
  nextCursor?: { placed_at: string; id: string } | null;
  hasPrevious?: boolean;
  onQuery?: (next: { q: string; state: string; assigned: string; after?: string | null; afterId?: string | null; back?: boolean }) => void;
  /** First value of the state filter. Later edits stay in this view. */
  initialState?: string;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [staffId, setStaffId] = useState('');
  const [oneAccount, setOneAccount] = useState('');
  const [oneStaff, setOneStaff] = useState('');
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [confirm, setConfirm] = useState<string>('');
  const [q, setQ] = useState('');
  const [stateFilter, setStateFilter] = useState(initialState);
  const [assignedFilter, setAssignedFilter] = useState('');
  const allRows = visibleAccounts(book, role);
  const rows = serverQuery
    ? allRows
    : allRows.filter((row) => {
        const hay = `${row.ref} ${row.debtor_name} ${row.creditor_account_ref}`.toLowerCase();
        if (q && !hay.includes(q.trim().toLowerCase())) return false;
        if (stateFilter && row.state !== stateFilter) return false;
        if (assignedFilter === 'yes' && !row.assignee) return false;
        if (assignedFilter === 'no' && row.assignee) return false;
        return true;
      });
  const pageKey = rows.map((row) => row.id).join('|');
  useEffect(() => {
    setPicked([]);
  }, [pageKey]);
  const debtors = rows.filter((row, index, list) => list.findIndex((item) => item.debtor_id === row.debtor_id) === index);
  const accountLabel = (id: string) => {
    const row = rows.find((item) => item.id === id);
    return row ? `${row.ref} · ${row.id_masked}` : 'this account';
  };
  const debtorLabel = (id: string) => {
    const row = debtors.find((item) => item.debtor_id === id);
    return row ? `${row.debtor_name} · ${row.id_masked}` : 'this debtor';
  };
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
      {phase === 'ready' && role !== 'viewer' && rows.length === 0 && !q && !stateFilter && !assignedFilter ? (
        <RecoverEmpty
          testId="recover-accounts-empty"
          icon={ListChecks}
          title="No accounts yet"
          body="Accounts appear here after a book is placed."
          action={<a className={recoverBtn} href="/dashboard/recovergraph/imports">Open imports</a>}
        />
      ) : null}
      {phase === 'ready' && role !== 'viewer' && rows.length === 0 && (q || stateFilter || assignedFilter) ? (
        <RecoverEmpty testId="recover-accounts-empty" icon={ListChecks} title="No matching accounts" body="Try another name, reference, or filter." />
      ) : null}
      {phase === 'ready' && role !== 'viewer' ? (
        <div data-testid="recover-accounts-list" className="grid gap-3">
          <AccountKpis rows={rows} stats={stats} placedCount={placedCount} serverQuery={serverQuery} />
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              if (serverQuery) onQuery?.({ q, state: stateFilter, assigned: assignedFilter, after: null, afterId: null });
            }}
          >
            <input aria-label="Search accounts" className={recoverField} value={q} placeholder="Name or reference" onChange={(event) => setQ(event.target.value)} />
            <select aria-label="State" className={recoverField} value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
              <option value="">Any state</option>
              <option value="active">Active</option>
              <option value="arrangement">Arrangement</option>
              <option value="dispute">Dispute</option>
              <option value="legal">Legal</option>
              <option value="paid">Paid</option>
              <option value="recalled">Recalled</option>
              <option value="closed">Closed</option>
              <option value="prescribed">Prescribed</option>
              <option value="stopped">Stopped</option>
            </select>
            <select aria-label="Assigned" className={recoverField} value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value)}>
              <option value="">Anyone</option>
              <option value="yes">Assigned</option>
              <option value="no">Unassigned</option>
            </select>
            {serverQuery ? <button className={`${recoverBtn} whitespace-nowrap`} type="submit">Search</button> : null}
          </form>
          {duplicates.length ? (
            <section data-testid="recover-duplicate-debtors" className={`${recoverCard} p-4`}>
              <h2 className="font-black text-[#0f172a]">Possible duplicate debtors</h2>
              <p className="mt-1 text-xs text-slate-600">Matched on the same identity, or the same name with the same phone or email.</p>
              <ul className="mt-3 space-y-3 text-sm">
                {duplicates.map((group) => (
                  <li key={`${group.match || 'pair'}-${group.debtors.map((debtor) => debtor.id).join('-')}`} className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#0077b6]">{group.match === 'identity' ? 'Same identity' : 'Same name and phone or email'}</p>
                    <p className="mt-1">{group.debtors.map((debtor) => `${debtor.display_name} · ${debtor.id_last4 ? `•••••• ${debtor.id_last4}` : '••••••'}`).join(' and ')}</p>
                    {onMerge && group.debtors.length > 1 ? (
                      <button
                        type="button"
                        className={`${recoverBtn} mt-2 whitespace-nowrap`}
                        onClick={() => {
                          setMergeSource(group.debtors[0].id);
                          setMergeTarget(group.debtors[1].id);
                          setConfirm(`Merge ${group.debtors[0].display_name} into ${group.debtors[1].display_name}. A merge is reversible only by support.`);
                        }}
                      >
                        Merge this pair
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {onAssign || onMerge || onBulkAssign ? (
            <p className="text-xs text-slate-600">Assign and merge lists use the accounts on this page.</p>
          ) : null}
          {onAssign && rows.length > 0 ? (
            <details className={`${recoverCard} p-4`} data-testid="recover-assign-one">
              <summary className="cursor-pointer font-black text-[#0f172a]">Assign account</summary>
              <form
                className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!oneAccount || !oneStaff) return;
                  const person = assignees.find((row) => row.id === oneStaff)?.label || 'that collector';
                  setConfirm(`Assign ${accountLabel(oneAccount)} to ${person}.`);
                }}
              >
                <select aria-label="Account" className={recoverField} value={oneAccount} onChange={(event) => setOneAccount(event.target.value)}>
                  <option value="">Choose an account</option>
                  {rows.map((row) => (
                    <option key={row.id} value={row.id}>{row.ref} · {row.id_masked}</option>
                  ))}
                </select>
                <select aria-label="Assign one account to" className={recoverField} value={oneStaff} onChange={(event) => setOneStaff(event.target.value)}>
                  <option value="">Choose a collector</option>
                  {assignees.map((person) => (
                    <option key={person.id} value={person.id}>{person.label}</option>
                  ))}
                </select>
                <button className={`${recoverBtn} whitespace-nowrap`} type="submit">Assign account</button>
              </form>
            </details>
          ) : null}
          {onMerge && debtors.length > 1 ? (
            <details className={`${recoverCard} p-4`} data-testid="recover-merge">
              <summary className="cursor-pointer font-black text-[#0f172a]">Merge debtors</summary>
              <form
                className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return;
                  setConfirm(`Merge ${debtorLabel(mergeSource)} into ${debtorLabel(mergeTarget)}. A merge is reversible only by support.`);
                }}
              >
                <select aria-label="Debtor to merge" className={recoverField} value={mergeSource} onChange={(event) => setMergeSource(event.target.value)}>
                  <option value="">Debtor to merge</option>
                  {debtors.map((row) => (
                    <option key={row.debtor_id} value={row.debtor_id}>{row.debtor_name} · {row.id_masked}</option>
                  ))}
                </select>
                <select aria-label="Debtor to keep" className={recoverField} value={mergeTarget} onChange={(event) => setMergeTarget(event.target.value)}>
                  <option value="">Debtor to keep</option>
                  {debtors.map((row) => (
                    <option key={`keep-${row.debtor_id}`} value={row.debtor_id}>{row.debtor_name} · {row.id_masked}</option>
                  ))}
                </select>
                <button className={`${recoverBtn} whitespace-nowrap`} type="submit">Merge debtors</button>
              </form>
            </details>
          ) : null}
          {onBulkAssign && rows.length > 0 ? (
            <details className={`${recoverCard} p-4`} data-testid="recover-bulk-assign">
              <summary className="cursor-pointer font-black text-[#0f172a]">Assign selected</summary>
              <form
                className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!staffId || picked.length === 0) return;
                  const person = assignees.find((row) => row.id === staffId)?.label || 'that collector';
                  setConfirm(`Assign ${picked.length} selected accounts to ${person}.`);
                }}
              >
                <select aria-label="Assign to" className={recoverField} value={staffId} onChange={(event) => setStaffId(event.target.value)}>
                  <option value="">Choose a collector</option>
                  {assignees.map((person) => (
                    <option key={person.id} value={person.id}>{person.label}</option>
                  ))}
                </select>
                <button className={`${recoverBtn} whitespace-nowrap`} type="submit">Assign selected</button>
              </form>
            </details>
          ) : null}
          {confirm ? (
            <div data-testid="recover-confirm" className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-[#0f172a]">
              <p>{confirm}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={recoverBtn}
                  onClick={() => {
                    const text = confirm;
                    setConfirm('');
                    if (text.startsWith('Assign ') && text.includes(' selected ')) {
                      void onBulkAssign?.(picked, staffId).then((ok) => {
                        if (ok) setPicked([]);
                      });
                      return;
                    }
                    if (text.startsWith('Assign ')) {
                      void onAssign?.(oneAccount, oneStaff);
                      return;
                    }
                    void onMerge?.(mergeSource, mergeTarget);
                  }}
                >
                  Confirm
                </button>
                <button type="button" className={recoverGhost} onClick={() => setConfirm('')}>Cancel</button>
              </div>
            </div>
          ) : null}
          {rows.length > 0 ? (
          <div className="hidden min-w-0 grid-cols-[8rem_1fr_8rem_6rem] gap-3 px-2 text-xs font-bold uppercase tracking-wide text-slate-500 sm:grid">
            <span>Reference</span><span>Debtor</span><span className="text-right">Balance</span><span>State</span>
          </div>
          ) : null}
          {(serverQuery ? rows : [...rows].sort((a, b) => (a.placed_at < b.placed_at ? 1 : a.placed_at > b.placed_at ? -1 : b.ref.localeCompare(a.ref)))).map((row) => (
            <button key={row.id} type="button" data-testid={`recover-account-${row.ref}`} onClick={() => onOpen?.(row.id)} className={`${recoverCard} grid min-h-11 min-w-0 gap-2 px-4 py-3 text-left sm:grid-cols-[8rem_minmax(0,1fr)_8rem_auto] sm:items-center`}>
              <span className="font-black text-[#0f172a]">
                {onBulkAssign ? (
                  <input
                    type="checkbox"
                    className="mr-2"
                    aria-label={`Select ${row.ref}`}
                    checked={picked.includes(row.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => setPicked((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])}
                  />
                ) : null}
                {row.ref}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#0f172a]">{row.debtor_name}</span>
                <span className="block truncate text-xs text-slate-600">{row.creditor_name} · {row.id_masked}</span>
                {row.contacts.length ? (
                  <span data-testid="recover-account-contacts" className="mt-1 block truncate text-xs text-slate-700">
                    {row.contacts.map((contact) => `${contact.kind} ${contact.value}`).join(' · ')}
                  </span>
                ) : null}
              </span>
              <span className="text-sm font-black tabular-nums text-[#0f172a] sm:text-right">{formatRecoverMoney(row.balance_cents)}</span>
              <span className="flex flex-wrap items-center gap-1">
                <StateChip state={row.state} />
                {row.flags.length ? <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0f172a] ring-1 ring-[#00b4d8]">Flag</span> : null}
              </span>
            </button>
          ))}
          {serverQuery && (hasPrevious || nextCursor) ? (
            <div className="flex flex-wrap gap-2">
              {hasPrevious ? (
                <button
                  type="button"
                  className={`${recoverGhost} whitespace-nowrap`}
                  data-testid="recover-accounts-prev"
                  onClick={() => onQuery?.({ q, state: stateFilter, assigned: assignedFilter, back: true })}
                >
                  Previous page
                </button>
              ) : null}
              {nextCursor ? (
                <button
                  type="button"
                  className={`${recoverBtn} whitespace-nowrap`}
                  data-testid="recover-accounts-next"
                  onClick={() => onQuery?.({ q, state: stateFilter, assigned: assignedFilter, after: nextCursor.placed_at, afterId: nextCursor.id })}
                >
                  Next page
                </button>
              ) : null}
            </div>
          ) : null}
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
  revealedId = '',
  notice = '',
  onNote,
  onFlag,
  onAdjust,
  onRecall,
}: {
  phase: BookPhase;
  account: MemoryAccount | null;
  role: RecoverRole;
  caps: RecoverCapabilities;
  onReveal?: (reason: string) => void | Promise<{ id_number?: string; message?: string } | void>;
  showDemo?: boolean;
  revealedId?: string;
  notice?: string;
  onNote?: (note: string) => Promise<boolean> | boolean;
  onFlag?: (flag: string, reason: string, clear?: boolean) => Promise<boolean> | boolean;
  onAdjust?: (cents: number, reason: string) => Promise<boolean> | boolean;
  onRecall?: (closeReason: string) => Promise<boolean> | boolean;
}) {
  const [reveal, setReveal] = useState(false);
  const [shown, setShown] = useState('');
  const [flag, setFlag] = useState('debt_review');
  const [flagReason, setFlagReason] = useState('');
  const [note, setNote] = useState('');
  const [rands, setRands] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const idText = revealedId || shown;
  const noteEvents = new Set(account?.events.filter((event) => event.type === 'note').map((event) => `${event.at}:${event.note || ''}`) || []);
  return (
    <RecoverScreen title={account?.ref || 'Account'} description="Placed balance; payments are not recorded yet." testId="recover-account">
      {showDemo ? <BookBanner /> : null}
      {notice ? <p role="status" className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-[#0f172a]">{notice}</p> : null}
      {phase === 'loading' ? <Skeleton testId="recover-account-loading" /> : null}
      {phase === 'pending' ? <PendingFeature /> : null}
      {phase === 'error' ? <RecoverBanner testId="recover-banner-error" tone="error">This account could not be opened.</RecoverBanner> : null}
      {phase === 'ready' && !account ? (
        <RecoverEmpty testId="recover-account-empty" icon={ListChecks} title="No accounts yet" body="Choose an account from the list." action={<a className={recoverBtn} href="/dashboard/recovergraph/accounts">Back to accounts</a>} />
      ) : null}
      {phase === 'ready' && account ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" data-role={role}>
          <div className="min-w-0 space-y-4">
            <section className="rounded-3xl bg-[#00b4d8] p-5 text-[#0f172a]">
              <p className="text-xs font-bold uppercase tracking-[0.16em]">Placed balance</p>
              <p className="mt-1 text-3xl font-black tabular-nums">{formatRecoverMoney(account.balance_cents)}</p>
              <p className="mt-1 text-sm">Payments are not recorded yet.</p>
              <div className="mt-3"><StateChip state={account.state} /></div>
            </section>
            <section className={`${recoverCard} p-4`}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Debtor</p>
              <p className="font-black">{account.debtor_name}</p>
              <p className="text-sm text-slate-700" data-testid={idText ? 'recover-revealed-id' : undefined}>{idText || account.id_masked}</p>
              {caps.canRevealId ? (
                <button type="button" className={`${recoverBtn} mt-3`} data-testid="recover-reveal" onClick={() => setReveal(true)}>
                  Reveal ID
                </button>
              ) : null}
              {reveal ? (
                <form
                  data-testid="recover-reveal-prompt"
                  className="mt-3 space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const reason = String(new FormData(event.currentTarget).get('reason') || '').trim();
                    void Promise.resolve(onReveal?.(reason)).then((result) => {
                      if (result && result.id_number) setShown(result.id_number);
                    });
                    setReveal(false);
                  }}
                >
                  <p className="text-xs text-slate-600">This view is logged. Do not put a phone number, email, identity number, or other personal information in this reason.</p>
                  <input aria-label="Reason" name="reason" className={recoverField} required maxLength={200} />
                  <button className={recoverBtn} type="submit">Show the ID</button>
                </form>
              ) : null}
              {caps.canSeeContacts ? (
                <ul className="mt-3 space-y-2">
                  {account.contacts.length === 0 ? <li className="text-sm text-slate-600">No contact points recorded.</li> : null}
                  {account.contacts.map((contact) => (
                    <li key={`${contact.kind}-${contact.value}`} className="rounded-2xl border border-[#e2e8f0] bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-bold">{contact.kind}</span> {contact.value}
                      {contact.s129_delivery_method ? <span className="mt-1 block text-xs text-slate-600">Delivery method recorded: {contact.s129_delivery_method.replace('_', ' ')}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
            <section className={`${recoverCard} p-4`}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Mandate</p>
              <p className="font-black">{account.creditor_name || 'Creditor not recorded'}</p>
              <p className="text-sm text-slate-700">{mandateText(account)}</p>
              <p className="mt-1 text-sm text-slate-600">Assigned to {account.assignee_name || 'nobody yet'}</p>
            </section>
            {account.flags.length ? (
              <div data-testid="recover-stop-banner" className="flex gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-[#0f172a]">
                <Flag className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  {account.flags.map((item) => FLAG_LABEL[item.key] || item.key).join(', ')} recorded. Nothing in RecoverAdvisor® contacts a debtor yet, so this flag does not send or block a message.
                </p>
              </div>
            ) : null}
            <ol data-testid="recover-timeline" className="space-y-2">
              {account.events.map((event, index) => (
                <li key={event.id || `${event.type}-${event.at}-${index}`} className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm">
                  <span className="font-bold text-[#0f172a]">{event.label}</span>
                  <span className="ml-2 text-slate-600">{formatWhen(event.at)}</span>
                  {event.note ? <span className="mt-1 block text-slate-700">{event.note}</span> : null}
                </li>
              ))}
              {account.notes.filter((item) => !noteEvents.has(`${item.at}:${item.text}`)).map((item, index) => (
                <li key={`${item.at}-${index}`} className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm">
                  <span className="font-bold text-[#0f172a]">Note</span>
                  <span className="ml-2 text-slate-600">{formatWhen(item.at)}</span>
                  <span className="mt-1 block text-slate-700">{item.text}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="min-w-0 space-y-3">
            <section className={`${recoverCard} p-4`}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Balance breakdown</p>
              <dl className="mt-3 space-y-1 text-sm">
                <Row k="Original" v={account.original_cents} />
                <Row k="Principal" v={account.principal_cents} />
                <Row k="Interest" v={account.interest_cents} />
                <Row k="Fees" v={account.fees_cents} />
                <Row k="Costs" v={account.costs_cents} />
                <Row k="Adjustment" v={account.adjustment_cents} />
              </dl>
            </section>
            {confirm ? (
              <div data-testid="recover-confirm" className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-[#0f172a]">
                <p>{confirm}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`${recoverBtn} whitespace-nowrap`}
                    onClick={() => {
                      const text = confirm;
                      setConfirm('');
                      if (text.startsWith('Recall ')) {
                        void onRecall?.(closeReason.trim());
                        return;
                      }
                      const cents = randsToCents(rands);
                      if (cents == null || !adjustReason.trim()) return;
                      void onAdjust?.(cents, adjustReason.trim());
                      setRands('');
                      setAdjustReason('');
                    }}
                  >
                    Confirm
                  </button>
                  <button type="button" className={recoverGhost} onClick={() => setConfirm('')}>Cancel</button>
                </div>
              </div>
            ) : null}
            {caps.canAddNote && onNote ? (
              <details className={`${recoverCard} p-4`} open data-testid="recover-add-note">
                <summary className="cursor-pointer font-black text-[#0f172a]">Add note</summary>
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const text = note.trim();
                    if (!text) return;
                    void Promise.resolve(onNote(text)).then((ok) => {
                      if (ok !== false) setNote('');
                    });
                  }}
                >
                  <label className="block text-xs font-bold">Note
                    <textarea aria-label="Note" className={recoverField} rows={3} value={note} onChange={(event) => setNote(event.target.value)} required />
                  </label>
                  <button type="submit" className={`${recoverGhost} whitespace-nowrap`}>Add note</button>
                </form>
              </details>
            ) : null}
            {onFlag ? (
              <details className={`${recoverCard} p-4`} open data-testid="recover-stop-flag">
                <summary className="cursor-pointer font-black text-[#0f172a]">Stop flag</summary>
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const clear = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'clear';
                    void onFlag(flag, flagReason.trim(), clear);
                  }}
                >
                  <label className="block text-xs font-bold">Stop flag
                    <select aria-label="Stop flag" className={recoverField} value={flag} onChange={(event) => setFlag(event.target.value)}>
                      {Object.entries(FLAG_LABEL).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <input aria-label="Flag reason" className={recoverField} value={flagReason} onChange={(event) => setFlagReason(event.target.value)} required placeholder="Reason" />
                  <div className="flex flex-wrap gap-2">
                    <button className={`${recoverBtn} whitespace-nowrap`} type="submit" value="set">Set flag</button>
                    <button className={`${recoverGhost} whitespace-nowrap`} type="submit" value="clear">Clear flag</button>
                  </div>
                  <p className="text-xs text-slate-600">An owner or manager records the flag. It does not send or block a message.</p>
                </form>
              </details>
            ) : null}
            {onAdjust ? (
              <details className={`${recoverCard} p-4`} data-testid="recover-adjust">
                <summary className="cursor-pointer font-black text-[#0f172a]">Adjustment</summary>
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (randsToCents(rands) == null || !adjustReason.trim()) return;
                    const cents = randsToCents(rands);
                    if (cents == null) return;
                    setConfirm(`Set the adjustment to ${formatRecoverMoney(cents)}. This replaces the current adjustment. It is not added on top. RecoverAdvisor® refuses the change if the balance would go below zero.`);
                  }}
                >
                  <label className="block text-xs font-bold">Replacement amount in rands
                    <input aria-label="Adjustment in rands" className={recoverField} inputMode="decimal" value={rands} onChange={(event) => setRands(event.target.value)} required placeholder="0.00" />
                  </label>
                  <input aria-label="Adjustment reason" className={recoverField} value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} required maxLength={500} placeholder="Reason" />
                  <p className="text-xs text-slate-600">This sets the adjustment figure. It does not add to the one already recorded.</p>
                  <button className={`${recoverBtn} whitespace-nowrap`} type="submit">Record adjustment</button>
                </form>
              </details>
            ) : null}
            {onRecall ? (
              <details className={`${recoverCard} p-4`} data-testid="recover-recall">
                <summary className="cursor-pointer font-black text-[#0f172a]">Recall account</summary>
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!closeReason.trim()) return;
                    setConfirm('Recall closes this account and takes it off the active book.');
                  }}
                >
                  <label className="block text-xs font-bold">Recall reason
                    <input aria-label="Recall reason" className={recoverField} value={closeReason} onChange={(event) => setCloseReason(event.target.value)} required />
                  </label>
                  <button className={`${recoverBtn} whitespace-nowrap`} type="submit">Recall account</button>
                </form>
              </details>
            ) : null}
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
  onDryRun,
  showDemo = false,
  creditors = [],
  mandates = [],
  notice = '',
}: {
  phase: BookPhase;
  book: MemoryBook;
  caps: RecoverCapabilities;
  showDemo?: boolean;
  creditors?: { id: string; name: string }[];
  mandates?: { id: string; creditor_id: string; status?: string; label?: string; product_type?: string; agreement_reference?: string }[];
  notice?: string;
  onDryRun?: (input: { csv: string; mapping: Record<string, string> }) => Promise<ImportActionResult>;
  onCommit?: (input: ImportCommitInput) => Promise<ImportActionResult> | ImportActionResult | void;
  onRollback?: (id: string) => Promise<ImportActionResult> | ImportActionResult | void;
  onLoadDemo?: () => Promise<ImportActionResult> | ImportActionResult | void;
  onClearDemo?: () => Promise<ImportActionResult> | ImportActionResult | void;
}) {
  const demoPick = showDemo && creditors.length === 0;
  const creditorChoices = demoPick
    ? HARBOUR_CREDITORS.map((row) => ({ id: row.key, name: row.name }))
    : creditors;
  const mandateChoices = demoPick
    ? HARBOUR_CREDITORS.map((row) => ({
        id: row.key,
        creditor_id: row.key,
        status: 'active',
        product_type: row.product_type,
        agreement_reference: row.agreement_reference,
        label: `${PRODUCT_LABEL[row.product_type] || row.product_type} · ${row.agreement_reference}`,
      }))
    : mandates.filter((row) => !row.status || row.status === 'active');
  const [step, setStep] = useState(1);
  const [text, setText] = useState('');
  const [dry, setDry] = useState(false);
  const [issues, setIssues] = useState<BookIssue[]>([]);
  const [summary, setSummary] = useState<ImportActionResult['summary'] | null>(null);
  const [creditorId, setCreditorId] = useState(demoPick ? creditorChoices[0]?.id || '' : '');
  const [mandateId, setMandateId] = useState(demoPick ? mandateChoices[0]?.id || '' : '');
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleByHeader, setSampleByHeader] = useState<Record<string, string>>({});
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [drySha, setDrySha] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const mandatesForCreditor = mandateChoices.filter((row) => row.creditor_id === creditorId);
  const message = actionMessage || notice;

  function readCsvFile(file: File | undefined) {
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      setActionMessage('Excel (.xlsx) is launching soon. Paste a CSV for now.');
      return;
    }
    void file.text().then((value) => {
      setText(value);
      setDry(false);
      setDrySha('');
    });
  }

  function chooseCreditor(next: string) {
    setCreditorId(next);
    const match = mandateChoices.find((row) => row.creditor_id === next);
    setMandateId(match?.id || '');
    setDry(false);
  }

  async function remember(result: ImportActionResult | void) {
    if (result?.message) setActionMessage(result.message);
  }

  return (
    <RecoverScreen title="Imports & batches" description="Bring in a creditor's book." testId="recover-imports">
      {showDemo ? <BookBanner /> : null}
      {message ? <p role="status" data-testid="recover-import-notice" className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-[#0f172a]">{message}</p> : null}
      {phase === 'loading' ? <Skeleton testId="recover-imports-loading" /> : null}
      {phase === 'pending' ? <PendingFeature /> : null}
      {phase === 'error' ? <RecoverBanner testId="recover-banner-error" tone="error">Imports could not be opened.</RecoverBanner> : null}
      {phase === 'ready' ? (
        <div data-testid="recover-import-wizard" className="min-w-0 space-y-4">
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Import steps">
            {['Creditor and mandate', 'File', 'Map columns', 'Dry run', 'Commit'].map((label, index) => {
              const current = step === index + 1;
              const done = step > index + 1;
              return (
                <li key={label} className={`min-w-0 rounded-2xl border px-3 py-2 ${current ? 'border-[#00b4d8] bg-cyan-50' : 'border-[#e2e8f0] bg-white'}`}>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${current || done ? 'bg-[#00b4d8] text-[#0f172a]' : 'bg-slate-100 text-slate-600'}`}>{index + 1}</span>
                  <span className="mt-1 block text-xs font-bold text-[#0f172a]">{label}</span>
                </li>
              );
            })}
          </ol>
          {step === 1 ? (
            <div className="space-y-4">
              {creditorChoices.length === 0 ? (
                <p className="text-sm">Add a creditor and an active mandate before placing a book.</p>
              ) : null}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Creditor</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {creditorChoices.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      aria-pressed={creditorId === row.id}
                      className={`${recoverCard} p-4 text-left ${creditorId === row.id ? 'ring-2 ring-[#00b4d8]' : ''}`}
                      onClick={() => chooseCreditor(row.id)}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Creditor</span>
                      <span className="mt-1 block font-black text-[#0f172a]">{row.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Active mandate</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {mandatesForCreditor.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      aria-pressed={mandateId === row.id}
                      className={`${recoverCard} p-4 text-left ${mandateId === row.id ? 'ring-2 ring-[#00b4d8]' : ''}`}
                      onClick={() => { setMandateId(row.id); setDry(false); }}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mandate</span>
                      <span className="mt-1 block font-black text-[#0f172a]">{mandateOptionLabel(row)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className={recoverBtn} disabled={!creditorId || !mandateId} onClick={() => setStep(2)}>Continue</button>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="space-y-3">
              <label
                className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#00b4d8] bg-cyan-50/60 px-4 py-6 text-center"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  readCsvFile(event.dataTransfer.files?.[0]);
                }}
              >
                <Upload className="h-6 w-6 text-[#0f172a]" aria-hidden />
                <span className="mt-2 text-sm font-black text-[#0f172a]">Drop a CSV here, or choose a file</span>
                <span className="mt-1 text-xs text-slate-600">UTF-8 CSV up to 2 MiB and 2,000 rows.</span>
                <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0f172a] ring-1 ring-[#00b4d8]" data-testid="recover-xlsx-chip">Excel (.xlsx): launching soon</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  aria-label="CSV file"
                  onChange={(event) => {
                    readCsvFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
              <label className="block text-xs font-bold">Or paste the CSV
                <textarea data-testid="recover-csv" className={recoverField} rows={5} value={text} onChange={(event) => { setText(event.target.value); setDry(false); setDrySha(''); }} placeholder="account number, debtor name, principal" />
              </label>
              <button
                type="button"
                className={recoverBtn}
                onClick={() => {
                  const parsed = parseBookCsv(text);
                  if (!parsed.ok) {
                    setIssues([{ row: 0, field: 'file', code: parsed.code }]);
                    setSummary({ will_create: 0, already_placed: 0, errors: 1, warnings: 0 });
                    setActionMessage('That file could not be read.');
                    return;
                  }
                  const first = parsed.rows[0] || [];
                  const sample: Record<string, string> = {};
                  parsed.headers.forEach((header, index) => {
                    sample[header] = String(first[index] || '').slice(0, 80);
                  });
                  setSampleByHeader(sample);
                  setHeaders(parsed.headers);
                  setMapping(suggestMapping(parsed.headers));
                  setIssues([]);
                  setSummary(null);
                  setDry(false);
                  setStep(3);
                }}
              >
                Continue
              </button>
            </div>
          ) : null}
          {step === 3 ? (
            <div className="min-w-0 space-y-3">
              <p className="text-sm">Match each column. Required: account reference, debtor name, principal.</p>
              <div className="max-w-full overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-bold">Field</th>
                      <th className="px-3 py-2 font-bold">Column</th>
                      <th className="px-3 py-2 font-bold">Sample</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MAP_FIELDS.map((field) => {
                      const header = mapping[field.key] || '';
                      return (
                        <tr key={field.key} className="border-t border-[#e2e8f0]">
                          <td className="px-3 py-2 font-bold text-[#0f172a]">{field.label}</td>
                          <td className="px-3 py-2">
                            <select
                              aria-label={field.label}
                              className={recoverField}
                              value={header}
                              onChange={(event) => {
                                setMapping((current) => ({ ...current, [field.key]: event.target.value }));
                                setDry(false);
                              }}
                            >
                              <option value="">Not mapped</option>
                              {headers.map((column) => (
                                <option key={`${field.key}-${column}`} value={column}>{column}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-slate-700">{header ? sampleByHeader[header] || '—' : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button type="button" className={recoverBtn} onClick={() => setStep(4)}>Continue</button>
            </div>
          ) : null}
          {step === 4 ? (
            <div className="space-y-3" data-testid="recover-dry-run">
              <p className="text-sm">Dry run checks this file and shows what would be placed. Commit sends the same file again. RecoverAdvisor® checks the hash and validates the rows again. It does not keep a separate dry-run session.</p>
              <p className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]" data-testid="recover-import-summary">
                {creditorChoices.find((row) => row.id === creditorId)?.name || 'Creditor'} · {mandateOptionLabel(mandatesForCreditor.find((row) => row.id === mandateId) || {})}
              </p>
              <button
                type="button"
                className={recoverBtn}
                onClick={() => {
                  void (async () => {
                    if (onDryRun) {
                      const result = await onDryRun({ csv: text, mapping });
                      setIssues(result.errors || []);
                      setSummary(result.summary || null);
                      setDrySha(result.sha || '');
                      setDry(Boolean(result.ok && result.sha && (result.summary?.errors ?? 0) === 0));
                      if (!result.ok) setActionMessage(result.message);
                      return;
                    }
                    const parsed = parseBookCsv(text);
                    if (!parsed.ok) {
                      setIssues([{ row: 0, field: 'file', code: parsed.code }]);
                      setSummary({ will_create: 0, already_placed: 0, errors: 1, warnings: 0 });
                      setDry(false);
                      return;
                    }
                    const result = validateBook(parsed, mapping, { today: HARBOUR_TODAY });
                    setIssues([...result.errors, ...result.warnings]);
                    setSummary(result.summary);
                    setDrySha(await fileSha256(text));
                    setDry(result.errors.length === 0);
                  })();
                }}
              >
                Run dry run
              </button>
              {summary ? (
                <div data-testid="recover-dry-errors" className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Ok</p>
                      <p className="mt-1 text-2xl font-black tabular-nums text-[#0f172a]">{summary.will_create}</p>
                    </div>
                    <div className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Errors</p>
                      <p className="mt-1 text-2xl font-black tabular-nums text-[#0f172a]">{summary.errors}</p>
                    </div>
                    <div className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Duplicates</p>
                      <p className="mt-1 text-2xl font-black tabular-nums text-[#0f172a]">{summary.already_placed}</p>
                    </div>
                  </div>
                  {summary.warnings ? <p className="text-sm text-slate-600">{summary.warnings} warnings.</p> : null}
                  <ul className="space-y-1 text-sm">
                    {issues.map((issue) => (
                      <li key={`${issue.row}-${issue.field}-${issue.code}`} className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-2">Row {issue.row} · {issue.field} · {issueLabel(issue.code)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <button
                type="button"
                className={`${recoverBtn} w-full sm:w-auto`}
                disabled={!dry || !drySha || !creditorId || !mandateId}
                data-testid="recover-commit"
                onClick={() => {
                  void Promise.resolve(onCommit?.({
                    csv: text,
                    creditorId,
                    mandateId,
                    mapping,
                    drySha,
                    fileName: 'upload.csv',
                  })).then((result) => {
                    if (result && result.ok === false) {
                      setCommitMessage(result.message);
                      setIssues(result.errors || issues);
                      if (result.summary) setSummary(result.summary);
                      setActionMessage(result.message);
                      return;
                    }
                    setCommitMessage(result?.message || 'The book was placed.');
                    setStep(5);
                  });
                }}
              >
                Commit the book
              </button>
            </div>
          ) : null}
          {step === 5 ? <p data-testid="recover-commit-result">{commitMessage}</p> : null}
          <div className="flex flex-wrap gap-2">
            {caps.canImport ? (
              <button type="button" className={recoverGhost} data-testid="recover-load-demo" onClick={() => void Promise.resolve(onLoadDemo?.()).then(remember)}>Load the fictional Harbour demo book</button>
            ) : null}
            {caps.canClearDemo ? (
              <button type="button" className={recoverGhost} data-testid="recover-clear-demo" onClick={() => void Promise.resolve(onClearDemo?.()).then(remember)}>Clear demo book</button>
            ) : null}
          </div>
          <BatchList
            batches={book.batches}
            onRollback={(id) => {
              void Promise.resolve(onRollback?.(id)).then(remember);
            }}
          />
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
  onSave,
  customers = [],
}: {
  phase: BookPhase;
  creditors: RecoverCreditor[];
  mandates: RecoverMandate[];
  showDemo?: boolean;
  onSave?: (op: CreditorSave) => boolean | Promise<boolean>;
  customers?: { id: number | string; trading_name: string }[];
}) {
  const live = useRecoverDesk();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const chosen = creditors.find((row) => row.id === selected) || null;
  useEffect(() => {
    if (!open) return;
    const root = dialogRef.current;
    const nodes = () => [...(root?.querySelectorAll<HTMLElement>('input, select, textarea, button') || [])];
    nodes()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const list = nodes();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
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
              <p className="text-sm">{counted(row.mandate_count ?? mandates.filter((item) => item.creditor_id === row.id).length, 'mandate', 'mandates')} · {counted(row.account_count ?? 0, 'account', 'accounts')}</p>
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
          <form
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recover-creditor-dialog-title"
            className="w-full max-w-lg rounded-t-3xl bg-white p-5 sm:rounded-3xl"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const op: CreditorSave = {
                op: 'creditor.upsert',
                name: String(data.get('name') || ''),
                reg_no: String(data.get('reg_no') || ''),
                contact_email: String(data.get('contact_email') || ''),
                customer_id: String(data.get('customer_id') || ''),
              };
              const send = onSave ? onSave(op) : live.save(op);
              void Promise.resolve(send).then((ok) => {
                if (ok !== false) setOpen(false);
              });
            }}
          >
            <h2 id="recover-creditor-dialog-title" className="text-xl font-black">Creditor</h2>
            <label className="mt-3 block text-xs font-bold">Name<input className={recoverField} name="name" required /></label>
            <label className="mt-3 block text-xs font-bold">
              Customer
              <select className={recoverField} name="customer_id" data-testid="recover-customer-picker">
                <option value="">No customer link</option>
                {customers.map((row) => (
                  <option key={row.id} value={String(row.id)}>{row.trading_name}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-bold">Registration<input className={recoverField} name="reg_no" /></label>
            <label className="mt-3 block text-xs font-bold">Email<input className={recoverField} name="contact_email" type="email" /></label>
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

export function MandateBookView({
  phase,
  mandates,
  creditors = [],
  onSave,
}: {
  phase: BookPhase;
  mandates: RecoverMandate[];
  creditors?: { id: string; name: string }[];
  onSave?: (op: MandateSave) => boolean | Promise<boolean>;
}) {
  const live = useRecoverDesk();
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
        <div className="grid gap-3 sm:grid-cols-2">
          {mandates.map((row) => {
            const accounts = row.account_count ?? 0;
            return (
              <article key={row.id} className={`${recoverCard} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Creditor</p>
                    <h2 className="truncate font-black text-[#0f172a]">{row.creditor_name}</h2>
                  </div>
                  <StatusChip status={row.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Product</dt>
                    <dd className="font-semibold text-[#0f172a]">{PRODUCT_LABEL[row.product_type] || 'Other'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Agreement</dt>
                    <dd className="truncate font-semibold text-[#0f172a]">{row.agreement_reference?.trim() || 'Not recorded'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Accounts</dt>
                    <dd className="font-semibold text-[#0f172a]">{counted(accounts, 'account', 'accounts')}</dd>
                  </div>
                </dl>
                {accounts > 0 ? (
                  <p className="mt-3 text-xs text-slate-600">This mandate has accounts, so the creditor, product, and credit-agreement setting stay as they are.</p>
                ) : null}
                {row.nca_regulated ? <p className="mt-2 text-sm text-slate-700">Accounts under this mandate will follow the credit-agreement notice steps when the workflow arrives; RecoverAdvisor® does not apply them yet.</p> : null}
                <p className="mt-2 text-sm text-slate-700">Commission is recorded for later; no fee is calculated or charged by RecoverAdvisor® yet.</p>
                <p className="mt-2 text-xs text-slate-600">Allocation order ⚖ VERIFY. The agreement document itself is not stored yet.</p>
              </article>
            );
          })}
          <button type="button" className={recoverBtn} data-testid="recover-mandate-add" onClick={() => setOpen(true)}>Add a mandate</button>
        </div>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-900/40 sm:items-center sm:justify-center" data-testid="recover-mandate-drawer">
          <form
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const op: MandateSave = {
                op: 'mandate.upsert',
                creditor_id: String(data.get('creditor_id') || ''),
                product_type: String(data.get('product_type') || ''),
                nca_regulated: data.get('nca_regulated') === 'on',
                commission_model: { kind: String(data.get('commission_kind') || 'flat_per_account') },
              };
              const send = onSave ? onSave(op) : live.save(op);
              void Promise.resolve(send).then((ok) => {
                if (ok !== false) setOpen(false);
              });
            }}
          >
            <h2 className="text-xl font-black">Mandate</h2>
            <label className="mt-3 block text-xs font-bold">
              Creditor
              <select className={recoverField} name="creditor_id" required>
                <option value="">Choose a creditor</option>
                {creditors.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-bold">
              Product
              <select className={recoverField} name="product_type" required defaultValue="trade">
                <option value="nca_credit">Credit</option>
                <option value="trade">Trade</option>
                <option value="levy">Levy</option>
                <option value="rent">Rent</option>
                <option value="medical">Medical</option>
                <option value="utility">Utility</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-bold">
              <input name="nca_regulated" type="checkbox" /> Credit agreement recorded
            </label>
            <label className="mt-3 block text-xs font-bold">
              Commission kind
              <select className={recoverField} name="commission_kind" defaultValue="flat_per_account">
                <option value="pct_of_recovered">Percent of recovered</option>
                <option value="tiered">Tiered</option>
                <option value="flat_per_account">Flat per account</option>
                <option value="flat_plus_pct">Flat plus percent</option>
              </select>
            </label>
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
  const [pending, setPending] = useState<string | null>(null);
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
          <button type="button" className={`${recoverGhost} mt-2 whitespace-nowrap`} data-testid={batch.file_name === 'upload.csv' ? 'recover-rollback-upload' : `recover-rollback-${batch.id}`} onClick={() => setPending(batch.id)}>Rollback</button>
          {pending === batch.id ? (
            <div data-testid="recover-confirm" className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-[#0f172a]">
              <p>{ROLLBACK_REFUSAL}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={`${recoverBtn} whitespace-nowrap`} onClick={() => { setPending(null); onRollback?.(batch.id); }}>Confirm</button>
                <button type="button" className={recoverGhost} onClick={() => setPending(null)}>Cancel</button>
              </div>
            </div>
          ) : null}
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
