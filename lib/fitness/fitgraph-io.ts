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
  writeFitgraphPatchToMetadata,
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
    let latestMovements: unknown[] | undefined;
    try {
      const latest = await loadFitgraphMerged(companyId, { fresh: true });
      latestMovements = latest.store?.movements;
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
    // Skip the lib write when movements are unchanged to avoid rewriting the
    // fitgraph_lib row on every calendar action.
    const movementsChanged =
      JSON.stringify(lib.movements ?? []) !==
      JSON.stringify(latestMovements ?? []);
    try {
      if (opts?.ifUpdatedAt) {
        await saveAdvisorModuleStore(
          companyId,
          FITGRAPH_META_KEY,
          core,
          writeFitgraphToMetadata,
          opts
        );
        if (movementsChanged) {
          await saveAdvisorModuleStore(
            companyId,
            FITGRAPH_LIB_KEY,
            lib,
            writeFitgraphLibToMetadata
          );
        }
      } else {
        const writes: Promise<void>[] = [
          saveAdvisorModuleStore(
            companyId,
            FITGRAPH_META_KEY,
            core,
            writeFitgraphToMetadata,
            opts
          ),
        ];
        if (movementsChanged) {
          writes.push(
            saveAdvisorModuleStore(
              companyId,
              FITGRAPH_LIB_KEY,
              lib,
              writeFitgraphLibToMetadata,
              opts
            )
          );
        }
        await Promise.all(writes);
      }
    } catch (error) {
      if (isStaleModuleStoreError(error)) throw error;
      await saveAdvisorModuleStore(
        companyId,
        FITGRAPH_META_KEY,
        next,
        writeFitgraphToMetadata
      );
    }
    saved = next;
    Object.assign(store, next);
  });
  return saved;
}

/**
 * Brief 52 — fast calendar patch save.
 *
 * Writes ONLY the keys in `patch` (e.g. sessions + bookings) via the existing
 * sa_put_module_store merge path.  Omitted id-arrays (clients, coaches, goals,
 * …) are not sent, so the SQL merge leaves them untouched on the server row.
 *
 * Does NOT: loadFitgraphMerged, mergeFitgraphStores, retainMemberProgress,
 * splitFitgraphLibrary for the full store, or write the lib row.
 * Still: uses withFitgraphWriteLock; honours p_if_updated_at (409 stale).
 */
export async function saveFitgraphPatch(
  companyId: number,
  patch: Partial<FitgraphStore>,
  opts?: { ifUpdatedAt?: string | null }
): Promise<string> {
  const updatedAt = new Date().toISOString();
  await withFitgraphWriteLock(companyId, async () => {
    await saveAdvisorModuleStore(
      companyId,
      FITGRAPH_META_KEY,
      patch,
      (meta, p) => writeFitgraphPatchToMetadata(meta, p, updatedAt),
      opts
    );
  });
  return updatedAt;
}
