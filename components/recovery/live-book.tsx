'use client';

import { useCallback, useEffect, useState } from 'react';
import { emptyMemory, type MemoryAccount, type MemoryBook } from '@/lib/recovery/preview-memory';
import type { BookPhase } from './book-views';

export function useLiveBatches() {
  const [phase, setPhase] = useState<BookPhase>('loading');
  const [book, setBook] = useState<MemoryBook>(emptyMemory());
  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const res = await fetch('/api/recovery/recovergraph/import', { cache: 'no-store' });
      const body = (await res.json().catch(() => null)) as {
        ready?: boolean;
        reason?: string;
        error?: string;
        batches?: {
          id: string;
          creditor_id: string;
          creditor_name: string;
          file_name: string;
          status: MemoryBook['batches'][number]['status'];
          created: number;
          skipped: number;
        }[];
      } | null;
      if (body?.reason === 'migration_pending') {
        setPhase('pending');
        setBook(emptyMemory());
        return;
      }
      if (!res.ok || !body || body.error || !body.batches) {
        setPhase('error');
        return;
      }
      setBook({
        ...emptyMemory(),
        batches: body.batches.map((row) => ({
          id: row.id,
          creditor_id: row.creditor_id,
          creditor_name: row.creditor_name,
          file_name: row.file_name,
          file_sha256: '',
          status: row.status === 'rolled_back' || row.status === 'validating' || row.status === 'rejected' ? row.status : 'imported',
          created: Number(row.created || 0),
          skipped: Number(row.skipped || 0),
          errors: [],
          account_ids: [],
        })),
      });
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { phase, book, reload: load };
}

export type AccountQuery = {
  q?: string;
  state?: string;
  assigned?: string;
  after?: string;
  afterId?: string;
  id?: string;
};

export type AccountCursor = { placed_at: string; id: string } | null;
export type DuplicateGroup = {
  name: string;
  match?: 'identity' | 'contact';
  debtors: { id: string; display_name: string; id_last4: string | null }[];
};

export function useLiveAccounts(query: AccountQuery = {}) {
  const q = query.q || '';
  const state = query.state || '';
  const assigned = query.assigned || '';
  const after = query.after || '';
  const afterId = query.afterId || '';
  const id = query.id || '';
  const [phase, setPhase] = useState<BookPhase>('loading');
  const [book, setBook] = useState<MemoryBook>(emptyMemory());
  const [placedCount, setPlacedCount] = useState<number | undefined>(undefined);
  const [next, setNext] = useState<AccountCursor>(null);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (state) params.set('state', state);
      if (assigned) params.set('assigned', assigned);
      if (after && afterId) {
        params.set('after', after);
        params.set('after_id', afterId);
      }
      if (id) params.set('id', id);
      const response = await fetch(`/api/recovery/recovergraph/accounts?${params.toString()}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        setPhase('error');
        return;
      }
      const body = (await response.json()) as {
        ready?: boolean;
        reason?: string;
        rows?: Record<string, unknown>[];
        counts?: { placed?: number };
        next?: AccountCursor;
        duplicates?: DuplicateGroup[];
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
      setNext(body.next?.placed_at && body.next.id ? body.next : null);
      setDuplicates(Array.isArray(body.duplicates) ? body.duplicates : []);
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, [q, state, assigned, after, afterId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { phase, book, placedCount, next, duplicates, reload: load };
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
    state: accountState(row.state),
    flags: flagList(row.flags),
    assignee: row.assigned_to ? String(row.assigned_to) : null,
    assignee_name: row.assignee_name ? String(row.assignee_name) : null,
    placed_at: String(row.placed_at || ''),
    batch_id: String(row.batch_id || ''),
    creditor_account_ref: String(row.creditor_account_ref || ''),
    debtor_id: String(row.debtor_id || ''),
    contacts: Array.isArray(row.contacts)
      ? (row.contacts as { kind?: string; value?: string }[]).map((contact) => ({
          kind: String(contact.kind || ''),
          value: String(contact.value || ''),
          source: 'import',
          quality: 'unknown',
          do_not_contact: false,
          s129_delivery_method: null,
        }))
      : [],
    notes: Array.isArray(row.events)
      ? (row.events as { type?: string; at?: string; note?: string }[])
          .filter((event) => event.type === 'note' && event.note)
          .map((event) => ({ at: String(event.at || ''), text: String(event.note || '') }))
      : [],
    events: Array.isArray(row.events)
      ? (row.events as { id?: string; type?: string; at?: string; label?: string; note?: string }[]).map((event) => ({
          id: event.id ? String(event.id) : undefined,
          type: String(event.type || ''),
          at: String(event.at || ''),
          label: String(event.label || 'Recorded'),
          note: event.note ? String(event.note) : '',
        }))
      : [],
    nca_regulated: false,
    product_type: String(row.mandate_label || row.product_type || ''),
  }));
  return { accounts, batches: [], next: accounts.length + 1 };
}

function accountState(value: unknown): MemoryAccount['state'] {
  const state = String(value || 'active');
  if (state === 'recalled' || state === 'arrangement' || state === 'dispute' || state === 'paid' || state === 'closed' || state === 'prescribed' || state === 'stopped') {
    return state;
  }
  return 'active';
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
