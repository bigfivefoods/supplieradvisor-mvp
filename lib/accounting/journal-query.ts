/**
 * Paginated posted-journal fetches so trial balance / reports are not silently truncated.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

const PAGE = 1000;
const HARD_CAP = 50_000;

export type PostedJournalRow = {
  id: number;
  entry_date: string;
  source?: string | null;
};

export async function fetchPostedJournals(opts: {
  profileId: number;
  from?: string | null;
  to?: string | null;
}): Promise<{ rows: PostedJournalRow[]; warning?: string }> {
  const supabase = getSupabaseServer();
  const rows: PostedJournalRow[] = [];
  let offset = 0;

  while (offset < HARD_CAP) {
    let q = supabase
      .from('journal_entries')
      .select('id, entry_date, source')
      .eq('profile_id', opts.profileId)
      .eq('status', 'posted')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (opts.from) q = q.gte('entry_date', opts.from);
    if (opts.to) q = q.lte('entry_date', opts.to);

    const { data, error } = await q;
    if (error) {
      if (/column|42703/i.test(error.message)) {
        let retry = supabase
          .from('journal_entries')
          .select('id, entry_date')
          .eq('profile_id', opts.profileId)
          .eq('status', 'posted')
          .order('id', { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (opts.from) retry = retry.gte('entry_date', opts.from);
        if (opts.to) retry = retry.lte('entry_date', opts.to);
        const r2 = await retry;
        if (r2.error) return { rows, warning: r2.error.message };
        const page = r2.data || [];
        for (const r of page) {
          const n = Number(r.id);
          if (Number.isFinite(n)) {
            rows.push({
              id: n,
              entry_date: String(r.entry_date || '').slice(0, 10),
              source: null,
            });
          }
        }
        if (page.length < PAGE) break;
        offset += PAGE;
        continue;
      }
      return { rows, warning: error.message };
    }
    const page = data || [];
    for (const r of page) {
      const n = Number(r.id);
      if (Number.isFinite(n)) {
        rows.push({
          id: n,
          entry_date: String(r.entry_date || '').slice(0, 10),
          source: r.source != null ? String(r.source) : null,
        });
      }
    }
    if (page.length < PAGE) break;
    offset += PAGE;
  }

  if (offset >= HARD_CAP) {
    return {
      rows,
      warning: `Journal fetch truncated at ${HARD_CAP} posted journals.`,
    };
  }
  return { rows };
}

export async function fetchPostedJournalIds(opts: {
  profileId: number;
  from?: string | null;
  to?: string | null;
}): Promise<{ ids: number[]; warning?: string }> {
  const supabase = getSupabaseServer();
  const ids: number[] = [];
  let offset = 0;

  while (offset < HARD_CAP) {
    let q = supabase
      .from('journal_entries')
      .select('id')
      .eq('profile_id', opts.profileId)
      .eq('status', 'posted')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (opts.from) q = q.gte('entry_date', opts.from);
    if (opts.to) q = q.lte('entry_date', opts.to);

    const { data, error } = await q;
    if (error) {
      return { ids, warning: error.message };
    }
    const rows = data || [];
    for (const r of rows) {
      const n = Number(r.id);
      if (Number.isFinite(n)) ids.push(n);
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  if (offset >= HARD_CAP) {
    return {
      ids,
      warning: `Trial balance truncated at ${HARD_CAP} posted journals — contact support to archive or split the entity.`,
    };
  }
  return { ids };
}

export async function fetchJournalLinesByEntryIds(
  entryIds: number[],
  select = 'account_id, debit, credit'
): Promise<{
  lines: Array<Record<string, unknown>>;
  warning?: string;
}> {
  const supabase = getSupabaseServer();
  const lines: Array<Record<string, unknown>> = [];
  const chunkSize = 150;
  const chunks: number[][] = [];
  for (let i = 0; i < entryIds.length; i += chunkSize) {
    chunks.push(entryIds.slice(i, i + chunkSize));
  }
  for (let i = 0; i < chunks.length; i += 4) {
    const batch = chunks.slice(i, i + 4);
    const pages = await Promise.all(
      batch.map((chunk) =>
        supabase
          .from('journal_lines')
          .select(select)
          .in('journal_entry_id', chunk)
      )
    );
    for (const page of pages) {
      if (page.error) {
        return { lines, warning: page.error.message };
      }
      const rows = (page.data || []) as unknown as Array<Record<string, unknown>>;
      for (const row of rows) {
        if (row && typeof row === 'object') lines.push(row);
      }
    }
  }
  return { lines };
}
