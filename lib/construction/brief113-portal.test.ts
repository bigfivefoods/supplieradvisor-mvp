/**
 * Subcontractor allow-list, manifest cache, and the service worker branch.
 * Run: npx --yes tsx lib/construction/brief113-portal.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sampleConstructionStore } from './sample-book';
import { buildSubcontractorView } from './subcontractor-view';
import { publicConstructionView } from './portal-screen';
import { qrMatrix } from './qr';

const store = sampleConstructionStore('2026-10-15');
const unscoped = buildSubcontractorView(store, { kind: 'subcontractor' }, 'ConstructionAdvisor®');
assert.equal(unscoped, null);
const scoped = buildSubcontractorView(store, { kind: 'subcontractor', subcontractor_id: 'sample_sub_timber' }, 'ConstructionAdvisor®');
assert.ok(scoped);
const packed = JSON.stringify(scoped);
for (const leak of ['contract_value', 'costs', 'payments', 'certificates', 'Harbour Workshops', 'rate', 'amount']) {
  assert.equal(packed.includes(leak), false, leak);
}
assert.match(packed, /Sample Timber Crew/);
assert.match(packed, /Ridge House/);

const open = publicConstructionView(store, 'sample_public_link', 'ConstructionAdvisor®');
assert.ok(open);
assert.equal(open?.kind, 'public');
assert.equal(open?.payments.length, 0);
assert.equal(JSON.stringify(open).includes('4200000'), false);
assert.equal(JSON.stringify(open).includes('costs'), false);

const manifest = readFileSync(resolve('app/construction/[token]/manifest.webmanifest/route.ts'), 'utf8');
assert.match(manifest, /private, no-store/);
assert.match(manifest, /ConstructionAdvisor®/);
assert.doesNotMatch(manifest, /trading_name|legal_name|companyName/);

const sw = readFileSync(resolve('public/sw.js'), 'utf8');
assert.match(sw, /\/api\/public\/constructiongraph/);
assert.match(sw, /cache:\s*'no-store'/);
assert.match(sw, /construction-offline\.html/);
assert.match(sw, /\/construction\//);
assert.doesNotMatch(sw, /cache\.(put|addAll)\([^)]*\/construction\//);

const matrix = qrMatrix('https://example.test/construction/sample');
assert.equal(matrix.modules.length, matrix.size);
const again = qrMatrix('https://example.test/construction/sample');
assert.deepEqual(matrix.modules, again.modules);
const finder = matrix.modules[0].slice(0, 7).join('');
assert.equal(finder, '1111111');

console.log('brief113-portal.test.ts ok');
