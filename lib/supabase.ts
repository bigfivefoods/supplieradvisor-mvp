// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

function requiredEnvVar(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    console.warn(`⚠️ Missing env var: ${name} (some features disabled during build)`);
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

// Lazy admin client (only created when used – fixes Vercel + dev crashes)
export function getSupabaseAdmin() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
  if (!SUPABASE_URL || !key) {
    console.error("❌ Missing SUPABASE_URL or service_role key - falling back to public client");
    return supabase;
  }
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { 'x-client-info': 'supplieradvisor-mvp/1.0' } }
  });
}