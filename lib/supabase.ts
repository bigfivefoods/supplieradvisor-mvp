// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// ────────────────────────────────────────────────
// Helper
// ────────────────────────────────────────────────
function requiredEnvVar(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    console.warn(`⚠️ Missing env var: ${name}. Some features disabled during build.`);
    return '';
  }
  return value;
}

const SUPABASE_URL = requiredEnvVar('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_ANON_KEY = requiredEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Public client (always safe)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { headers: { 'x-client-info': 'supplieradvisor-mvp/1.0' } }
});

// Lazy admin client (only created at runtime – fixes Vercel prerender crash)
export function getSupabaseAdmin() {
  const SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
  if (!SERVICE_ROLE_KEY) {
    console.warn('⚠️ Service role key missing – falling back to anon client for build');
    return supabase;
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { 'x-client-info': 'supplieradvisor-mvp/1.0' } }
  });
}