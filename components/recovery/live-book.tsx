'use client';

import { useEffect, useState } from 'react';
import { emptyMemory, type MemoryAccount, type MemoryBook } from '@/lib/recovery/preview-memory';
import type { BookPhase } from './book-views';

export function useLiveAccounts() {
  const [phase, setPhase] = useState<BookPhase>('loading');
  const [book, setBook] = useState<MemoryBook>(emptyMemory());
  const [placedCount, setPlacedCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    let stop = false;
    fetch('/api/recovery/recovergraph/accounts', { headers: { accept: 'application/json' } })
      .then(async (response) => {
        if (stop) return;
        if (!response.ok) {
          setPhase('error');
          return;
        }
        const body = (await response.json()) as {
          ready?: boolean;
          reason?: string;
          rows?: Record<string, unknown>[];
          counts?: { placed?: number };
        };
        if (body.reason === 'migration_pending') {
          setPhase('pending');
          return;
        }
        if (!body.ready) {
          setPhase('error');
          return;
        }
        const rows = Array.isArray(body.rows) ? body.rows : [];
        setBook(rowsToBook(rows));
        if (typeof body.counts?.placed === 'number') setPlacedCount(body.counts.placed);
        setPhase('ready');
      })
      .catch(() => {
        if (!stop) setPhase('error');
      });
    return () => {
      stop = true;
    };
  }, []);

  return { phase, book, placedCount };
}

function rowsToBook(rows: Record<string, unknown>[]): MemoryBook {
  const accounts: MemoryAccount[] = rows.map((row, index) => ({
    id: String(row.id || index),
    ref: String(row.ref || ''),
    creditor_id: String(row.creditor_id || ''),
    creditor_name: String(row.creditor_name || ''),
    debtor_name: String(row.display_name || 'Account'),
    id_masked: String(row.id_masked || '••••••'),
    balance_cents: Number(row.balance_cents || 0),
    principal_cents: Number(row.principal_cents || 0),
    interest_cents: Number(row.interest_cents || 0),
    fees_cents: Number(row.fees_cents || 0),
    costs_cents: Number(row.costs_cents || 0),
    adjustment_cents: Number(row.adjustment_cents || 0),
    original_cents: Number(row.original_cents || 0),
    state: row.state === 'recalled' ? 'recalled' : 'active',
    flags: flagList(row.flags),
    assignee: row.assigned_to ? String(row.assigned_to) : null,
    assignee_name: null,
    placed_at: String(row.placed_at || ''),
    batch_id: String(row.batch_id || ''),
    creditor_account_ref: String(row.creditor_account_ref || ''),
    contacts: [],
    notes: [],
    events: [{ type: 'import', at: String(row.placed_at || ''), label: 'Imported' }],
    nca_regulated: false,
    product_type: '',
  }));
  return { accounts, batches: [], next: accounts.length + 1 };
}

function flagList(value: unknown): { key: string; reason: string }[] {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item && typeof item === 'object' && 'key' in item
        ? { key: String((item as { key: unknown }).key), reason: '' }
        : { key: String(item), reason: '' }
    );
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).map((key) => ({ key, reason: '' }));
  }
  return [];
}
