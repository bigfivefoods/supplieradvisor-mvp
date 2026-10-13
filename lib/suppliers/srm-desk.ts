/**
 * Pure helpers for the SRM desk: search, sort, board columns, and
 * timelines built only from timestamps that already exist on a record.
 */

export type SrmView = 'list' | 'table' | 'board';
export type SrmSortDir = 'asc' | 'desc';

export const SRM_VIEWS: readonly { id: SrmView; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'table', label: 'Table' },
  { id: 'board', label: 'Board' },
] as const;

export type TimelineStamp = {
  id: string;
  title: string;
  at?: string | null;
  detail?: string;
};

export type TimelineEvent = {
  id: string;
  title: string;
  at: string;
  detail?: string;
};

export function matchesQuery(
  query: string,
  parts: Array<string | number | null | undefined>
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((part) => String(part ?? '').toLowerCase().includes(needle));
}

export function compareText(a: string, b: string, dir: SrmSortDir = 'asc'): number {
  const n = a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  return dir === 'asc' ? n : -n;
}

export function compareNum(a: number, b: number, dir: SrmSortDir = 'desc'): number {
  const left = Number.isFinite(a) ? a : 0;
  const right = Number.isFinite(b) ? b : 0;
  const n = left - right;
  return dir === 'asc' ? n : -n;
}

export function groupBy<T>(
  rows: readonly T[],
  keyOf: (row: T) => string
): { key: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row) || 'other';
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return [...map.entries()].map(([key, grouped]) => ({ key, rows: grouped }));
}

/** Drop missing or unparseable stamps. Newest first. Never invents events. */
export function timelineFromStamps(stamps: readonly TimelineStamp[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const stamp of stamps) {
    if (!stamp.at) continue;
    const ms = Date.parse(stamp.at);
    if (Number.isNaN(ms)) continue;
    events.push({
      id: stamp.id,
      title: stamp.title,
      at: stamp.at,
      detail: stamp.detail,
    });
  }
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return events;
}

export function supplierTimeline(supplier: {
  created_at?: string | null;
  invited_at?: string | null;
  invite_accepted_at?: string | null;
  updated_at?: string | null;
  onchain_registered_at?: string | null;
  status?: string | null;
}): TimelineEvent[] {
  return timelineFromStamps([
    { id: 'created', title: 'Added to the supply book', at: supplier.created_at },
    { id: 'invited', title: 'Invitation sent', at: supplier.invited_at },
    { id: 'accepted', title: 'Supplier connected', at: supplier.invite_accepted_at },
    {
      id: 'onchain',
      title: 'Registered on-chain',
      at: supplier.onchain_registered_at,
    },
    {
      id: 'updated',
      title: 'Profile updated',
      at: supplier.updated_at,
      detail: supplier.status ? `Status ${supplier.status}` : undefined,
    },
  ]);
}

export const PO_BOARD_COLUMNS = [
  'draft',
  'sent',
  'accepted',
  'funded',
  'invoiced',
  'paid',
  'completed',
  'cancelled',
] as const;

export function poBoardColumn(status?: string | null): string {
  const value = String(status || 'draft').toLowerCase();
  return (PO_BOARD_COLUMNS as readonly string[]).includes(value) ? value : 'other';
}

export const SUPPLIER_BOARD_COLUMNS = [
  'prospect',
  'preferred',
  'active',
  'blocked',
  'archived',
] as const;

export function supplierBoardColumn(status?: string | null): string {
  const value = String(status || 'prospect').toLowerCase();
  return (SUPPLIER_BOARD_COLUMNS as readonly string[]).includes(value)
    ? value
    : 'prospect';
}

export function inviteBoardColumn(status?: string | null): string {
  const value = String(status || 'pending').toLowerCase();
  if (value === 'pending' || value === 'accepted' || value === 'revoked' || value === 'expired') {
    return value;
  }
  return 'other';
}

export function formatWhen(iso?: string | null): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
