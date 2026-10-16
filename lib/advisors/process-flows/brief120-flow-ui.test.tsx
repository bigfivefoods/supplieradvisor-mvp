/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief120-flow-ui.test.tsx
 */
import assert from 'node:assert/strict';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdvisorProcessFlow } from '../../../components/advisors/AdvisorProcessFlow';
import { capabilitiesFor } from '../../construction/roles';
import { capabilitiesFor as fleetCaps } from '../../fleet/roles';

function html(node: ReactElement): string {
  return renderToStaticMarkup(node);
}

function openingTag(markup: string, marker: string): string {
  const at = markup.indexOf(marker);
  assert.ok(at >= 0, marker);
  const start = markup.lastIndexOf('<', at);
  return markup.slice(start, markup.indexOf('>', start) + 1);
}

function assertNavyOnCyan(tag: string) {
  assert.match(tag, /background-color:#00b4d8/);
  assert.match(tag, /color:#0f172a/);
  assert.doesNotMatch(tag, /color:#fff\b|color:#ffffff|color:white|color:rgb\(255,\s*255,\s*255\)/i);
}

function liCount(markup: string): number {
  return markup.match(/<li\b/g)?.length || 0;
}

function assertFlow(markup: string, steps: number) {
  assert.equal(liCount(markup), steps, markup.slice(0, 200));
  const controls = markup.match(/aria-controls="([^"]+)"/);
  assert.ok(controls);
  assert.equal(markup.includes(`id="${controls[1]}"`), true);
  assert.match(markup, /aria-expanded="(true|false)"/);
  assert.match(markup, /This process has \d+ steps in \d+ phases/);
  assert.equal(markup.includes('href="#"'), false);
  assert.equal(markup.includes('undefined'), false);
  assert.equal(markup.includes('NaN'), false);
  assert.equal(markup.includes('[object'), false);
  assert.equal(markup.includes('<aside'), false);
  assert.equal(markup.includes('dark:'), false);
  assert.equal(markup.includes('amber-'), false);
  assert.equal(markup.includes('stone-'), false);
  assert.equal(markup.includes('text-white'), false);
  assert.equal(markup.includes('aria-label='), false);
  const header = openingTag(markup, 'data-flow-header');
  assertNavyOnCyan(header);
  const badges = markup.match(/<span[^>]*data-flow-badge[^>]*>/g) || [];
  assert.ok(badges.length > 0);
  for (const badge of badges) assertNavyOnCyan(badge);
  const soonBlocks = markup.split('data-flow-state="soon"').slice(1);
  for (const block of soonBlocks) {
    const card = block.slice(0, block.indexOf('</li>'));
    assert.match(card, /aria-disabled="true"/);
    assert.equal(card.includes('<a'), false);
  }
}

const owner = html(
  createElement(AdvisorProcessFlow, {
    module: 'constructiongraph',
    role: 'owner',
    caps: capabilitiesFor('owner'),
    hrefBase: '/dashboard/constructiongraph',
  })
);
assert.match(owner, /aria-expanded="true"/);
assertFlow(owner, 10);
assert.match(owner, /You are the owner/);

const viewer = html(
  createElement(AdvisorProcessFlow, {
    module: 'constructiongraph',
    role: 'viewer',
    caps: capabilitiesFor('viewer'),
    hrefBase: '/dashboard/constructiongraph',
  })
);
assert.match(viewer, /aria-expanded="false"/);
assert.match(viewer, /Not available to your role/);
assertFlow(viewer, 10);

const preview = html(
  createElement(AdvisorProcessFlow, {
    module: 'constructiongraph',
    role: 'owner',
    caps: capabilitiesFor('owner'),
    hrefBase: '/preview/constructiongraph',
  })
);
assert.match(preview, /\/preview\/constructiongraph\/clients\?role=owner/);
assert.equal(preview.includes('href="/dashboard/'), false);
assert.equal(preview.includes('href="/work/'), false);
assertFlow(preview, 10);

const trade = html(
  createElement(AdvisorProcessFlow, {
    module: 'tradegraph',
    hrefBase: '/preview/tradegraph',
    chips: { customers: [{ id: 'later', label: 'Exact count later', tone: 'slate' }] },
  })
);
assert.match(trade, /aria-expanded="true"/);
assert.match(trade, /Exact count later/);
assert.match(trade, /data-testid="advisor-flow-tradegraph"/);
assert.equal(trade.includes('role="none"'), false);
assertFlow(trade, 9);

const fleetOwner = html(
  createElement(AdvisorProcessFlow, {
    module: 'fleetgraph',
    role: 'owner',
    caps: fleetCaps('owner'),
    hrefBase: '/dashboard/fleetgraph',
  })
);
assert.match(fleetOwner, /aria-expanded="true"/);
assert.match(fleetOwner, /You are the owner/);
assert.match(fleetOwner, /href="\/dashboard\/fleetgraph\/cpk"/);
assertFlow(fleetOwner, 10);

const dispatcher = html(
  createElement(AdvisorProcessFlow, {
    module: 'fleetgraph',
    role: 'dispatcher',
    caps: fleetCaps('dispatcher'),
    hrefBase: '/dashboard/fleetgraph',
  })
);
assert.match(dispatcher, /aria-expanded="false"/);
assert.match(dispatcher, /Not available to your role/);
assert.equal(dispatcher.includes('href="/dashboard/fleetgraph/cpk"'), false);
assert.equal(dispatcher.includes('href="/dashboard/fleetgraph/import"'), false);
assertFlow(dispatcher, 10);

const fleetPreview = html(
  createElement(AdvisorProcessFlow, {
    module: 'fleetgraph',
    role: 'owner',
    caps: fleetCaps('owner'),
    hrefBase: '/preview/fleetgraph',
  })
);
assert.match(fleetPreview, /\/preview\/fleetgraph\/vehicles\?role=owner/);
assert.equal(fleetPreview.includes('href="/dashboard/'), false);
assertFlow(fleetPreview, 10);

const apparel = html(
  createElement(AdvisorProcessFlow, {
    module: 'apparelgraph',
    role: 'owner',
    hrefBase: '/dashboard/apparelgraph',
  })
);
assert.match(apparel, /aria-expanded="true"/);
assert.match(apparel, /href="\/dashboard\/apparelgraph\/range"/);
assert.match(apparel, /href="\/dashboard\/quality\/inspections"/);
assert.match(apparel, /View only today/);
assert.match(apparel, /Brand/);
assert.match(apparel, /Factory/);
assertFlow(apparel, 10);

const apparelMember = html(
  createElement(AdvisorProcessFlow, {
    module: 'apparelgraph',
    role: 'member',
    hrefBase: '/dashboard/apparelgraph',
  })
);
assert.match(apparelMember, /aria-expanded="false"/);
assertFlow(apparelMember, 10);

console.log('brief120-flow-ui.test.tsx ok');
