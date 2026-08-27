import { createBrowserClient, type SupabaseClient } from '@supabase/ssr';

let browserClient: SupabaseClient | null = null;

/** Memoized browser anon client — uploads / leftover client reads. Prefer /api/*. */
export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return browserClient;
}
