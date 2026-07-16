/**
 * Smoke-check expected tables/columns for platform improvements.
 * Usage: node scripts/verify-platform.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const checks = [
  { table: 'profiles', col: 'referred_by_profile_id' },
  { table: 'profiles', col: 'referral_code' },
  { table: 'profiles', col: 'trust_score' },
  { table: 'supply_chain_referral_earnings', col: 'hold_until' },
  { table: 'referral_attributions', col: 'child_profile_id' },
  { table: 'supply_chain_referral_clawbacks', col: 'source_ref' },
  { table: 'sam_conversations', col: 'user_message' },
  { table: 'rating_prompts', col: 'status' },
  { table: 'company_onboarding_progress', col: 'steps' },
  { table: 'founding_waitlist', col: 'email' },
];

let failed = 0;
for (const c of checks) {
  const { error } = await supabase.from(c.table).select(c.col).limit(1);
  if (error) {
    console.log(`FAIL  ${c.table}.${c.col} — ${error.message}`);
    failed += 1;
  } else {
    console.log(`OK    ${c.table}.${c.col}`);
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed. Apply pending SQL migrations.`);
  process.exit(1);
}
console.log('\nAll platform checks passed.');
