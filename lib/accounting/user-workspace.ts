/**
 * Per-login Finance working copy. Company books (posted journals, published
 * budget, invoices, bank allocations) stay one ledger. View state and unpublished
 * work stay on this user + company so two people can review without clobbering.
 */
import type { PeriodSlicerValue } from '@/components/accounting/PeriodSlicer';
import { userIdMatchVariants } from '@/lib/auth/identity';

export type JournalScope = 'posted_and_mine' | 'all';

export type FinanceWorkspace = {
  v: 1;
  period?: PeriodSlicerValue;
  report?: string;
  journalScope?: JournalScope;
  budgetYear?: number;
};

function wsKey(userId: string, companyId: number) {
  return `sa.finance.workspace.v1:${userId}:${companyId}`;
}

function draftKey(userId: string, companyId: number, year: number) {
  return `sa.finance.budgetDraft.v1:${userId}:${companyId}:${year}`;
}

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function loadFinanceWorkspace(
  userId: string | null | undefined,
  companyId: number
): FinanceWorkspace {
  if (!userId || !Number.isFinite(companyId)) return { v: 1 };
  return readJson<FinanceWorkspace>(wsKey(userId, companyId)) || { v: 1 };
}

export function saveFinanceWorkspace(
  userId: string | null | undefined,
  companyId: number,
  patch: Partial<FinanceWorkspace>
) {
  if (!userId || !Number.isFinite(companyId)) return;
  const prev = loadFinanceWorkspace(userId, companyId);
  writeJson(wsKey(userId, companyId), { ...prev, ...patch, v: 1 });
}

export function loadBudgetDraft(
  userId: string | null | undefined,
  companyId: number,
  year: number
): Record<number, Record<string, number>> {
  if (!userId || !Number.isFinite(companyId) || !Number.isFinite(year)) return {};
  return readJson<Record<number, Record<string, number>>>(
    draftKey(userId, companyId, year)
  ) || {};
}

export function saveBudgetDraft(
  userId: string | null | undefined,
  companyId: number,
  year: number,
  draft: Record<number, unknown>
) {
  if (!userId || !Number.isFinite(companyId)) return;
  const key = draftKey(userId, companyId, year);
  if (!draft || Object.keys(draft).length === 0) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return;
  }
  writeJson(key, draft);
}

export function clearBudgetDraft(
  userId: string | null | undefined,
  companyId: number,
  year: number
) {
  saveBudgetDraft(userId, companyId, year, {});
}

export function isOwnJournal(
  createdBy: string | null | undefined,
  userId: string | null | undefined
): boolean {
  if (!createdBy || !userId) return false;
  const mine = new Set(userIdMatchVariants(userId));
  return mine.has(String(createdBy));
}

export function isPeriodValue(raw: unknown): raw is PeriodSlicerValue {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as PeriodSlicerValue;
  return (
    typeof p.from === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(p.from) &&
    typeof p.to === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(p.to)
  );
}
