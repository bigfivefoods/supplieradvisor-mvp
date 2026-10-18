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

export type WhoamiBody =
  | { error: string }
  | {
      projectRef: string;
      serverProjectRef: string;
      publicProjectRef: string;
      stage: 'staging';
    };

export function projectRefFromSupabaseUrl(url: string): string {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return '';
  }
  const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  let user = '';
  try {
    user = decodeURIComponent(parsed.username || '').trim().toLowerCase();
  } catch {
    user = String(parsed.username || '').trim().toLowerCase();
  }
  const fromUser = user.startsWith('postgres.') ? user.slice('postgres.'.length) : '';
  const labels = host.split('.').filter(Boolean);
  const supabaseHost =
    labels.length >= 3 && labels[labels.length - 2] === 'supabase' && labels[labels.length - 1] === 'co';
  let fromHost = '';
  if (supabaseHost && !host.includes('pooler')) {
    fromHost = labels[0] === 'db' && labels.length >= 4 ? labels[1] : labels[0];
  }
  if (fromUser && fromHost && fromUser !== fromHost) return '';
  return fromUser || fromHost;
}

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
