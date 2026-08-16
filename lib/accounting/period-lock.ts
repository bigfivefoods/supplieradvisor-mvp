/**
 * Accounting period locks — block posting journals into closed months.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export type PeriodLock = {
  id?: number;
  profile_id: number;
  period_key: string; // YYYY-MM
  locked: boolean;
  locked_at?: string | null;
  locked_by?: string | null;
  note?: string | null;
};

/**
 * Parse YYYY-MM-DD as a calendar date (not UTC midnight).
 * `new Date('2026-03-01')` is UTC and can land in the prior month in ZA/US.
 */
export function calendarYmd(
  dateStr: string | Date
): { y: number; m: number; d: number } | null {
  if (dateStr instanceof Date) {
    if (Number.isNaN(dateStr.getTime())) return null;
    return {
      y: dateStr.getFullYear(),
      m: dateStr.getMonth() + 1,
      d: dateStr.getDate(),
    };
  }
  const s = String(dateStr || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  }
  const d = new Date(String(dateStr));
  if (Number.isNaN(d.getTime())) return null;
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

export function periodKeyFromDate(dateStr: string | Date): string {
  const c = calendarYmd(dateStr);
  if (!c) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${c.y}-${String(c.m).padStart(2, '0')}`;
}

function ymdNum(c: { y: number; m: number; d: number }): number {
  return c.y * 10000 + c.m * 100 + c.d;
}

export async function isPeriodLocked(
  profileId: number,
  entryDate: string
): Promise<{ locked: boolean; period_key: string }> {
  const period_key = periodKeyFromDate(entryDate);
  const supabase = getSupabaseServer();

  const entry = calendarYmd(entryDate);
  if (entry) {
    const { data: settings, error: sErr } = await supabase
      .from('accounting_settings')
      .select('lock_date')
      .eq('profile_id', profileId)
      .maybeSingle();
    if (!sErr && settings?.lock_date) {
      const lock = calendarYmd(String(settings.lock_date));
      if (lock && ymdNum(entry) <= ymdNum(lock)) {
        return { locked: true, period_key };
      }
    }
  }

  const { data, error } = await supabase
    .from('accounting_period_locks')
    .select('period_key, locked')
    .eq('profile_id', profileId)
    .eq('period_key', period_key)
    .maybeSingle();

  if (error) {
    // table missing — treat as unlocked (unless lock_date already matched)
    if (/does not exist|schema cache/i.test(error.message)) {
      return { locked: false, period_key };
    }
    console.warn('isPeriodLocked', error.message);
    return { locked: false, period_key };
  }
  return { locked: data?.locked === true, period_key };
}

export async function listPeriodLocks(profileId: number): Promise<PeriodLock[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('accounting_period_locks')
    .select('*')
    .eq('profile_id', profileId)
    .order('period_key', { ascending: false })
    .limit(36);
  if (error) return [];
  return (data || []) as PeriodLock[];
}

export async function setPeriodLock(params: {
  profileId: number;
  period_key: string;
  locked: boolean;
  userId?: string | null;
  note?: string | null;
}): Promise<{ ok: true; row: PeriodLock } | { ok: false; error: string }> {
  const key = params.period_key;
  if (!/^\d{4}-\d{2}$/.test(key)) {
    return { ok: false, error: 'period_key must be YYYY-MM' };
  }
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const row = {
    profile_id: params.profileId,
    period_key: key,
    locked: params.locked,
    locked_at: params.locked ? now : null,
    locked_by: params.locked ? params.userId || null : null,
    note: params.note || null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('accounting_period_locks')
    .upsert(row, { onConflict: 'profile_id,period_key' })
    .select('*')
    .single();

  if (error) {
    return {
      ok: false,
      error:
        error.message +
        (error.message.includes('does not exist')
          ? ' — run migration 20260711_accounting_period_locks.sql'
          : ''),
    };
  }
  return { ok: true, row: data as PeriodLock };
}
