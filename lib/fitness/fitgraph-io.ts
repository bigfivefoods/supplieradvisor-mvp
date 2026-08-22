/**
 * Fitgraph load/save with optional movement library row.
 * Falls back to a single blob if fitgraph_lib is not in the database yet.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
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
  return {
    meta: core.meta,
    store: mergeFitgraphLibrary(core.store, lib),
  };
}

export async function saveFitgraphMerged(
  companyId: number,
  store: FitgraphStore
): Promise<void> {
  const { core, lib } = splitFitgraphLibrary(store);
  try {
    await Promise.all([
      saveAdvisorModuleStore(
        companyId,
        FITGRAPH_META_KEY,
        core,
        writeFitgraphToMetadata
      ),
      saveAdvisorModuleStore(
        companyId,
        FITGRAPH_LIB_KEY,
        lib,
        writeFitgraphLibToMetadata
      ),
    ]);
  } catch {
    await saveAdvisorModuleStore(
      companyId,
      FITGRAPH_META_KEY,
      store,
      writeFitgraphToMetadata
    );
  }
}
