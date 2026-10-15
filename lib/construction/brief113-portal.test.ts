/**
 * Workers money flag, client wallet fields, manifest cache, and the service worker branch.
 * There is no subcontractor login.
 * Run: npx --yes tsx lib/construction/brief113-portal.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sampleConstructionStore } from './sample-book';
import { portalViewForToken } from './constructiongraph';
import { publicConstructionView } from './portal-screen';
import { qrMatrix } from './qr';

const store = sampleConstructionStore('2026-10-15');
assert.equal(store.portals.some((row) => (row.kind as string) === 'subcontractor'), false);
const workers = portalViewForToken(store, 'sample_site_link', 'ConstructionAdvisor®');
assert.ok(workers);
assert.equal(workers?.kind, 'contractor');
if (workers?.kind === 'contractor') {
  assert.equal(workers.seeMoney, false);
  assert.equal('certifiedAmount' in (workers.payments[0] || {}), false);
}
const allowed = portalViewForToken(
  { ...store, settings: { workers_see_money: true } },
  'sample_site_link',
  'ConstructionAdvisor®'
);
assert.equal(allowed?.kind, 'contractor');
if (allowed?.kind === 'contractor') {
  assert.equal(allowed.seeMoney, true);
  assert.equal(typeof allowed.payments[0]?.certifiedAmount, 'number');
}
const client = portalViewForToken(store, 'sample_client_link', 'ConstructionAdvisor®');
assert.equal(client?.kind, 'client');
if (client?.kind === 'client') {
  assert.ok(client.payments.length > 0);
  assert.ok(Array.isArray(client.variations));
  assert.ok(Array.isArray(client.documents));
  assert.equal(JSON.stringify(client).includes('costs'), false);
}
const desk = readFileSync(resolve('components/construction/views/RegisterViews.tsx'), 'utf8');
assert.match(desk, /Invite to TradeAdvisor®/);
assert.match(desk, /Site Link coming next/);
assert.doesNotMatch(desk, /ensure_subcontractor_portal/);

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
const ownerManifest = readFileSync(resolve('app/work/constructiongraph/manifest.webmanifest/route.ts'), 'utf8');
assert.match(ownerManifest, /ConstructionAdvisor® owner/);
assert.match(ownerManifest, /public, max-age=3600/);
const workersManifest = readFileSync(resolve('app/crew/constructiongraph/[token]/manifest.webmanifest/route.ts'), 'utf8');
assert.match(workersManifest, /ConstructionAdvisor® workers/);
assert.match(workersManifest, /private, no-store/);
const clientManifest = readFileSync(resolve('app/customer/constructiongraph/[token]/manifest.webmanifest/route.ts'), 'utf8');
assert.match(clientManifest, /ConstructionAdvisor®/);
assert.match(clientManifest, /private, no-store/);

const sw = readFileSync(resolve('public/sw.js'), 'utf8');
assert.match(sw, /\/api\/public\/constructiongraph/);
assert.match(sw, /cache:\s*'no-store'/);
assert.match(sw, /construction-offline\.html/);
assert.match(sw, /\/construction\//);
assert.match(sw, /\/crew\/constructiongraph/);
assert.match(sw, /\/customer\/constructiongraph/);
assert.doesNotMatch(sw, /cache\.(put|addAll)\([^)]*\/construction\//);

const issued = `cgp_${'ab'.repeat(32)}`;
const previewLink = `/preview/constructiongraph/portal?token=${issued}`;
const liveLink = `/construction/${issued}`;
assert.equal(previewLink.length <= 122, true);
assert.doesNotThrow(() => qrMatrix(previewLink));
assert.equal(qrMatrix(previewLink).size, 45);
assert.doesNotThrow(() => qrMatrix(liveLink));
const matrix = qrMatrix('https://example.test/construction/sample');
assert.equal(matrix.modules.length, matrix.size);
const again = qrMatrix('https://example.test/construction/sample');
assert.deepEqual(matrix.modules, again.modules);
const finder = matrix.modules[0].slice(0, 7).join('');
assert.equal(finder, '1111111');

console.log('brief113-portal.test.ts ok');
