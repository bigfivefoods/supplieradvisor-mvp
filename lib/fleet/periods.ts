/**
 * FleetAdvisor® reporting windows. Dates are SAST calendar dates, end exclusive.
 */
import { addDays, type CpkPeriod } from './cpk';

export type PeriodId = 'mtd' | 'last' | 'trail';

export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function nextMonth(day: string): string {
  const [year, month] = day.slice(0, 7).split('-').map(Number);
  if (month === 12) return `${year + 1}-01-01`;
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

export function previousMonth(day: string): string {
  const [year, month] = day.slice(0, 7).split('-').map(Number);
  if (month === 1) return `${year - 1}-12-01`;
  return `${year}-${String(month - 1).padStart(2, '0')}-01`;
}

export function periodFor(id: PeriodId, today: string, windowDays = 90): CpkPeriod {
  const day = today.slice(0, 10);
  if (id === 'last') {
    const start = previousMonth(day);
    return { from: start, to: monthStart(day) };
  }
  if (id === 'trail') {
    const span = Math.max(1, Math.trunc(windowDays));
    return { from: addDays(day, -(span - 1)), to: addDays(day, 1) };
  }
  return { from: monthStart(day), to: addDays(day, 1) };
}
