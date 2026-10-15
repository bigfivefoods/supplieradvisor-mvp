/**
 * Sample names and amounts stay inside /preview.
 * Run: npx --yes tsx lib/recovery/brief111-sample-scope.test.ts
 */
import assert from 'node:assert/strict';
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
  for (const name of NAMES) assert.equal(html.includes(name), false, `${label} leaked ${name}`);
  assert.equal(html.includes(PLACED), false, `${label} leaked the placed amount`);
  assert.equal(html.includes('R 1 240 600'), false, label);
  assert.equal(html.includes('R 18 450'), false, label);
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
assert.match(previewOwner, new RegExp(PLACED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const previewAgent = markup(sampleDesk('agent'), illustrationFor('agent'), createElement(RecoverCommand));
assert.match(previewAgent, /Cedar Retail/);
assert.match(previewAgent, /Pebble Stores/);
assert.doesNotMatch(previewAgent, /Oak Lane Grocer/);
assert.doesNotMatch(previewAgent, /Lindiwe Dlamini/);
assert.doesNotMatch(previewAgent, /Johan Pretorius/);

const previewClient = markup(sampleDesk('owner'), illustrationFor('client'), createElement(RecoverQueue));
assert.match(previewClient, /Cedar Retail/);
assert.doesNotMatch(previewClient, /Pebble Stores/);
assert.doesNotMatch(previewClient, /Oak Lane Grocer/);
assert.doesNotMatch(previewClient, /Amahle Nkosi/);

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
assert.doesNotMatch(readFileSync(resolve('components/pwa/SiteInstallTags.tsx'), 'utf8'), /sa-favicon/);

console.log('brief111-sample-scope.test.ts ok');
