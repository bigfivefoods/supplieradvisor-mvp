/**
 * FleetAdvisor® compliance view states and favicon lock.
 * Run: npx --yes tsx lib/fleet/brief115-ui-parity.test.ts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tradeBtn, tradeCard, tradeField } from '../../components/trades/TradeUi';
import { constructionBtn, constructionCard, constructionField } from '../../components/construction/ConstructionUi';
import { ComplianceView } from '../../components/fleet/ComplianceViews';
import { fleetBtn, fleetCard, fleetField } from '../../components/fleet/FleetUi';
import { emptyFleetBook } from './empty-book';
import { capabilitiesFor } from './roles';

assert.equal(fleetCard, tradeCard);
assert.equal(fleetBtn, tradeBtn);
assert.equal(fleetField, tradeField);
assert.equal(fleetCard, constructionCard);
assert.equal(fleetBtn, constructionBtn);
assert.equal(fleetField, constructionField);
assert.match(fleetBtn, /min-h-11/);

const html = renderToStaticMarkup(
  createElement(ComplianceView, {
    screen: 'compliance',
    phase: 'ready',
    book: emptyFleetBook(),
    role: 'owner',
    caps: capabilitiesFor('owner'),
    periodId: 'last',
    hrefBase: '/preview/fleetgraph',
    today: '2024-07-02',
  })
);
assert.match(html, /Add your first licence disc date/);
assert.match(html, /min-h-11/);

const source = readFileSync('components/fleet/ComplianceViews.tsx', 'utf8');
assert.match(source, /phase === 'loading'/);
assert.match(source, /phase === 'error'/);
assert.match(source, /FleetEmpty/);

const icons = ['app/favicon.ico', 'app/icon.png', 'app/apple-icon.png', 'public/favicon.ico'];
for (const file of icons) {
  assert.equal(existsSync(file), true, file);
  const current = createHash('sha256').update(readFileSync(file)).digest('hex');
  const main = createHash('sha256').update(execFileSync('git', ['show', `origin/main:${file}`])).digest('hex');
  assert.equal(current, main, file);
}

const diff = execFileSync('git', ['diff', '--name-only', 'origin/main']).toString();
assert.equal(/favicon|icon\.png|apple-icon/.test(diff), false);

console.log('brief115-ui-parity.test.ts ok');
