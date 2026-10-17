/**
 * Inert load-test identity. 404 unless LOADTEST_ENDPOINTS=1.
 * The body is the public project ref and the word staging. No keys.
 */

export function projectRefFromSupabaseUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    const ref = host.split('.')[0] || '';
    if (!ref || ref === 'localhost') return '';
    return ref;
  } catch {
    return '';
  }
}

export function loadtestWhoami(env: {
  LOADTEST_ENDPOINTS?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
}): { status: number; body: { error: string } | { projectRef: string; stage: 'staging' } } {
  if (env.LOADTEST_ENDPOINTS !== '1') {
    return { status: 404, body: { error: 'Not found' } };
  }
  return {
    status: 200,
    body: {
      projectRef: projectRefFromSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL || ''),
      stage: 'staging',
    },
  };
}
