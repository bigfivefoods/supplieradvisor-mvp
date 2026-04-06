// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

function requiredEnvVar(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    console.warn(`⚠️ Missing environment variable: ${name}. Some features may not work.`);
    return '';
  }
  return value;
}

const SUPABASE_URL = requiredEnvVar('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_ANON_KEY = requiredEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

// Public client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { headers: { 'x-client-info': 'supplieradvisor-mvp/1.0' } }
});

// Admin client (service_role)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { headers: { 'x-client-info': 'supplieradvisor-mvp/1.0' } }
});