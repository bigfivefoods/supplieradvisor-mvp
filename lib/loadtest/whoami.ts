import { supabaseProjectRefFromUrl } from '@/lib/system/env-guard';

/**
 * Inert load-test identity. 404 unless LOADTEST_ENDPOINTS=1.
 * Also 404 when either Supabase URL is the production project, or the two
 * URLs name different projects. The 200 body is only the public refs and
 * the word staging. No keys.
 *
 * server-client uses SUPABASE_URL, then NEXT_PUBLIC_SUPABASE_URL.
 * admin uses NEXT_PUBLIC_SUPABASE_URL only. Both refs are reported.
 */

export const PRODUCTION_PROJECT_REF = 'onkklullmgrdqoertngp';

export function projectRefFromSupabaseUrl(url: string): string {
  return supabaseProjectRefFromUrl(url);
}

export type WhoamiBody =
  | { error: string }
  | {
      projectRef: string;
      serverProjectRef: string;
      publicProjectRef: string;
      stage: 'staging';
    };

export function loadtestWhoami(env: {
  LOADTEST_ENDPOINTS?: string;
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  VERCEL_ENV?: string;
}): { status: number; body: WhoamiBody } {
  const hidden = { status: 404 as const, body: { error: 'Not found' } };
  if (env.LOADTEST_ENDPOINTS !== '1') return hidden;
  if (env.VERCEL_ENV === 'production') return hidden;

  const serverUrl = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const publicUrl = (env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serverProjectRef = projectRefFromSupabaseUrl(serverUrl);
  const publicProjectRef = projectRefFromSupabaseUrl(publicUrl);
  if (!serverProjectRef || !publicProjectRef) return hidden;
  if (serverProjectRef !== publicProjectRef) return hidden;
  if (serverProjectRef === PRODUCTION_PROJECT_REF || publicProjectRef === PRODUCTION_PROJECT_REF) {
    return hidden;
  }
  return {
    status: 200,
    body: {
      projectRef: serverProjectRef,
      serverProjectRef,
      publicProjectRef,
      stage: 'staging',
    },
  };
}
