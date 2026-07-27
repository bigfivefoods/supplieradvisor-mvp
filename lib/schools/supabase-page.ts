/**
 * PostgREST / Supabase often caps responses at 1000 rows even when
 * .limit(N) is higher. Always page with .range() for large tables.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

export async function fetchAllPaged(
  supabase: SupabaseClient,
  table: string,
  select: string,
  apply?: (q: AnyQuery) => AnyQuery,
  pageSize = 1000
): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = [];
  let from = 0;
  for (;;) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      all.push({ ...(row as object) } as Record<string, unknown>);
    }
    if (data.length < pageSize) break;
    from += pageSize;
    if (from > 200000) break;
  }
  return all;
}

/** Fetch rows by primary ids in chunks (avoids .in() size / 1000 caps). */
export async function fetchByIds(
  supabase: SupabaseClient,
  table: string,
  select: string,
  ids: number[],
  idColumn = 'id',
  chunkSize = 200
): Promise<Array<Record<string, unknown>>> {
  const unique = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
  const all: Array<Record<string, unknown>> = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .in(idColumn, chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const row of data || []) {
      all.push({ ...(row as object) } as Record<string, unknown>);
    }
  }
  return all;
}

/** Active (+ optional other) school links for an agency company id. */
export async function fetchAgencySchoolLinks(
  supabase: SupabaseClient,
  agencyCompanyId: number,
  statuses: string[] = ['active']
): Promise<Array<Record<string, unknown>>> {
  return fetchAllPaged(
    supabase,
    'school_agency_links',
    'id, school_profile_id, school_company_id, agency_profile_id, status, accepted_at, notes, created_at, updated_at',
    (q) =>
      q
        .eq('agency_profile_id', agencyCompanyId)
        .in('status', statuses)
        .order('id', { ascending: true })
  );
}
