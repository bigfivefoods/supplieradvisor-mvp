/**
 * Slice-and-dice series for customer quotes / orders / invoices.
 */
import {
  docCreatedDate,
  formatDocGroupDate,
  groupMoneyTotal,
  type GroupableDoc,
} from './doc-list-group';

export type DeskSeriesPoint = {
  key: string;
  label: string;
  amount: number;
  count: number;
};

function spanDays(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

export function docsValueByTime<T extends GroupableDoc>(
  docs: T[],
  from: string,
  to: string
): DeskSeriesPoint[] {
  const byMonth = spanDays(from, to) > 40;
  const map = new Map<string, { amount: number; count: number }>();
  for (const d of docs) {
    const day = docCreatedDate(d);
    if (!day) continue;
    const key = byMonth ? day.slice(0, 7) : day;
    const cur = map.get(key) || { amount: 0, count: 0 };
    cur.amount += Number(d.total_amount || 0);
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({
      key,
      label: byMonth
        ? formatDocGroupDate(`${key}-01`).replace(/^\d+\s/, '')
        : formatDocGroupDate(key).replace(/ \d{4}$/, ''),
      amount: Math.round(v.amount * 100) / 100,
      count: v.count,
    }));
}

export function docsValueByCustomer<T extends GroupableDoc>(
  docs: T[],
  limit = 8
): DeskSeriesPoint[] {
  const map = new Map<string, { label: string; amount: number; count: number }>();
  for (const d of docs) {
    const id =
      d.customer_id != null && Number(d.customer_id) > 0
        ? `id:${d.customer_id}`
        : String(d.customer_name || '').trim()
          ? `name:${String(d.customer_name).trim().toLowerCase()}`
          : 'none';
    const label =
      String(d.customer_name || '').trim() ||
      (id === 'none' ? 'No customer' : `Customer ${String(d.customer_id)}`);
    const cur = map.get(id) || { label, amount: 0, count: 0 };
    cur.amount += Number(d.total_amount || 0);
    cur.count += 1;
    map.set(id, cur);
  }
  const rows = [...map.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      amount: Math.round(v.amount * 100) / 100,
      count: v.count,
    }))
    .sort((a, b) => b.amount - a.amount);
  if (rows.length <= limit) return rows;
  const head = rows.slice(0, limit);
  const rest = rows.slice(limit);
  head.push({
    key: 'other',
    label: 'Other',
    amount: Math.round(rest.reduce((s, r) => s + r.amount, 0) * 100) / 100,
    count: rest.reduce((s, r) => s + r.count, 0),
  });
  return head;
}

export function docsValueByStatus<T extends GroupableDoc>(
  docs: T[]
): DeskSeriesPoint[] {
  const map = new Map<string, { amount: number; count: number }>();
  for (const d of docs) {
    const key = String((d as { status?: string }).status || 'unknown').toLowerCase();
    const cur = map.get(key) || { amount: 0, count: 0 };
    cur.amount += Number(d.total_amount || 0);
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([key, v]) => ({
      key,
      label: key.replace(/_/g, ' '),
      amount: Math.round(v.amount * 100) / 100,
      count: v.count,
    }));
}

export function docsDeskTotals<T extends GroupableDoc>(docs: T[]) {
  const money = groupMoneyTotal(docs);
  return {
    count: docs.length,
    amount: money?.amount ?? docs.reduce((s, d) => s + Number(d.total_amount || 0), 0),
    currency: money?.currency || String(docs[0]?.currency || 'ZAR'),
  };
}
