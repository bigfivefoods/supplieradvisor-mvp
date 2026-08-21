/**
 * Live vs reversed posted journals (reclassify leaves the original posted
 * and stamps metadata.reversed_by_journal_id).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export function asJournalMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function journalIsReversed(j: {
  metadata?: unknown;
} | null | undefined): boolean {
  const id = Number(asJournalMeta(j?.metadata).reversed_by_journal_id);
  return Number.isFinite(id) && id > 0;
}

export function journalIsLivePosted(j: {
  status?: string | null;
  metadata?: unknown;
} | null | undefined): boolean {
  return String(j?.status || '') === 'posted' && !journalIsReversed(j);
}

export function journalEligibleForReview(j: {
  status?: string | null;
  source?: string | null;
  memo?: string | null;
  metadata?: unknown;
}): boolean {
  if (!journalIsLivePosted(j)) return false;
  const src = String(j.source || '').toLowerCase();
  if (
    [
      'reversal',
      'reverse',
      'year_end',
      'year-end',
      'close',
      'ecl',
      'depreciation',
      'impairment',
    ].includes(src)
  ) {
    return false;
  }
  if (/^revers/i.test(String(j.memo || ''))) return false;
  return true;
}

type JournalRow = Record<string, unknown> & {
  id: number;
  status?: string | null;
  source?: string | null;
  metadata?: unknown;
};

/**
 * Walk reverse → correction until a live posted journal, or signal that the
 * original was reversed with no replacement (post correction only).
 */
export async function resolveLivePostedJournal(
  companyId: number,
  start: JournalRow
): Promise<{ live: JournalRow | null; correctionOnly: boolean }> {
  if (journalIsLivePosted(start)) {
    return { live: start, correctionOnly: false };
  }
  if (String(start.status) !== 'posted') {
    return { live: null, correctionOnly: false };
  }

  const supabase = getSupabaseServer();
  let current: JournalRow = start;
  const seen = new Set<number>();

  while (current && Number.isFinite(Number(current.id))) {
    const cid = Number(current.id);
    if (seen.has(cid)) break;
    seen.add(cid);

    if (journalIsLivePosted(current)) {
      return { live: current, correctionOnly: false };
    }

    const { data: corrs } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('profile_id', companyId)
      .eq('status', 'posted')
      .eq('source', 'correction')
      .eq('source_id', String(cid))
      .order('id', { ascending: false })
      .limit(30);

    const rows = (corrs || []) as JournalRow[];
    const liveCorr = rows.find((j) => journalIsLivePosted(j));
    if (liveCorr) return { live: liveCorr, correctionOnly: false };
    if (rows[0]) {
      current = rows[0];
      continue;
    }
    break;
  }

  return { live: null, correctionOnly: journalIsReversed(start) };
}
