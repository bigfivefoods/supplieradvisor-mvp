/**
 * Sample names and amounts stay inside /preview.
 * Run: npx --yes tsx lib/recovery/brief111-sample-scope.test.ts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecoverCommand } from '@/components/recovery/RecoverCommand';
import { RecoverQueue } from '@/components/recovery/RecoverQueue';
import { PortalPending } from '@/components/recovery/PortalPending';
import { RecoverPreviewProvider } from '@/components/recovery/useRecoverDesk';
import { RECOVER_BRAND } from '@/lib/recovery/brand';
import { formatRecoverMoney } from '@/lib/recovery/money';
import { illustrationFor, sampleDesk } from '@/lib/recovery/sample-desk';
import type { RecoverDeskPayload, RecoverRole } from '@/lib/recovery/types';

const NAMES = ['Amahle Nkosi', 'Johan Pretorius', 'Lindiwe Dlamini', 'Northline Credit', 'Meridian Finance'];
const PLACED = formatRecoverMoney(124060000);

function flat(value: string) {
  return value.replace(/[\u00a0\u202f\u2007]/g, ' ');
}

function filesIn(path: string): string[] {
  const full = resolve(path);
  if (!statSync(full, { throwIfNoEntry: false })?.isDirectory()) {
    return statSync(full, { throwIfNoEntry: false }) ? [full] : [];
  }
  return readdirSync(full).flatMap((name) => filesIn(resolve(full, name)));
}

function emptyDesk(role: RecoverRole, ready = true): RecoverDeskPayload {
  return {
    ready,
    reason: ready ? undefined : 'migration_pending',
    workspace: null,
    role,
    capabilities: {
      canSeeAllQueues: role === 'owner' || role === 'manager',
      canEditSettings: role === 'owner' || role === 'manager',
      canSeeTrust: role === 'owner',
      canManageStaff: role === 'owner' || role === 'manager',
      canSetRealData: role === 'owner',
    },
    counts: { creditors: 0, mandates: 0, staff: 0 },
    creditors: [],
    mandates: [],
    staff: [],
    self: null,
  };
}

function markup(desk: RecoverDeskPayload, illustration: ReturnType<typeof illustrationFor> | null, node: ReactNode) {
  return renderToStaticMarkup(
    createElement(RecoverPreviewProvider, { desk, illustration, hrefBase: null }, node)
  );
}

function refusesSamples(html: string, label: string) {
  const text = flat(html);
  for (const name of NAMES) assert.equal(text.includes(name), false, `${label} leaked ${name}`);
  assert.equal(text.includes(flat(PLACED)), false, `${label} leaked the placed amount`);
  assert.equal(text.includes('R 1 240 600'), false, label);
  assert.equal(text.includes('R 18 450'), false, label);
}

const liveOwner = markup(emptyDesk('owner'), null, createElement(RecoverCommand));
refusesSamples(liveOwner, 'signed-in command');
assert.match(liveOwner, /No accounts yet/);
assert.match(liveOwner, /recover-banner-demo/);
assert.doesNotMatch(liveOwner, /Collector workload|Recovery funnel/);

const pendingAgent = markup(emptyDesk('agent', false), null, createElement(RecoverCommand));
refusesSamples(pendingAgent, 'pending agent');
assert.match(pendingAgent, /not available yet/);
assert.doesNotMatch(pendingAgent, /awaiting approval/);

const pendingOwner = markup(emptyDesk('owner', false), null, createElement(RecoverCommand));
refusesSamples(pendingOwner, 'pending owner');
assert.match(pendingOwner, /awaiting approval/);

const pendingViewer = markup(emptyDesk('viewer', false), null, createElement(RecoverQueue));
refusesSamples(pendingViewer, 'pending queue');
assert.match(pendingViewer, /not available yet/);

const previewOwner = markup(sampleDesk('owner'), illustrationFor('owner'), createElement(RecoverCommand));
assert.match(previewOwner, /Amahle Nkosi/);
assert.match(previewOwner, /Lindiwe Dlamini/);
assert.match(previewOwner, /Collector workload/);
assert.doesNotMatch(previewOwner, /Call notes|Sample desk picture|tiles above the illustration stay blank/);
assert.match(flat(previewOwner), /R 1 240 600/);
assert.match(previewOwner, new RegExp(PLACED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const previewAgent = markup(sampleDesk('agent'), illustrationFor('agent'), createElement(RecoverCommand));
assert.match(previewAgent, /Cedar Retail/);
assert.match(previewAgent, /Pebble Stores/);
assert.match(previewAgent, /Next best action/);
assert.match(previewAgent, /Promises due/);
assert.match(previewAgent, /Call notes/);
assert.doesNotMatch(previewAgent, /Oak Lane Grocer/);
assert.doesNotMatch(previewAgent, /Lindiwe Dlamini/);
assert.doesNotMatch(previewAgent, /Johan Pretorius/);
assert.doesNotMatch(previewAgent, /Collector workload/);

const previewQueue = markup(sampleDesk('owner'), illustrationFor('owner'), createElement(RecoverQueue));
assert.match(previewQueue, /Every account on the illustrated book/);
assert.doesNotMatch(previewQueue, /no account book yet/i);
assert.doesNotMatch(previewQueue, /Next best action/);

const previewClient = markup(sampleDesk('owner'), illustrationFor('client'), createElement(RecoverQueue));
assert.match(previewClient, /Cedar Retail/);
assert.match(previewClient, /Your balance/);
assert.match(previewClient, /Payment plan/);
assert.match(previewClient, /Launching soon/);
assert.doesNotMatch(previewClient, /Pebble Stores/);
assert.doesNotMatch(previewClient, /Oak Lane Grocer/);
assert.doesNotMatch(previewClient, /Amahle Nkosi/);
assert.doesNotMatch(previewClient, /Work queue/);

const portal = renderToStaticMarkup(createElement(PortalPending, { kind: 'creditor' }));
refusesSamples(portal, 'portal');

const outside = [
  'app/dashboard/recovergraph',
  'app/work/recovergraph',
  'app/crew/recovergraph',
  'app/customer/recovergraph',
  'app/(recover-portal)',
].flatMap((dir) => filesIn(dir));
assert.ok(outside.length > 5);
for (const file of outside) {
  const text = readFileSync(file, 'utf8');
  for (const name of NAMES) assert.equal(text.includes(name), false, file);
  assert.equal(text.includes('R 1 240 600'), false, file);
  assert.equal(text.includes('/preview/recovergraph'), false, file);
}

assert.equal(RECOVER_BRAND.accentHover, '#00b4d8');
assert.doesNotMatch(readFileSync(resolve('lib/recovery/brand.ts'), 'utf8'), /#0096c7/);
assert.doesNotMatch(readFileSync(resolve('lib/recovery/sample-desk.ts'), 'utf8'), /R 18 450|R 1 240 600/);
assert.doesNotMatch(readFileSync(resolve('components/recovery/RecoverTeam.tsx'), 'utf8'), /eu-west-2|London/);
assert.doesNotMatch(readFileSync(resolve('docs/recoveradvisor-foundation.md'), 'utf8'), /eu-west-2|London/);
assert.doesNotMatch(readFileSync(resolve('components/recovery/RecoverPreviews.tsx'), 'utf8'), /tiles above the illustration stay blank|min-w-\[44rem\]/);
assert.doesNotMatch(readFileSync(resolve('components/recovery/RecoverCommand.tsx'), 'utf8'), /1\.4fr/);
assert.match(readFileSync(resolve('components/recovery/RecoverChrome.tsx'), 'utf8'), /clamp\(0\.8rem,3\.2vw,1\.875rem\)/);
const installTags = readFileSync(resolve('components/pwa/SiteInstallTags.tsx'), 'utf8');
assert.doesNotMatch(installTags, /sa-favicon/);
assert.match(readFileSync(resolve('lib/pwa/register-script.ts'), 'utf8'), /\{scope:'\/'/);
assert.match(installTags, /scope "\/"/);
assert.doesNotMatch(
  readFileSync(resolve('app/customer/recovergraph/[token]/manifest.webmanifest/route.ts'), 'utf8'),
  /sample creditor|sample views/
);
const layout = readFileSync(resolve('app/layout.tsx'), 'utf8');
assert.equal((layout.match(/sizes:\s*'any'/g) || []).length, 1);
assert.equal(
  createHash('sha256').update(readFileSync(resolve('app/favicon.ico'))).digest('hex'),
  '8881d68ceb8c7ab3fb3512824d5d1a6e69055ea28c74270bfeb00ad650c18712'
);

console.log('brief111-sample-scope.test.ts ok');
