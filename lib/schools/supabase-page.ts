/**
 * PostgREST / Supabase often caps responses at 1000 rows even when
 * .limit(N) is higher. Always page with .range() for large tables.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

const PAGE = 1000;
const ID_CHUNK = 200;
const PARALLEL = 6;
/** Hard cap so agency/SP register paths never walk tens of thousands of rows. */
export const FETCH_ALL_HARD_CAP = 5000;

/** Offsets after the first page. Exported for tests. */
export function pagedOffsets(
  total: number,
  size: number,
  maxRows: number
): number[] {
  const cap = Math.min(total, Math.max(size, maxRows));
  const starts: number[] = [];
  for (let from = size; from < cap; from += size) starts.push(from);
  return starts;
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const part = await Promise.all(slice.map(fn));
    out.push(...part);
  }
  return out;
}

function asRows(data: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(data)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const row of data) {
    if (row && typeof row === 'object') {
      out.push({ ...(row as object) } as Record<string, unknown>);
    }
  }
  return out;
}

export async function fetchAllPaged(
  supabase: SupabaseClient,
  table: string,
  select: string,
  apply?: (q: AnyQuery) => AnyQuery,
  pageSize = PAGE,
  maxRows = FETCH_ALL_HARD_CAP
): Promise<Array<Record<string, unknown>>> {
  const size = Math.min(1000, Math.max(50, pageSize));
  const hardCap = Math.min(200000, Math.max(size, maxRows));
  const firstQ = () => {
    let q = supabase
      .from(table)
      .select(select, { count: 'exact' })
      .range(0, size - 1);
    if (apply) q = apply(q);
    return q;
  };
  const { data, error, count } = await firstQ();
  if (error) throw new Error(`${table}: ${error.message}`);
  const all = asRows(data);
  const total = typeof count === 'number' ? count : all.length;
  if (all.length < size || total <= size) return all;

  const pages = await mapInBatches(
    pagedOffsets(total, size, hardCap),
    PARALLEL,
    async (from) => {
      let q = supabase.from(table).select(select).range(from, from + size - 1);
      if (apply) q = apply(q);
      const res = await q;
      if (res.error) throw new Error(`${table}: ${res.error.message}`);
      return asRows(res.data);
    }
  );
  for (const page of pages) {
    for (const row of page) {
      all.push({ ...(row as object) } as Record<string, unknown>);
    }
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
  chunkSize = ID_CHUNK
): Promise<Array<Record<string, unknown>>> {
  const unique = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
  if (!unique.length) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    chunks.push(unique.slice(i, i + chunkSize));
  }
  const pages = await mapInBatches(chunks, PARALLEL, async (chunk) => {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .in(idColumn, chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
    return asRows(data);
  });
  const all: Array<Record<string, unknown>> = [];
  for (const page of pages) {
    for (const row of page) all.push({ ...(row as object) } as Record<string, unknown>);
  }
  return all;
}

const LINK_COLS =
  'id, school_profile_id, school_company_id, agency_profile_id, status, accepted_at, notes, created_at, updated_at';

/** Active (+ optional other) school links for an agency company id. */
export async function fetchAgencySchoolLinks(
  supabase: SupabaseClient,
  agencyCompanyId: number,
  statuses: string[] = ['active']
): Promise<Array<Record<string, unknown>>> {
  return fetchAllPaged(
    supabase,
    'school_agency_links',
    LINK_COLS,
    (q) =>
      q
        .eq('agency_profile_id', agencyCompanyId)
        .in('status', statuses)
        .order('id', { ascending: true }),
    PAGE,
    4000
  );
}

export type AgencyLinkSummary = {
  schoolCount: number;
  activeLinks: number;
  pendingLinks: number;
  suspendedLinks: number;
  totalLearners: number;
  totalVerified: number;
  totalNsnpApproved: number;
};

function emptySummary(): AgencyLinkSummary {
  return {
    schoolCount: 0,
    activeLinks: 0,
    pendingLinks: 0,
    suspendedLinks: 0,
    totalLearners: 0,
    totalVerified: 0,
    totalNsnpApproved: 0,
  };
}

/** One SQL round-trip. Falls back to three head-count queries if RPC missing. */
export async function loadAgencyLinkSummary(
  supabase: SupabaseClient,
  agencyCompanyId: number
): Promise<AgencyLinkSummary> {
  try {
    const { nsnpCacheGet, nsnpCacheSet, NSNP_TTL } = await import(
      '@/lib/schools/nsnp-cache'
    );
    const ck = `nsnp:summary:${agencyCompanyId}`;
    const hit = nsnpCacheGet<AgencyLinkSummary>(ck);
    if (hit) return hit;
    const loaded = await loadAgencyLinkSummaryUncached(supabase, agencyCompanyId);
    return nsnpCacheSet(ck, loaded, NSNP_TTL.hub);
  } catch {
    return loadAgencyLinkSummaryUncached(supabase, agencyCompanyId);
  }
}

async function loadAgencyLinkSummaryUncached(
  supabase: SupabaseClient,
  agencyCompanyId: number
): Promise<AgencyLinkSummary> {
  const { data, error } = await supabase.rpc('sa_nsnp_agency_summary', {
    p_agency_profile_id: agencyCompanyId,
  });
  if (!error && data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    return {
      schoolCount: Number(o.schoolCount || 0),
      activeLinks: Number(o.activeLinks || 0),
      pendingLinks: Number(o.pendingLinks || 0),
      suspendedLinks: Number(o.suspendedLinks || 0),
      totalLearners: Number(o.totalLearners || 0),
      totalVerified: Number(o.totalVerified || 0),
      totalNsnpApproved: Number(o.totalNsnpApproved || 0),
    };
  }

  const statuses = ['active', 'pending', 'suspended'] as const;
  const counts = await Promise.all(
    statuses.map(async (status) => {
      const { count } = await supabase
        .from('school_agency_links')
        .select('id', { count: 'exact', head: true })
        .eq('agency_profile_id', agencyCompanyId)
        .eq('status', status);
      return [status, Number(count || 0)] as const;
    })
  );
  const by = Object.fromEntries(counts) as Record<string, number>;
  const summary = emptySummary();
  summary.activeLinks = by.active || 0;
  summary.pendingLinks = by.pending || 0;
  summary.suspendedLinks = by.suspended || 0;
  summary.schoolCount =
    summary.activeLinks + summary.pendingLinks + summary.suspendedLinks;
  return summary;
}

/** Pending joins only — desk / Onboard, never the full 5k register. */
export async function fetchPendingAgencyLinks(
  supabase: SupabaseClient,
  agencyCompanyId: number,
  limit = 200
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('school_agency_links')
    .select(LINK_COLS)
    .eq('agency_profile_id', agencyCompanyId)
    .eq('status', 'pending')
    .order('id', { ascending: false })
    .limit(Math.min(500, Math.max(20, limit)));
  if (error) throw new Error(`school_agency_links: ${error.message}`);
  return asRows(data);
}

/** Newest / pending-first slice for the department desk (not the full register). */
export async function fetchAgencySchoolLinksSlice(
  supabase: SupabaseClient,
  agencyCompanyId: number,
  opts?: { statuses?: string[]; limit?: number }
): Promise<Array<Record<string, unknown>>> {
  const statuses = opts?.statuses || ['active', 'pending', 'suspended'];
  const limit = Math.min(500, Math.max(50, opts?.limit ?? 250));
  const { data, error } = await supabase
    .from('school_agency_links')
    .select(LINK_COLS)
    .eq('agency_profile_id', agencyCompanyId)
    .in('status', statuses)
    .order('status', { ascending: true })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`school_agency_links: ${error.message}`);
  return asRows(data);
}

export type GeoRollupRow = {
  key: string;
  schools: number;
  learners: number;
  verified: number;
};

export type AgencyGeoRollup = {
  byDistrict: GeoRollupRow[];
  byProvince: GeoRollupRow[];
  byQuintile: GeoRollupRow[];
};

function parseGeoRows(raw: unknown, keyField: string): GeoRollupRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const o = (row || {}) as Record<string, unknown>;
    return {
      key: String(o[keyField] || o.key || 'Unknown'),
      schools: Number(o.schools || 0),
      learners: Number(o.learners || 0),
      verified: Number(o.verified || 0),
    };
  });
}

export async function loadAgencyGeoRollup(
  supabase: SupabaseClient,
  agencyCompanyId: number
): Promise<AgencyGeoRollup> {
  const empty: AgencyGeoRollup = {
    byDistrict: [],
    byProvince: [],
    byQuintile: [],
  };
  try {
    const { nsnpCacheGet, nsnpCacheSet, NSNP_TTL } = await import(
      '@/lib/schools/nsnp-cache'
    );
    const ck = `nsnp:geo:${agencyCompanyId}`;
    const hit = nsnpCacheGet<AgencyGeoRollup>(ck);
    if (hit) return hit;
    const { data, error } = await supabase.rpc('sa_nsnp_geo_rollup', {
      p_agency_profile_id: agencyCompanyId,
    });
    if (error || !data || typeof data !== 'object') return empty;
    const o = data as Record<string, unknown>;
    const loaded: AgencyGeoRollup = {
      byDistrict: parseGeoRows(o.byDistrict, 'district'),
      byProvince: parseGeoRows(o.byProvince, 'province'),
      byQuintile: parseGeoRows(o.byQuintile, 'quintile'),
    };
    return nsnpCacheSet(ck, loaded, NSNP_TTL.hub);
  } catch {
    return empty;
  }
}

export type AgencyNetworkOps = {
  lateDeliveries: number;
  offCatalogueReceipts14d: number;
  submittedClaims: number;
  pendingIspLinks: number;
  activeIspLinks: number;
  catalogueProducts: number;
  menus: number;
  recipes: number;
  calendars: number;
};

function emptyNetworkOps(): AgencyNetworkOps {
  return {
    lateDeliveries: 0,
    offCatalogueReceipts14d: 0,
    submittedClaims: 0,
    pendingIspLinks: 0,
    activeIspLinks: 0,
    catalogueProducts: 0,
    menus: 0,
    recipes: 0,
    calendars: 0,
  };
}

export async function loadAgencyNetworkOps(
  supabase: SupabaseClient,
  agencyCompanyId: number,
  asOf = new Date().toISOString().slice(0, 10)
): Promise<AgencyNetworkOps> {
  const empty = emptyNetworkOps();
  try {
    const { nsnpCacheGet, nsnpCacheSet, NSNP_TTL } = await import(
      '@/lib/schools/nsnp-cache'
    );
    const ck = `nsnp:ops:${agencyCompanyId}:${asOf}`;
    const hit = nsnpCacheGet<AgencyNetworkOps>(ck);
    if (hit) return hit;
    const { data, error } = await supabase.rpc('sa_nsnp_network_ops', {
      p_agency_profile_id: agencyCompanyId,
      p_as_of: asOf,
    });
    if (!error && data && typeof data === 'object') {
      const o = data as Record<string, unknown>;
      const loaded: AgencyNetworkOps = {
        lateDeliveries: Number(o.lateDeliveries || 0),
        offCatalogueReceipts14d: Number(o.offCatalogueReceipts14d || 0),
        submittedClaims: Number(o.submittedClaims || 0),
        pendingIspLinks: Number(o.pendingIspLinks || 0),
        activeIspLinks: Number(o.activeIspLinks || 0),
        catalogueProducts: Number(o.catalogueProducts || 0),
        menus: Number(o.menus || 0),
        recipes: Number(o.recipes || 0),
        calendars: Number(o.calendars || 0),
      };
      return nsnpCacheSet(ck, loaded, NSNP_TTL.hub);
    }
    const fallback = await loadAgencyNetworkOpsFallback(
      supabase,
      agencyCompanyId
    );
    return nsnpCacheSet(ck, fallback, NSNP_TTL.hub);
  } catch {
    return empty;
  }
}

/** Cheap counts that do not require joining 5k school ids. */
async function loadAgencyNetworkOpsFallback(
  supabase: SupabaseClient,
  agencyCompanyId: number
): Promise<AgencyNetworkOps> {
  const out = emptyNetworkOps();
  const [
    claims,
    ispPending,
    ispActive,
    cat,
    menus,
    recipes,
    cals,
  ] = await Promise.all([
    supabase
      .from('nsnp_claim_packs')
      .select('id', { count: 'exact', head: true })
      .eq('agency_profile_id', agencyCompanyId)
      .eq('status', 'submitted'),
    supabase
      .from('nsnp_isp_agency_links')
      .select('id', { count: 'exact', head: true })
      .eq('agency_profile_id', agencyCompanyId)
      .eq('status', 'pending'),
    supabase
      .from('nsnp_isp_agency_links')
      .select('id', { count: 'exact', head: true })
      .eq('agency_profile_id', agencyCompanyId)
      .eq('status', 'active'),
    supabase
      .from('nsnp_approved_products')
      .select('id', { count: 'exact', head: true })
      .eq('agency_profile_id', agencyCompanyId),
    supabase
      .from('school_menu_cycles')
      .select('id')
      .eq('agency_profile_id', agencyCompanyId)
      .limit(1),
    supabase
      .from('nsnp_recipes')
      .select('id')
      .eq('agency_profile_id', agencyCompanyId)
      .limit(1),
    supabase
      .from('nsnp_feeding_calendars')
      .select('id')
      .eq('agency_profile_id', agencyCompanyId)
      .limit(1),
  ]);
  out.submittedClaims = Number(claims.count || 0);
  out.pendingIspLinks = Number(ispPending.count || 0);
  out.activeIspLinks = Number(ispActive.count || 0);
  out.catalogueProducts = Number(cat.count || 0);
  out.menus = (menus.data || []).length;
  out.recipes = (recipes.data || []).length;
  out.calendars = (cals.data || []).length;
  return out;
}
