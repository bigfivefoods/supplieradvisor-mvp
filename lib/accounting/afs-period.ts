/**
 * AFS period helpers — calendar dates, comparable prior period, FY detection.
 */
import {
  fiscalYearEnd,
  fiscalYearLabel,
  fiscalYearStart,
  normalizeFyStartMonth,
  toIsoDate,
} from '@/lib/accounting/fiscal';

export function addCalendarDays(iso: string, delta: number): string {
  const s = String(iso || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + delta);
  return toIsoDate(d);
}

export function calendarDayCount(from: string, to: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(from).slice(0, 10));
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(to).slice(0, 10));
  if (!a || !b) return 0;
  const d0 = new Date(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const d1 = new Date(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((d1.getTime() - d0.getTime()) / 86400000) + 1;
}

export function isFullFiscalYear(
  from: string,
  to: string,
  fyStartMonth?: number | null
): boolean {
  const sm = normalizeFyStartMonth(fyStartMonth);
  const ref = parseIso(from) || new Date();
  const start = toIsoDate(fiscalYearStart(ref, sm));
  const end = toIsoDate(fiscalYearEnd(ref, sm));
  return start === String(from).slice(0, 10) && end === String(to).slice(0, 10);
}

function parseIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).slice(0, 10));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function priorComparablePeriod(
  from: string,
  to: string,
  fyStartMonth?: number | null
): { from: string; to: string; label: string } {
  const sm = normalizeFyStartMonth(fyStartMonth);
  const start = parseIso(from);
  if (start && isFullFiscalYear(from, to, sm)) {
    const priorRef = new Date(start.getFullYear() - 1, start.getMonth(), 15);
    const pFrom = toIsoDate(fiscalYearStart(priorRef, sm));
    const pTo = toIsoDate(fiscalYearEnd(priorRef, sm));
    return {
      from: pFrom,
      to: pTo,
      label: `FY ${fiscalYearLabel(priorRef, sm)}`,
    };
  }
  const days = Math.max(1, calendarDayCount(from, to));
  const pTo = addCalendarDays(from, -1);
  const pFrom = addCalendarDays(pTo, -(days - 1));
  return { from: pFrom, to: pTo, label: 'Prior period' };
}
