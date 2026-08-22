/**
 * Server-side Supabase client. Node-only — never import from Edge routes
 * or middleware (undici keepalive uses node:util/types).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let pooledFetch: typeof fetch | null = null;

function restUrl(): string | undefined {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    undefined
  );
}

function isEdgeRuntime(): boolean {
  return (
    process.env.NEXT_RUNTIME === 'edge' ||
    typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime !== 'undefined'
  );
}

/** Reuse TCP connections to PostgREST inside one Node serverless isolate. */
function keepaliveFetch(): typeof fetch {
  if (pooledFetch) return pooledFetch;
  if (isEdgeRuntime()) {
    pooledFetch = fetch;
    return pooledFetch;
  }
  try {
    // Externalised in next.config (serverExternalPackages) so webpack/Edge
    // never inline undici's node:util/types into _middleware.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require('undici') as {
      Agent: new (opts: Record<string, unknown>) => unknown;
      fetch: typeof fetch;
    };
    const agent = new undici.Agent({
      keepAliveTimeout: 30_000,
      connections: 32,
    });
    pooledFetch = ((url, init) =>
      undici.fetch(url as string, {
        ...(init || {}),
        dispatcher: agent,
      } as RequestInit)) as typeof fetch;
  } catch {
    pooledFetch = fetch;
  }
  return pooledFetch;
}

/**
 * Server-side Supabase client.
 * Uses the service role. Anon is never used here — module stores, chrome RPCs,
 * and settle tables deny anon by policy.
 * SUPABASE_URL may point at the pooler REST host; otherwise the public URL.
 */
export function getSupabaseServer(): SupabaseClient {
  if (client) return client;

  const url = restUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  client = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: keepaliveFetch(),
    },
  });

  return client;
}

export function hasServiceRole(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
