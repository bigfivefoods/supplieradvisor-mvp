/**
 * Brief 54 — Patch-only GymAdvisor desk saves.
 * Run: npx --yes tsx lib/fitness/brief54-desk-patch-save.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve('app/api/fitness/fitgraph/route.ts'), 'utf8');

const saveStoreCalls = route.match(/await saveStore\(companyId,\s*meta,\s*(withCatalog|store)\);/g) || [];
assert.equal(saveStoreCalls.length, 2, 'only seed_demo and import_clients_xlsx keep saveStore');
assert.match(route, /if \(action === 'seed_demo'\)[\s\S]*await saveStore\(companyId,\s*meta,\s*withCatalog\);/);
assert.match(
  route,
  /if \(\s*action === 'import_clients' \|\|[\s\S]*action === 'import_clients_xlsx'[\s\S]*await saveStore\(companyId,\s*meta,\s*store\);/
);

const afterImport = route.split("if (action === 'backfill_client_crm')")[1] || '';
assert.doesNotMatch(afterImport, /await saveStore\(companyId,\s*meta,\s*store\);/);

assert.match(route, /function keyedStorePatch<[\s\S]*function savePatchForKeys</);
assert.match(
  route,
  /if \(action === 'allocate_member'\)[\s\S]*await savePatchForKeys\([\s\S]*'clients',[\s\S]*'subscriptions',[\s\S]*'bookings'[\s\S]*\);/
);
assert.match(
  route,
  /if \(action === 'issue_class_invite'\)[\s\S]*await savePatchForKeys\([\s\S]*'settings',[\s\S]*'sessions'[\s\S]*\);/
);
assert.match(
  route,
  /const clinicalPatchKeys: Array<keyof FitgraphStore> =[\s\S]*\['visit_notes'\][\s\S]*\['outcome_scores'\][\s\S]*\['treatment_plans'\]/
);
assert.match(
  route,
  /const deletePatchKeys: Array<keyof FitgraphStore> = \[entity\];[\s\S]*'removed_ids'[\s\S]*await savePatchForKeys\([\s\S]*\.\.\.deletePatchKeys\);/
);
assert.match(
  route,
  /const upsertPatchKeys: Array<keyof FitgraphStore> = \[entity\];[\s\S]*upsertPatchKeys\.push\('settings'\);[\s\S]*await savePatchForKeys\([\s\S]*\.\.\.upsertPatchKeys\);/
);

console.log('brief54-desk-patch-save.test.ts ok');
