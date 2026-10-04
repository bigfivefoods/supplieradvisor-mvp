/**
 * Quote (and other commercial doc) list: filter + group by date or customer.
 */

export type DocListGroupBy = 'none' | 'date' | 'customer';

export type GroupableDoc = {
  id?: number;
  created_at?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
  total_amount?: number | null;
  currency?: string | null;
};

export type DocListGroup<T extends GroupableDoc = GroupableDoc> = {
  key: string;
  label: string;
  items: T[];
};

export function docCreatedDate(d: GroupableDoc): string {
  const s = String(d.created_at || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function formatDocGroupDate(iso: string): string {
  if (!iso) return 'No date';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function filterGroupedDocs<T extends GroupableDoc>(
  docs: T[],
  opts: { customerId?: string; dateFrom?: string; dateTo?: string }
): T[] {
  const cid = String(opts.customerId || '').trim();
  const from = String(opts.dateFrom || '').slice(0, 10);
  const to = String(opts.dateTo || '').slice(0, 10);
  return docs.filter((d) => {
    if (cid && cid !== 'all') {
      if (String(d.customer_id || '') !== cid) return false;
    }
    const day = docCreatedDate(d);
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from) && (!day || day < from)) {
      return false;
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to) && (!day || day > to)) {
      return false;
    }
    return true;
  });
}

export function groupDocs<T extends GroupableDoc>(
  docs: T[],
  by: DocListGroupBy
): DocListGroup<T>[] {
  if (by !== 'date' && by !== 'customer') {
    return [{ key: 'all', label: '', items: docs }];
  }
  const map = new Map<string, T[]>();
  const labels = new Map<string, string>();
  for (const d of docs) {
    let key: string;
    let label: string;
    if (by === 'date') {
      const day = docCreatedDate(d);
      key = day || 'none';
      label = day ? formatDocGroupDate(day) : 'No date';
    } else {
      const id =
        d.customer_id != null && Number(d.customer_id) > 0
          ? String(d.customer_id)
          : '';
      const name = String(d.customer_name || '').trim();
      key = id ? `id:${id}` : name ? `name:${name.toLowerCase()}` : 'none';
      label = name || (id ? `Customer ${id}` : 'No customer');
    }
    const list = map.get(key) || [];
    list.push(d);
    map.set(key, list);
    if (!labels.has(key)) labels.set(key, label);
  }
  const keys = [...map.keys()];
  if (by === 'date') {
    keys.sort((a, b) => {
      if (a === 'none') return 1;
      if (b === 'none') return -1;
      return b.localeCompare(a);
    });
  } else {
    keys.sort((a, b) => {
      if (a === 'none') return 1;
      if (b === 'none') return -1;
      return String(labels.get(a)).localeCompare(String(labels.get(b)));
    });
  }
  return keys.map((key) => ({
    key,
    label: labels.get(key) || key,
    items: map.get(key) || [],
  }));
}

export function groupMoneyTotal<T extends GroupableDoc>(
  items: T[]
): { amount: number; currency: string } | null {
  if (!items.length) return null;
  const currency = String(items[0].currency || 'ZAR');
  if (items.some((i) => String(i.currency || 'ZAR') !== currency)) return null;
  return {
    amount: items.reduce((s, i) => s + Number(i.total_amount || 0), 0),
    currency,
  };
}
