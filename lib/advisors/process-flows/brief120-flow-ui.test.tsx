/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief120-flow-ui.test.tsx
 */
import assert from 'node:assert/strict';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdvisorProcessFlow } from '../../../components/advisors/AdvisorProcessFlow';
import { capabilitiesFor } from '../../construction/roles';

function html(node: ReactElement): string {
  return renderToStaticMarkup(node);
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
  const header = markup.slice(markup.indexOf('data-flow-header'), markup.indexOf('advisor-flow-toggle'));
  assert.equal(header.includes('#00b4d8'), true);
  assert.equal(header.includes('#0f172a'), true);
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

console.log('brief120-flow-ui.test.tsx ok');
