'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { RECOVER_DEMO_BANNER } from '@/lib/recovery/brand';
import { recovergraphNavSteps, recoverSidebarSteps } from '@/lib/recovery/nav';
import { blankDesk, illustrationFor, sampleDesk } from '@/lib/recovery/sample-desk';
import { AccountView, AccountsView, CreditorBookView, ImportView, MandateBookView } from './book-views';
import { RecoverCreditors, RecoverMandates } from './RecoverBooks';
import { RecoverCommand } from './RecoverCommand';
import { RecoverInstalled } from './RecoverInstalled';
import { RecoverPortals } from './RecoverPortals';
import { RecoverQueue } from './RecoverQueue';
import { RecoverTeam } from './RecoverTeam';
import { ClientAccount } from './RecoverPreviews';
import {
  assignPreviewAccount,
  clearHarbourSession,
  commitPreviewCsv,
  emptyMemory,
  harbourDesk,
  harbourMemory,
  mergePreviewDebtors,
  readHarbourSession,
  rememberPreviewCreditor,
  rememberPreviewMandate,
  rollbackPreview,
  writeHarbourSession,
  type MemoryBook,
} from '@/lib/recovery/preview-memory';
import { capabilitiesFor } from '@/lib/recovery/roles';
import { HARBOUR_CREDITORS, HARBOUR_CUSTOMERS, HARBOUR_TEAM } from '@/lib/recovery/harbour-seed';
import { PreviewBookProvider, RecoverPreviewProvider, useRecoverIllustration, type DeskSave } from './useRecoverDesk';

const PreviewRoleContext = createContext<PreviewRole>('owner');

export type PreviewRole = 'owner' | 'manager' | 'agent' | 'finance' | 'compliance' | 'viewer' | 'client';

function readRole(value: string | null): PreviewRole {
  if (value === 'agent' || value === 'worker') return 'agent';
  if (value === 'client') return 'client';
  if (value === 'manager' || value === 'finance' || value === 'compliance' || value === 'viewer') return value;
  return 'owner';
}

function ClientSample() {
  const picture = useRecoverIllustration();
  return (
    <div className="grid gap-4" data-testid="recover-preview-client">
      <div
        data-testid="recover-banner-demo"
        role="status"
        className="rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white px-4 py-3 text-sm font-medium leading-relaxed text-slate-900 shadow-sm"
      >
        {RECOVER_DEMO_BANNER}
      </div>
      {picture ? <ClientAccount picture={picture} /> : null}
    </div>
  );
}

type BookMode = 'sample' | 'empty' | 'pending' | 'nav' | 'harbour';

function readBook(value: string | null): BookMode {
  if (value === 'empty' || value === 'pending' || value === 'nav' || value === 'harbour') return value;
  return 'sample';
}

function NavSheet() {
  const steps = recoverSidebarSteps('owner', null, recovergraphNavSteps());
  return (
    <div data-testid="recover-preview-nav" className="mx-auto max-w-sm rounded-3xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0077b6]">RecoverAdvisor®</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight">Navigation</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        The sidebar group for an owner. No accounts yet.
      </p>
      <ul className="mt-4 space-y-2">
        {steps.map((step) => {
          const root = '/dashboard/recovergraph';
          const href = step.href.startsWith(root)
            ? `/preview/recovergraph${step.href.slice(root.length)}?book=empty&role=owner`
            : step.href;
          return (
            <li key={step.href}>
              <a
                href={href}
                className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3"
              >
                <span>
                  <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">{step.section}</span>
                  <span className="block text-sm font-black text-[#0f172a]">{step.name}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PreviewShell({ children }: { children: ReactNode }) {
  const path = usePathname() || '/preview/recovergraph';
  const [role, setRole] = useState<PreviewRole>('owner');
  const [book, setBook] = useState<BookMode>('sample');
  const [memory, setMemory] = useState<MemoryBook>(emptyMemory());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reset = params.get('reset') === '1';
    const nextBook = reset ? 'harbour' : readBook(params.get('book'));
    setRole(readRole(params.get('role')));
    setBook(nextBook);
    setAccountId(params.get('account'));
    if (reset) clearHarbourSession();
    setMemory(nextBook === 'harbour' ? (reset ? harbourMemory() : readHarbourSession() || harbourMemory()) : emptyMemory());
    setReady(true);
  }, [path]);

  const remember = (next: MemoryBook) => {
    setMemory(next);
    if (book === 'harbour' || new URLSearchParams(window.location.search).get('book') === 'harbour' || new URLSearchParams(window.location.search).get('reset') === '1') {
      writeHarbourSession(next);
    }
  };

  const deskRole = role === 'agent' ? 'agent' : 'owner';
  const desk = useMemo(() => {
    if (book === 'harbour') return harbourDesk(role === 'client' ? 'viewer' : role, memory);
    if (book === 'pending') return blankDesk('pending', deskRole);
    if (book === 'empty' || book === 'nav') return blankDesk('empty', deskRole);
    return sampleDesk(deskRole);
  }, [book, deskRole, memory, role]);
  const picture = useMemo(() => {
    if (book !== 'sample') return null;
    if (role === 'finance' || role === 'compliance' || role === 'viewer' || role === 'manager') return null;
    return illustrationFor(role === 'client' ? 'client' : role === 'agent' ? 'agent' : 'owner');
  }, [book, role]);
  const steps = recovergraphNavSteps();
  const query = book === 'sample' ? `role=${role}` : `role=${role}&book=${book}`;

  return (
    <PreviewRoleContext.Provider value={role}>
    <MemoryContext.Provider value={{ memory, setMemory: remember, mode: book, accountId }}>
    <RecoverPreviewProvider
      desk={desk}
      illustration={picture}
      hrefBase={`/preview/recovergraph?${query}`}
    >
      <div
        className="min-h-screen bg-[#f8fafc] text-[#0f172a]"
        data-book-ready={ready ? '1' : '0'}
        data-testid="recover-preview"
      >
        <div className="border-b border-[#e2e8f0] bg-white">
          <div className="mx-auto flex h-12 max-w-6xl flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap px-3">
            <p className="shrink-0 text-xs font-black uppercase tracking-wide text-[#0f172a]">
              {book === 'sample' ? 'RecoverAdvisor® Sample' : 'RecoverAdvisor®'}
            </p>
            <p className="shrink-0 text-xs font-bold text-slate-600">
              {book === 'sample' ? 'Illustration · sample data' : book === 'harbour' ? 'Demo data. No messages are sent.' : 'No accounts yet'}
            </p>
            {(
              [
                ['owner', 'Owner'],
                ['agent', 'Agent'],
                ['client', 'Client'],
              ] as const
            ).map(([item, label]) => (
              <a
                key={item}
                className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-xs font-black ${
                  role === item ? 'bg-[#00b4d8] text-[#0f172a]' : 'bg-white text-slate-700 ring-1 ring-slate-200'
                }`}
                href={`${path}?role=${item}${book === 'sample' ? '' : `&book=${book}`}`}
              >
                {label}
              </a>
            ))}
            <nav aria-label="Sample sections" data-testid="recover-preview-nav" className="flex shrink-0 items-center gap-2">
            {steps.map((step) => {
              const root = '/dashboard/recovergraph';
              const href = step.href.startsWith(root)
                ? `/preview/recovergraph${step.href.slice(root.length)}?${query}`
                : step.href;
              return (
                <a
                  key={step.href}
                  href={href}
                  className="inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white px-3 text-xs font-bold text-slate-800 ring-1 ring-slate-200"
                >
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{step.section}</span>
                  <span>{step.name}</span>
                </a>
              );
            })}
            </nav>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-3 py-4">
          {ready ? (
            book === 'nav' ? <NavSheet /> : book === 'harbour' ? (
              <PreviewBookProvider onOp={(op) => { remember(applyHarbourOp(memory, op)); return true; }}>
                <div className="sa-page">{children}</div>
              </PreviewBookProvider>
            ) : <div className="sa-page">{children}</div>
          ) : (
            <div className="h-40 animate-pulse rounded-3xl bg-slate-100 motion-reduce:animate-none" />
          )}
        </div>
      </div>
    </RecoverPreviewProvider>
    </MemoryContext.Provider>
    </PreviewRoleContext.Provider>
  );
}

const MemoryContext = createContext<{
  memory: MemoryBook;
  setMemory: (book: MemoryBook) => void;
  mode: BookMode;
  accountId: string | null;
} | null>(null);

export function PreviewDesk({ view }: { view: string }) {
  const role = useContext(PreviewRoleContext);
  const memory = useContext(MemoryContext);
  const deskRole = role === 'agent' || role === 'finance' || role === 'compliance' || role === 'viewer' || role === 'manager' ? role : 'owner';
  if (role === 'client') return <ClientSample />;
  if (view === 'installed') {
    return <RecoverInstalled role={role === 'agent' ? 'agent' : 'owner'} book={memory?.mode === 'harbour' ? memory.memory : null} />;
  }
  if (memory?.mode === 'harbour' && view === 'accounts') {
    const caps = capabilitiesFor(deskRole);
    const people = harbourDesk(deskRole, memory.memory).staff
      .filter((row) => row.status === 'active' && row.role === 'collector')
      .map((row) => ({ id: row.id, label: row.email }));
    return (
      <AccountsView
        phase="ready"
        book={memory.memory}
        role={deskRole}
        caps={caps}
        showDemo
        onOpen={(id) => {
          const params = new URLSearchParams(window.location.search);
          if (!params.get('book')) params.set('book', 'harbour');
          params.set('account', id);
          window.location.assign(`/preview/recovergraph/account?${params.toString()}`);
        }}
        assignees={people}
        onAssign={caps.canMutateAccounts ? async (accountId, staffId) => {
          const person = HARBOUR_TEAM.find((row) => row.key === staffId);
          memory.setMemory(assignPreviewAccount(memory.memory, accountId, staffId, person?.name || staffId));
          return true;
        } : undefined}
        onBulkAssign={caps.canMutateAccounts ? async (ids, staffId) => {
          const person = HARBOUR_TEAM.find((row) => row.key === staffId);
          memory.setMemory(ids.reduce((book, id) => assignPreviewAccount(book, id, staffId, person?.name || staffId), memory.memory));
          return true;
        } : undefined}
        onMerge={caps.canMutateAccounts ? async (sourceId, targetId) => {
          memory.setMemory(mergePreviewDebtors(memory.memory, sourceId, targetId));
          return true;
        } : undefined}
      />
    );
  }
  if (memory?.mode === 'harbour' && view === 'account') {
    const rows = visibleRows(memory.memory, deskRole);
    const account =
      rows.find((row) => row.id === memory.accountId) ||
      rows.find((row) => row.flags.length > 0) ||
      rows[0] ||
      null;
    const caps = capabilitiesFor(deskRole);
    const patch = (next: MemoryBook) => memory.setMemory(next);
    return (
      <AccountView
        phase="ready"
        account={account}
        role={deskRole}
        caps={caps}
        showDemo
        onReveal={async () => ({ id_number: account?.id_masked || '••••••' })}
        onNote={caps.canAddNote && account ? async (note) => {
          patch({
            ...memory.memory,
            accounts: memory.memory.accounts.map((row) => row.id === account.id ? {
              ...row,
              notes: [...row.notes, { at: 'today', text: note }],
              events: [...row.events, { id: `note-${row.notes.length}`, type: 'note', at: 'today', label: 'Note', note }],
            } : row),
          });
          return true;
        } : undefined}
        onFlag={caps.canMutateAccounts && account ? async (flag, reason, clear) => {
          patch({
            ...memory.memory,
            accounts: memory.memory.accounts.map((row) => row.id === account.id ? {
              ...row,
              flags: clear ? row.flags.filter((item) => item.key !== flag) : [...row.flags.filter((item) => item.key !== flag), { key: flag, reason }],
            } : row),
          });
          return true;
        } : undefined}
        onAdjust={caps.canMutateAccounts && account ? async (cents) => {
          patch({
            ...memory.memory,
            accounts: memory.memory.accounts.map((row) => row.id === account.id ? { ...row, adjustment_cents: cents } : row),
          });
          return true;
        } : undefined}
        onRecall={caps.canMutateAccounts && account ? async (closeReason) => {
          patch({
            ...memory.memory,
            accounts: memory.memory.accounts.map((row) => row.id === account.id ? {
              ...row,
              state: 'recalled',
              events: [...row.events, { id: 'recall', type: 'recall', at: 'today', label: 'Recalled', note: closeReason }],
            } : row),
          });
          return true;
        } : undefined}
      />
    );
  }
  if (memory?.mode === 'harbour' && view === 'imports') {
    return (
      <ImportView
        phase="ready"
        book={memory.memory}
        caps={capabilitiesFor(deskRole)}
        onCommit={async (input) => {
          const result = await commitPreviewCsv(memory.memory, input.csv, input.creditorId);
          memory.setMemory(result.book);
          if (result.code === 'imported') return { ok: true, message: `Placed ${result.created} accounts.` };
          return {
            ok: false,
            message: result.code === 'already_imported' ? 'That file is already placed for this creditor.' : 'That file could not be placed.',
            errors: result.errors,
          };
        }}
        onRollback={(id) => {
          const result = rollbackPreview(memory.memory, id);
          memory.setMemory(result.book);
          return result.code === 'rolled_back'
            ? { ok: true, message: 'That batch was rolled back.' }
            : { ok: false, message: 'That batch can no longer be rolled back.' };
        }}
        onLoadDemo={() => {
          memory.setMemory(harbourMemory());
          return { ok: true, message: 'The fictional Harbour demo book is on this workspace.' };
        }}
        onClearDemo={() => {
          memory.setMemory(emptyMemory());
          return { ok: true, message: 'The demo book was cleared.' };
        }}
        showDemo
      />
    );
  }
  if (memory?.mode === 'harbour' && view === 'creditors') {
    const desk = harbourDesk(deskRole, memory.memory);
    return (
      <CreditorBookView
        phase="ready"
        creditors={desk.creditors}
        mandates={desk.mandates}
        showDemo
        customers={HARBOUR_CUSTOMERS.map((row) => ({ id: row.id, trading_name: row.trading_name }))}
        onSave={(op) => {
          const name = String(op.name || '').trim();
          if (!name) return false;
          memory.setMemory(rememberPreviewCreditor(memory.memory, name, String(op.reg_no || ''), String(op.customer_id || '')));
          return true;
        }}
      />
    );
  }
  if (memory?.mode === 'harbour' && view === 'mandates') {
    const mandateDesk = harbourDesk(deskRole, memory.memory);
    return (
      <MandateBookView
        phase="ready"
        mandates={mandateDesk.mandates}
        creditors={mandateDesk.creditors}
        onSave={(op) => {
          const creditor = mandateDesk.creditors.find((row) => row.id === op.creditor_id);
          if (!creditor || !op.product_type) return false;
          memory.setMemory(rememberPreviewMandate(memory.memory, {
            creditor_id: creditor.id,
            creditor_name: creditor.name,
            product_type: op.product_type,
            nca_regulated: Boolean(op.nca_regulated),
          }));
          return true;
        }}
      />
    );
  }
  if (view === 'accounts') return <AccountsView phase="ready" book={emptyMemory()} role={deskRole} caps={capabilitiesFor(deskRole)} />;
  if (view === 'imports') return <ImportView phase="ready" book={emptyMemory()} caps={capabilitiesFor(deskRole)} />;
  if (view === 'queue') return <RecoverQueue />;
  if (view === 'creditors') return <RecoverCreditors />;
  if (view === 'mandates') return <RecoverMandates />;
  if (view === 'team') return <RecoverTeam />;
  if (view === 'portals') return <RecoverPortals />;
  return <RecoverCommand />;
}

function applyHarbourOp(book: MemoryBook, op: DeskSave): MemoryBook {
  if (op.op === 'workspace.set_assignment_block') return { ...book, blockUnregistered: op.enabled !== false };
  if (op.op === 'account.assign' && op.id && op.staff_id) {
    const person = HARBOUR_TEAM.find((row) => row.key === op.staff_id);
    return assignPreviewAccount(book, op.id, op.staff_id, person?.name || op.staff_id);
  }
  if (op.op === 'account.bulk_assign' && op.ids && op.staff_id) {
    const person = HARBOUR_TEAM.find((row) => row.key === op.staff_id);
    return op.ids.reduce((current, id) => assignPreviewAccount(current, id, String(op.staff_id), person?.name || String(op.staff_id)), book);
  }
  if (op.op === 'debtor.merge' && op.source_id && op.target_id) return mergePreviewDebtors(book, op.source_id, op.target_id);
  return book;
}

function visibleRows(book: MemoryBook, role: PreviewRole) {
  if (role === 'agent') return book.accounts.filter((row) => row.assignee === 'pieter');
  if (role === 'viewer') return [];
  if (role === 'finance' || role === 'compliance') return book.accounts.map((row) => ({ ...row, contacts: [] }));
  return book.accounts;
}

const LAUNCH_COPY = {
  owner: {
    title: 'The book',
    body: 'Command, accounts, creditors, and import status open in this app. Queue scoring and trust money stay launching soon.',
  },
  manager: {
    title: 'The book',
    body: 'Command, accounts, creditors, and import status open in this app.',
  },
  agent: {
    title: 'Your accounts',
    body: 'Signed-in agents see the accounts assigned to them, with masked identity numbers and notes. Invite links are not issued yet.',
  },
  finance: {
    title: 'Accounts',
    body: 'Finance sees placed balances without contact points. Trust money stays launching soon.',
  },
  compliance: {
    title: 'Accounts',
    body: 'Compliance sees placed accounts without contact points.',
  },
  viewer: {
    title: 'Counts',
    body: 'A viewer sees counts only.',
  },
  client: {
    title: 'Your placed accounts',
    body: 'Your placed accounts and statements will appear here when the client portal opens. This page reads no token.',
  },
} as const;

export function RecoverLaunching({ role }: { role: PreviewRole }) {
  if (role === 'owner') return <RecoverInstalled role="owner" />;
  if (role === 'agent') return <RecoverInstalled role="agent" />;
  const copy = LAUNCH_COPY[role];
  return (
    <main
      className="min-h-screen bg-[#f8fafc] px-4 py-8 text-[#0f172a]"
      data-testid={`recover-pwa-${role}`}
    >
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0077b6]">RecoverAdvisor®</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight">{copy.title}</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">{copy.body}</p>
      <p className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a]">
        Launching soon
      </p>
    </main>
  );
}
