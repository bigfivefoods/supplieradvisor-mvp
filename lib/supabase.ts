// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// ────────────────────────────────────────────────
// Helper to enforce env vars at runtime (makes TypeScript happy)
// ────────────────────────────────────────────────
function requiredEnvVar(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing or empty environment variable: ${name}\n` +
      `Please add ${name} to .env.local and restart the server.`
    )
  }
  return value
}

// ────────────────────────────────────────────────
// Load and validate env vars
// ────────────────────────────────────────────────
const SUPABASE_URL = requiredEnvVar(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL
)

const SUPABASE_ANON_KEY = requiredEnvVar(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ────────────────────────────────────────────────
// Plain anon client – safe for client-side use
// Used for calling Edge Functions (functions.invoke) and public reads
// ────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-client-info': 'supplieradvisor-mvp/1.0', // optional: helps debugging
    },
  },
})

// ────────────────────────────────────────────────
// Authenticated client factory (use later for user-specific queries)
// Example: const authed = getSupabaseClient(privyAccessToken)
// ────────────────────────────────────────────────
export function getSupabaseClient(accessToken?: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
