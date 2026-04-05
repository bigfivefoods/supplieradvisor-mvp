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

const SUPABASE_SERVICE_ROLE_KEY = requiredEnvVar(
  'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
)

// ────────────────────────────────────────────────
// Public client – safe for client-side reads
// ────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-client-info': 'supplieradvisor-mvp/1.0',
    },
  },
})

// ────────────────────────────────────────────────
// Admin client (service_role key) – used for all writes
// This bypasses RLS and fixes saving issues in onboarding
// ────────────────────────────────────────────────
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-client-info': 'supplieradvisor-mvp/1.0',
    },
  },
})