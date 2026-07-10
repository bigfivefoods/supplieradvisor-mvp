/** Shared manufacturing domain types — BOM / MPS / MRP / production orders */

export type BomStatus = 'draft' | 'active' | 'obsolete';
export type ProductionOrderStatus =
  | 'planned'
  | 'released'
  | 'in_progress'
  | 'hold'
  | 'complete'
  | 'cancelled';
export type MpsPlanStatus = 'draft' | 'active' | 'frozen' | 'closed';
export type WorkCenterStatus = 'active' | 'maintenance' | 'offline';
export type MrpAction = 'none' | 'make' | 'buy' | 'expedite';

export const PO_STATUS_META: Record<
  ProductionOrderStatus,
  { label: string; tone: string; pulse?: boolean }
> = {
  planned: { label: 'PLANNED', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  released: { label: 'RELEASED', tone: 'bg-sky-50 text-sky-800 border-sky-200' },
  in_progress: {
    label: 'IN FLIGHT',
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    pulse: true,
  },
  hold: { label: 'HOLD', tone: 'bg-amber-50 text-amber-900 border-amber-200' },
  complete: { label: 'COMPLETE', tone: 'bg-cyan-50 text-cyan-900 border-cyan-200' },
  cancelled: { label: 'CANCELLED', tone: 'bg-neutral-100 text-neutral-500 border-neutral-200' },
};

export const BOM_STATUS_META: Record<BomStatus, { label: string; tone: string }> = {
  draft: { label: 'DRAFT', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
  active: { label: 'ACTIVE', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  obsolete: { label: 'OBSOLETE', tone: 'bg-neutral-100 text-neutral-500 border-neutral-200' },
};

export function nextOrderNumber(prefix: string, seq: number) {
  const y = new Date().getFullYear().toString().slice(-2);
  return `${prefix}-${y}-${String(seq).padStart(5, '0')}`;
}

export function weekStarts(from: Date, weeks: number): string[] {
  const out: string[] = [];
  const d = new Date(from);
  // Monday of week
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < weeks; i++) {
    const w = new Date(d);
    w.setDate(d.getDate() + i * 7);
    out.push(w.toISOString().slice(0, 10));
  }
  return out;
}

export function completionPct(planned: number, completed: number) {
  if (!planned || planned <= 0) return 0;
  return Math.min(100, Math.round((completed / planned) * 1000) / 10);
}
