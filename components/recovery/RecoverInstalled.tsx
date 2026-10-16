'use client';

import { useState } from 'react';
import { AccountsView } from './book-views';
import { emptyMemory, visibleAccounts, type MemoryBook } from '@/lib/recovery/preview-memory';
import { capabilitiesFor } from '@/lib/recovery/roles';

type InstalledRole = 'owner' | 'agent' | 'client';

const TABS = [
  { id: 'command', label: 'Command' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'creditors', label: 'Creditors' },
  { id: 'imports', label: 'Imports' },
] as const;

export function RecoverInstalled({ role, book }: { role: InstalledRole; book?: MemoryBook | null }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('accounts');
  const data = book || emptyMemory();
  const deskRole = role === 'agent' ? 'agent' : 'owner';
  const caps = capabilitiesFor(deskRole);
  const rows = visibleAccounts(data, deskRole);
  const tabs = role === 'agent' ? TABS.filter((item) => item.id === 'command' || item.id === 'accounts') : TABS;
  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 text-[#0f172a]" data-testid="recover-installed">
      <div className="px-4 py-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0077b6]">RecoverAdvisor®</p>
        <h1 className="mt-2 text-2xl font-black">{role === 'agent' ? 'Your accounts' : 'The book'}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {role === 'agent'
            ? 'Signed-in agents see only accounts assigned to them. Notes stay on those accounts. Invite links are not issued yet.'
            : 'Command, accounts, creditors, and import status are in this app. Queue scoring and trust money stay launching soon.'}
        </p>
        {book ? (
          <p className="mt-3 text-sm font-semibold">Demo data. No messages are sent.</p>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Sign in to open the company book.</p>
        )}
        {tab === 'accounts' ? (
          <div className="mt-4">
            <AccountsView phase="ready" book={role === 'agent' ? { ...data, accounts: rows } : data} role={deskRole} caps={caps} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-700">{rows.length} accounts on this view.</p>
        )}
      </div>
      {role === 'owner' ? (
        <nav data-testid="recover-bottom-nav" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e2e8f0] bg-white px-2 pb-[env(safe-area-inset-bottom)]" aria-label="App">
          <ul className="grid grid-cols-4">
            {tabs.map((item) => (
              <li key={item.id}>
                <button type="button" className="inline-flex min-h-11 w-full items-center justify-center text-xs font-black text-[#0f172a]" onClick={() => setTab(item.id)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
