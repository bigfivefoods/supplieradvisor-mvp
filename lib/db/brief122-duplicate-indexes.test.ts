/**
 * Brief 122. The 17 indexes dropped on production must not be created again
 * by repo SQL. No database connection.
 *
 * Run: npx --yes tsx lib/db/brief122-duplicate-indexes.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('.');

const dropped = [
  'idx_bank_txn_status2',
  'idx_bc_requester_id',
  'idx_connections_requester',
  'idx_bc_requestee_id',
  'idx_connections_requestee',
  'idx_company_documents_profile_id',
  'idx_container_inventory_profile',
  'idx_customers_profile_name',
  'idx_documents_profile_id',
  'idx_invitations_profile_id',
  'idx_isp_agency_links_agency',
  'idx_nsnp_recipes_agency_active',
  'idx_projects_profile_id',
  'idx_po_supplier_legacy',
  'idx_nsnp_deliv_isp_status',
  'idx_nsnp_deliv_school_status',
  'idx_srm_suppliers_profile_updated',
] as const;

const keptInRepo: { name: string; pattern: RegExp }[] = [
  { name: 'idx_bank_txn_status', pattern: /idx_bank_txn_status(?![0-9_])/ },
  { name: 'idx_company_documents_profile', pattern: /idx_company_documents_profile(?!_)/ },
  { name: 'idx_container_inv_profile', pattern: /idx_container_inv_profile\b/ },
  { name: 'customers_profile_trading_name', pattern: /customers_profile_trading_name\b/ },
  { name: 'idx_documents_profile', pattern: /idx_documents_profile(?!_)/ },
  { name: 'idx_invitations_profile', pattern: /idx_invitations_profile(?!_)/ },
  { name: 'idx_nsnp_isp_agency_links_agency_status', pattern: /idx_nsnp_isp_agency_links_agency_status\b/ },
  { name: 'idx_nsnp_recipes_agency', pattern: /idx_nsnp_recipes_agency(?!_)/ },
  { name: 'idx_projects_profile', pattern: /idx_projects_profile(?!_)/ },
  { name: 'idx_po_supplier_id', pattern: /idx_po_supplier_id\b/ },
  { name: 'idx_nsnp_deliv_isp', pattern: /idx_nsnp_deliv_isp(?!_)/ },
  { name: 'idx_nsnp_deliv_school', pattern: /idx_nsnp_deliv_school(?!_)/ },
  { name: 'srm_suppliers_profile_updated_desc', pattern: /srm_suppliers_profile_updated_desc\b/ },
];

function sqlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'lib') continue;
      out.push(...sqlFiles(path));
    } else if (entry.name.endsWith('.sql')) {
      out.push(path);
    }
  }
  return out;
}

function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

const files = sqlFiles(root);
assert.ok(files.length > 50, 'expected to scan the repo SQL files');

const createHits: string[] = [];
for (const file of files) {
  const code = stripComments(readFileSync(file, 'utf8'));
  for (const name of dropped) {
    const createIndex = new RegExp(
      `CREATE\\s+(?:UNIQUE\\s+)?INDEX(?:\\s+CONCURRENTLY)?(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+${name}\\b`,
      'i',
    );
    const helper = new RegExp(`sa_create_index\\s*\\(\\s*'${name}'`, 'i');
    if (createIndex.test(code) || helper.test(code)) {
      createHits.push(`${file} creates ${name}`);
    }
  }
}
assert.deepEqual(createHits, []);

const keptBlob = files
  .filter((file) => !file.endsWith('20261025_brief122_b7_drop_duplicate_indexes.sql'))
  .map((file) => stripComments(readFileSync(file, 'utf8')))
  .join('\n');
for (const kept of keptInRepo) {
  assert.match(keptBlob, kept.pattern, `kept index ${kept.name} is no longer created`);
}

const migrationsDir = join(root, 'supabase/migrations');
const migrationNames = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
const rollout = [
  '20261024_brief122_pg_trgm_and_indexes.sql',
  '20261025_brief122_b7_drop_duplicate_indexes.sql',
  '20261026_brief122_b5_rls_select_wrapping.sql',
  '20261027_brief122_b6_lockdown_definer_rpcs.sql',
];
for (const name of rollout) {
  assert.ok(migrationNames.includes(name), `missing ${name}`);
}
const previous = migrationNames[migrationNames.indexOf(rollout[0]) - 1];
assert.equal(previous, '20261023_brief122_merge_metadata_noop.sql');
for (let i = 1; i < rollout.length; i += 1) {
  assert.ok(migrationNames.indexOf(rollout[i - 1]) < migrationNames.indexOf(rollout[i]));
}

const indexSql = stripComments(readFileSync(join(migrationsDir, rollout[0]), 'utf8'));
assert.equal(/CONCURRENTLY/i.test(indexSql), false);
assert.equal(indexSql.match(/CREATE INDEX IF NOT EXISTS/g)?.length, 113);
assert.match(indexSql, /CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions/);

const b7 = readFileSync(join(migrationsDir, rollout[1]), 'utf8');
for (const name of dropped) {
  assert.match(b7, new RegExp(`DROP INDEX IF EXISTS public\\.${name};`));
}
assert.match(b7, /20261019105859/);

const b5 = readFileSync(join(migrationsDir, rollout[2]), 'utf8');
assert.match(b5, /20261019105914/);
assert.equal(b5.split('\n').filter((line) => line.startsWith('ALTER POLICY')).length, 11);
assert.match(b5, /\(SELECT current_setting\(/);

const b6 = readFileSync(join(migrationsDir, rollout[3]), 'utf8');
assert.match(b6, /20261019105955/);
assert.match(b6, /REVOKE EXECUTE ON FUNCTION public\.sa_nsnp_agency_summary\(bigint\) FROM PUBLIC/);
assert.match(b6, /REVOKE EXECUTE ON FUNCTION public\.user_has_access_to_profile\(bigint\) FROM PUBLIC/);
const accessBlock = b6.split("to_regprocedure('public.user_has_access_to_profile(bigint)')")[1]
  .split("to_regprocedure('public.get_current_user_id()')")[0];
const currentUserBlock = b6.split("to_regprocedure('public.get_current_user_id()')")[1]
  .split("to_regprocedure('public.rls_auto_enable()')")[0];
assert.equal(/FROM authenticated/.test(accessBlock), false);
assert.equal(/FROM authenticated/.test(currentUserBlock), false);
assert.match(b6, /REVOKE EXECUTE ON FUNCTION public\.rls_auto_enable\(\) FROM authenticated/);

console.log('brief122-duplicate-indexes.test.ts ok');
