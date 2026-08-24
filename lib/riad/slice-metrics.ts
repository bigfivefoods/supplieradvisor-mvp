/**
 * Slice-and-dice packs for RIAD registers (portal + CRM/SRM).
 * Same finance principle: KPI cards, then mix charts, then the register.
 */
import { isClosedLike, isOpenLike } from '@/lib/customers/riad';

export type RiadMetricRow = {
  entry_type?: string | null;
  status?: string | null;
  severity?: string | null;
  category?: string | null;
  owner_name?: string | null;
  created_at?: string | null;
};

export type RiadMetricSeg = { label: string; value: number; color: string };

export type RiadSummary = {
  total: number;
  open: number;
  closed: number;
  inProgress: number;
  onHold: number;
  critical: number;
};

const TYPE_COLORS: Record<string, string> = {
  risk: '#f43f5e',
  issue: '#f59e0b',
  action: '#0284c7',
  decision: '#8b5cf6',
};

const SEVERITY_COLORS: Record<string, string> = {
  low: '#34d399',
  medium: '#fbbf24',
  high: '#f97316',
  critical: '#ef4444',
};

const STATUS_COLORS: Record<string, string> = {
  open: '#0284c7',
  in_progress: '#6366f1',
  on_hold: '#f59e0b',
  mitigated: '#14b8a6',
  resolved: '#10b981',
  closed: '#059669',
  active: '#38bdf8',
};

const OWNER_PALETTE = [
  '#0d9488',
  '#0284c7',
  '#8b5cf6',
  '#f59e0b',
  '#f43f5e',
  '#6366f1',
  '#14b8a6',
  '#fb7185',
];

function norm(s?: string | null) {
  return String(s || '').trim().toLowerCase();
}

function tally(
  items: RiadMetricRow[],
  keyFn: (i: RiadMetricRow) => string,
  colorFn: (key: string, i: number) => string,
  labelFn?: (key: string) => string
): RiadMetricSeg[] {
  const map = new Map<string, number>();
  for (const i of items) {
    const k = keyFn(i);
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, value], i) => ({
      label: labelFn ? labelFn(key) : key.replace(/_/g, ' '),
      value,
      color: colorFn(key, i),
    }));
}

export function riadSummaryOf(items: RiadMetricRow[]): RiadSummary {
  const n = (s?: string | null) => norm(s) || 'open';
  return {
    total: items.length,
    open: items.filter((i) => isOpenLike(i.status)).length,
    closed: items.filter((i) => isClosedLike(i.status)).length,
    inProgress: items.filter((i) => n(i.status) === 'in_progress').length,
    onHold: items.filter((i) => n(i.status) === 'on_hold').length,
    critical: items.filter(
      (i) =>
        isOpenLike(i.status) &&
        norm(i.severity) === 'critical'
    ).length,
  };
}

export function riadSlicePack(items: RiadMetricRow[]) {
  const byType = tally(
    items,
    (i) => norm(i.entry_type) || 'issue',
    (k) => TYPE_COLORS[k] || '#64748b',
    (k) => k.charAt(0).toUpperCase() + k.slice(1)
  );
  const bySeverity = ['low', 'medium', 'high', 'critical'].map((k) => ({
    label: k.charAt(0).toUpperCase() + k.slice(1),
    value: items.filter((i) => (norm(i.severity) || 'medium') === k).length,
    color: SEVERITY_COLORS[k],
  })).filter((s) => s.value > 0);
  const byStatus = tally(
    items,
    (i) => norm(i.status) || 'open',
    (k) => STATUS_COLORS[k] || '#64748b'
  );
  const byOwner = tally(
    items,
    (i) => String(i.owner_name || '').trim() || 'Unassigned',
    (_k, i) => OWNER_PALETTE[i % OWNER_PALETTE.length]
  ).slice(0, 8);
  const byCategory = tally(
    items,
    (i) => String(i.category || '').trim() || 'Uncategorised',
    (_k, i) => OWNER_PALETTE[i % OWNER_PALETTE.length]
  ).slice(0, 8);

  const months: Array<{ label: string; open: number; closed: number; key: string }> = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-GB', { month: 'short' });
    months.push({ label, open: 0, closed: 0, key });
  }
  const monthMap = new Map(months.map((m) => [m.key, m]));
  for (const i of items) {
    const raw = i.created_at ? String(i.created_at).slice(0, 7) : '';
    const hit = monthMap.get(raw);
    if (!hit) continue;
    if (isClosedLike(i.status)) hit.closed += 1;
    else hit.open += 1;
  }

  return {
    summary: riadSummaryOf(items),
    byType,
    bySeverity,
    byStatus,
    byOwner,
    byCategory,
    byMonth: months,
  };
}
