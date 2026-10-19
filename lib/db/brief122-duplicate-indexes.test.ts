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
  .filter((file) => !file.endsWith('20261033_brief122_b7_drop_duplicate_indexes.sql'))
  .map((file) => stripComments(readFileSync(file, 'utf8')))
  .join('\n');
for (const kept of keptInRepo) {
  assert.match(keptBlob, kept.pattern, `kept index ${kept.name} is no longer created`);
}

const migrationsDir = join(root, 'supabase/migrations');
const migrationNames = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
const rollout = [
  '20261032_brief122_pg_trgm_and_indexes.sql',
  '20261033_brief122_b7_drop_duplicate_indexes.sql',
  '20261034_brief122_b5_rls_select_wrapping.sql',
  '20261035_brief122_b6_lockdown_definer_rpcs.sql',
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

const nextRollout = [
  '20261036_next_n1_function_search_path.sql',
  '20261037_next_n2_fk_indexes.sql',
  '20261038_next_n3_policy_consolidation.sql',
  '20261039_next_n4_drop_business_users_backups.sql',
];
for (const name of nextRollout) {
  assert.ok(migrationNames.includes(name), `missing ${name}`);
}
assert.ok(migrationNames.indexOf(rollout[3]) < migrationNames.indexOf(nextRollout[0]));
for (let i = 1; i < nextRollout.length; i += 1) {
  assert.ok(migrationNames.indexOf(nextRollout[i - 1]) < migrationNames.indexOf(nextRollout[i]));
}

const n1 = readFileSync(join(migrationsDir, nextRollout[0]), 'utf8');
assert.match(n1, /20261019113636/);
assert.match(n1, /next_n1_function_search_path/);
for (const sig of [
  'public.record_onchain_attestation()',
  'public.sa_add_column(text,text,text,text)',
  'public.sa_add_fk(text,text,text,text,text)',
  'public.sa_brief35_recode_party_gl(integer)',
  'public.sa_brief36_recode_member_rev(integer)',
  'public.sa_create_index(text,text,text)',
  'public.sa_merge_module_store_data(jsonb,jsonb)',
  'public.sa_module_store_array_has_id_object(jsonb)',
  'public.sa_module_store_is_tombstone(jsonb)',
  'public.sa_title_person_name(text)',
  'public.set_updated_at()',
  'public.site_insights_channel(text,text,text)',
  'public.update_updated_at_column()',
]) {
  assert.match(n1, new RegExp(sig.replace(/[().]/g, '\\$&')));
}

const n2 = stripComments(readFileSync(join(migrationsDir, nextRollout[1]), 'utf8'));
assert.equal(/CONCURRENTLY/i.test(n2), false);
assert.match(n2, /CREATE INDEX IF NOT EXISTS %I ON public\.%I \(%I\)/);
for (const name of [
  'idx_site_traffic_daily_company_id',
  'idx_site_traffic_sites_company_id',
  'idx_site_insights_portal_activity_company_id',
  'idx_fg_portal_invites_company_id',
  'idx_fg_portal_sessions_company_id',
  'idx_recover_portal_otps_company_id',
  'idx_nsnp_prize_awards_school_profile_id',
]) {
  assert.match(n2, new RegExp(name));
}
for (const name of [
  'idx_nsnp_prize_awards_period_id',
  'idx_nsnp_prize_certificates_period_id',
  'idx_nsnp_isp_sla_school_profile_id',
  'idx_products_category_id',
  'idx_industries_parent_id',
  'idx_onchain_attestations_attested_by',
]) {
  assert.equal(n2.includes(name), false, `${name} must stay unindexed`);
}

const n3 = readFileSync(join(migrationsDir, nextRollout[2]), 'utf8');
assert.match(n3, /20261019113922/);
assert.match(n3, /DROP POLICY IF EXISTS sa_deny_anon/);
assert.match(n3, /DROP POLICY IF EXISTS sa_deny_authenticated/);
assert.match(n3, /ALTER POLICY %I ON public\.%I TO service_role/);
for (const table of ['products', 'stock_levels', 'stock_movements', 'warehouses']) {
  assert.match(n3, new RegExp(`'${table}'`));
}

const n4 = readFileSync(join(migrationsDir, nextRollout[3]), 'utf8');
assert.match(n4, /20261019122057/);
assert.match(n4, /DROP TABLE IF EXISTS public\.business_users_backup/);
assert.match(n4, /DROP TABLE IF EXISTS public\.business_users_final_backup/);
assert.match(n4, /brief122\.acknowledge_business_users_backup_drop/);
assert.match(n4, /refusing to drop business_users backup tables/);
assert.equal(/DROP TABLE[^;]*public\.business_users;/.test(n4), false);
assert.equal(migrationNames.some((name) => /^2026102[4-9]_/.test(name) || /^2026103[01]_/.test(name)), false);

const pinnedNames = [
  'record_onchain_attestation',
  'sa_add_column',
  'sa_add_fk',
  'sa_brief35_recode_party_gl',
  'sa_brief36_recode_member_rev',
  'sa_create_index',
  'sa_merge_module_store_data',
  'sa_module_store_array_has_id_object',
  'sa_module_store_is_tombstone',
  'sa_title_person_name',
  'set_updated_at',
  'site_insights_channel',
  'update_updated_at_column',
];
const fnStart = new RegExp(
  `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.(${pinnedNames.join('|')})\\s*\\(`,
  'gi',
);
let pinnedCount = 0;
for (const file of files) {
  const code = readFileSync(file, 'utf8');
  fnStart.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = fnStart.exec(code))) {
    const openParen = match.index + match[0].length - 1;
    let depth = 0;
    let i = openParen;
    for (; i < code.length; i += 1) {
      if (code[i] === '(') depth += 1;
      else if (code[i] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const body = /\bAS\s+\$[A-Za-z0-9_]*\$/i.exec(code.slice(i + 1));
    assert.ok(body, `${file} ${match[1]} has no body`);
    const header = code.slice(i + 1, i + 1 + body.index);
    assert.match(header, /SET search_path = public, pg_temp/, `${file} ${match[1]}`);
    pinnedCount += 1;
  }
}
assert.ok(pinnedCount >= 13, `expected pinned function copies, got ${pinnedCount}`);

const allowPolicies = stripComments(files.map((file) => readFileSync(file, 'utf8')).join('\n'));
for (const name of ['products_all', 'warehouses_all', 'stock_levels_all', 'stock_movements_all']) {
  const open = new RegExp(`CREATE POLICY ${name}\\b[\\s\\S]*?;`, 'g');
  const found = allowPolicies.match(open) ?? [];
  assert.ok(found.length >= 1, `missing ${name}`);
  for (const statement of found) {
    assert.match(statement, /TO service_role/, statement);
  }
}

for (const file of [
  'supabase/migrations/20260714_rls_security_lockdown.sql',
  'supabase/migrations/20260821_saas_db_harden.sql',
  'RUN_THIS_IN_SUPABASE.sql',
  'docs/RUN_THIS_IN_SUPABASE.sql',
]) {
  const code = stripComments(readFileSync(join(root, file), 'utf8'));
  assert.match(code, /p_table IN \('products', 'stock_levels', 'stock_movements', 'warehouses'\)/);
  assert.match(code, /TO service_role USING \(true\) WITH CHECK \(true\)/);
}

const backupCreates = files.flatMap((file) => {
  const code = stripComments(readFileSync(file, 'utf8'));
  return ['business_users_backup', 'business_users_final_backup'].filter((name) =>
    new RegExp(`CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(?:public\\.)?${name}\\b`, 'i').test(code),
  ).map((name) => `${file} creates ${name}`);
});
assert.deepEqual(backupCreates, []);

console.log('brief122-duplicate-indexes.test.ts ok');
