/**
 * Fitgraph load/save with optional movement library row.
 * Falls back to a single blob if fitgraph_lib is not in the database yet.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  isStaleModuleStoreError,
  loadAdvisorModuleStore,
  saveAdvisorModuleStore,
} from '@/lib/business/company-data';
import {
  FITGRAPH_LIB_KEY,
  FITGRAPH_META_KEY,
  mergeFitgraphLibrary,
  readFitgraphFromMetadata,
  readFitgraphLibFromMetadata,
  splitFitgraphLibrary,
  writeFitgraphLibToMetadata,
  writeFitgraphToMetadata,
  type FitgraphLibrary,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';
import { mergeFitgraphStores } from '@/lib/fitness/fitgraph-merge';

const writeLocks = new Map<number, Promise<unknown>>();

async function withFitgraphWriteLock<T>(
  companyId: number,
  fn: () => Promise<T>
): Promise<T> {
  const prev = writeLocks.get(companyId) || Promise.resolve();
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = prev.then(() => held).catch(() => undefined);
  writeLocks.set(companyId, chain);
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (writeLocks.get(companyId) === chain) writeLocks.delete(companyId);
  }
}

export async function loadFitgraphLibraryRow(
  companyId: number
): Promise<FitgraphLibrary | null> {
  try {
    const supabase = getSupabaseServer();
    const row = await supabase
      .from('company_module_stores')
      .select('data')
      .eq('company_id', companyId)
      .eq('module', FITGRAPH_LIB_KEY)
      .maybeSingle();
    if (row.error || !row.data?.data) return null;
    return readFitgraphLibFromMetadata({
      [FITGRAPH_LIB_KEY]: row.data.data,
    });
  } catch {
    return null;
  }
}

export async function loadFitgraphMerged(
  companyId: number,
  opts?: { fresh?: boolean }
): Promise<{ meta: Record<string, unknown>; store: FitgraphStore }> {
  const [core, lib] = await Promise.all([
    loadAdvisorModuleStore(
      companyId,
      FITGRAPH_META_KEY,
      readFitgraphFromMetadata,
      [],
      opts
    ),
    loadFitgraphLibraryRow(companyId),
  ]);
  const store = mergeFitgraphLibrary(core.store, lib);
  const { hydrateGoalsFromPeople } = await import('@/lib/fitness/member-goals');
  hydrateGoalsFromPeople(store);
  return {
    meta: core.meta,
    store,
  };
}

export async function saveFitgraphMerged(
  companyId: number,
  store: FitgraphStore,
  opts?: { ifUpdatedAt?: string | null }
): Promise<FitgraphStore> {
  let saved = store;
  await withFitgraphWriteLock(companyId, async () => {
    let next = store;
    try {
      const latest = await loadFitgraphMerged(companyId, { fresh: true });
      try {
        next = mergeFitgraphStores(latest.store, store);
      } catch (err) {
        console.warn('mergeFitgraphStores failed; keeping incoming store', err);
        next = store;
      }
      const { retainMemberProgress } = await import('@/lib/fitness/member-goals');
      next = retainMemberProgress(latest.store, next);
    } catch {
      next = store;
    }
    const { hydrateGoalsFromPeople } = await import('@/lib/fitness/member-goals');
    hydrateGoalsFromPeople(next);
    const { core, lib } = splitFitgraphLibrary(next);
    try {
      await Promise.all([
        saveAdvisorModuleStore(
          companyId,
          FITGRAPH_META_KEY,
          core,
          writeFitgraphToMetadata,
          opts
        ),
        saveAdvisorModuleStore(
          companyId,
          FITGRAPH_LIB_KEY,
          lib,
          writeFitgraphLibToMetadata,
          opts
        ),
      ]);
    } catch (error) {
      if (isStaleModuleStoreError(error)) throw error;
      await saveAdvisorModuleStore(
        companyId,
        FITGRAPH_META_KEY,
        next,
        writeFitgraphToMetadata,
        opts
      );
    }
    saved = next;
    Object.assign(store, next);
  });
  return saved;
}
