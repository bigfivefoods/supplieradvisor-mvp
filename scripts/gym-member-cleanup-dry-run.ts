/**
 * GymAdvisor® member clean-up. DRY-RUN by default.
 *
 * Reads one company's fitgraph JSON book and prints a proposed change report:
 * duplicate merges (including a Bianca Westhorpe-Pottow pair when present),
 * Hawa Ismail / Zubeida Akoob shared contact flagged for manual review,
 * private_client reconciled to coach assignment, phone normalisation,
 * invalid phones flagged.
 *
 * This script never writes. It refuses the production Supabase project.
 * Apply the report only after Craig approves it.
 *
 *   npx --yes tsx scripts/gym-member-cleanup-dry-run.ts --file book.json
 *   npx --yes tsx scripts/gym-member-cleanup-dry-run.ts --company-id 110
 *
 * --apply is rejected. There is no write path.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import type { FitgraphStore } from '@/lib/fitness/fitgraph';
import {
  buildMemberCleanupReport,
  formatMemberCleanupReport,
} from '@/lib/fitness/member-directory';

const PRODUCTION_REF = 'onkklullmgrdqoertngp';
const STAGING_REF = 'wpchtkfkaavcjyfgmktn';

function arg(name: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 ? String(process.argv[i + 1] || '') : '';
}

function refuseProduction(url: string) {
  if (url.includes(PRODUCTION_REF)) {
    console.error(
      'Refusing production Supabase (onkklullmgrdqoertngp). This script is not allowed to read or write production.'
    );
    process.exit(2);
  }
}

async function loadStore(): Promise<FitgraphStore> {
  const file = arg('--file');
  if (file) {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as FitgraphStore;
    return raw;
  }
  const companyId = Number(arg('--company-id'));
  if (!Number.isFinite(companyId) || companyId <= 0) {
    console.error('Pass --file book.json or --company-id <id>.');
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    console.error('Missing Supabase URL or service role key.');
    process.exit(1);
  }
  refuseProduction(url);
  if (!url.includes(STAGING_REF)) {
    console.error(
      `Refusing ${url}. Dry-run reads are limited to staging (${STAGING_REF}).`
    );
    process.exit(2);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from('company_module_stores')
    .select('data')
    .eq('company_id', companyId)
    .eq('module', 'fitgraph')
    .maybeSingle();
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  const book = (data?.data || {}) as FitgraphStore;
  if (!Array.isArray(book.clients)) book.clients = [];
  return book;
}

async function main() {
  if (process.argv.includes('--apply')) {
    console.error(
      'Refusing to apply. This script is dry-run only. Craig must approve the report before any write.'
    );
    process.exit(3);
  }
  const store = await loadStore();
  const report = buildMemberCleanupReport(store);
  console.log(formatMemberCleanupReport(report));
}

void main();
