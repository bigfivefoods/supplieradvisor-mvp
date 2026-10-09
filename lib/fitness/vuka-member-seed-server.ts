/**
 * Server-only loader for gym member seeds.
 * Import this from API routes, never from client components.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  emptyVukaMemberSeed,
  parseVukaMemberSeed,
  type VukaMemberSeed,
} from '@/lib/fitness/vuka-member-seed';

export async function loadVukaMemberSeed(
  companyId: number
): Promise<VukaMemberSeed> {
  if (!Number.isFinite(companyId)) return emptyVukaMemberSeed();
  if (typeof window !== 'undefined') {
    throw new Error('Gym member seeds are loaded on the server only');
  }
  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('gym_member_seeds')
      .select('import_version, submissions, roster, name_folds, coaches')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error || !data) {
      if (error) {
        console.warn(
          '[vuka-member-seed] load skipped',
          error.code || 'error'
        );
      }
      return emptyVukaMemberSeed();
    }
    return parseVukaMemberSeed({
      import_version: data.import_version,
      submissions: data.submissions,
      roster: data.roster,
      name_folds: data.name_folds,
      coaches: data.coaches,
    });
  } catch {
    console.warn('[vuka-member-seed] load skipped');
    return emptyVukaMemberSeed();
  }
}
