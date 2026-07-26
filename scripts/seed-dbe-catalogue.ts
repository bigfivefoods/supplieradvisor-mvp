/**
 * One-off: seed national NSNP products and clone into every active agency.
 * Usage: npx tsx scripts/seed-dbe-catalogue.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import {
  cloneNationalIntoAgency,
  ensureNationalNsnpSeed,
} from '../lib/schools/approved-catalogue';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const seed = await ensureNationalNsnpSeed(sb);
  console.log('national seed', seed);

  const { data: agencies } = await sb
    .from('nsnp_agency_profiles')
    .select('profile_id, agency_name')
    .eq('status', 'active');

  for (const a of agencies || []) {
    const id = Number(a.profile_id);
    const clone = await cloneNationalIntoAgency(sb, id);
    const { count } = await sb
      .from('nsnp_approved_products')
      .select('*', { count: 'exact', head: true })
      .eq('agency_profile_id', id)
      .eq('active', true);
    console.log(a.agency_name, id, clone, 'active products', count);
  }

  const { count: nNat } = await sb
    .from('nsnp_approved_products')
    .select('*', { count: 'exact', head: true })
    .is('agency_profile_id', null);
  console.log('national products', nNat);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
