/**
 * FleetAdvisor® compliance view states and favicon lock.
 * Run: npx --yes tsx lib/fleet/brief115-ui-parity.test.ts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tradeBtn, tradeCard, tradeField } from '../../components/trades/TradeUi';
import { constructionBtn, constructionCard, constructionField } from '../../components/construction/ConstructionUi';
import { ComplianceView, RemindersPanel } from '../../components/fleet/ComplianceViews';
import { fleetBtn, fleetCard, fleetField } from '../../components/fleet/FleetUi';
import { emptyFleetBook } from './empty-book';
import { sampleFleetBook } from './sample-book';
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

const icons = JSON.parse(readFileSync('lib/fleet/brief115-icon-snapshot.json', 'utf8')) as Record<string, string>;
for (const [file, hash] of Object.entries(icons)) {
  assert.equal(existsSync(file), true, file);
  const current = createHash('sha256').update(readFileSync(file)).digest('hex');
  assert.equal(current, hash, file);
}
assert.equal(source.includes("recipient_member_ids: props.book.members.map"), false);
assert.match(source, /scope_kind: form\.scope_kind/);
assert.match(source, /recipient_member_ids: form\.recipient_member_ids/);
assert.match(source, /channels: form\.channels/);
assert.match(source, /enabled: form\.enabled/);
assert.match(source, /fleet-web-push/);
assert.match(source, /fleet-reminder-zero/);
assert.match(source, /fleet-reminder-more/);
assert.match(source, /fleet-import-table/);
assert.match(source, /Next reminder/);

const sample = sampleFleetBook();
const reminders = renderToStaticMarkup(
  createElement(RemindersPanel, {
    screen: 'settings',
    phase: 'ready',
    book: sample,
    role: 'owner',
    caps: capabilitiesFor('owner'),
    periodId: 'last',
    hrefBase: '/preview/fleetgraph',
    today: '2024-07-02',
  })
);
assert.match(reminders, /value="30, 14, 7, 0"/);
assert.match(reminders, /fleet-reminder-enabled/);
assert.match(reminders, /checked/);
assert.match(reminders, /member-owner/);
assert.match(reminders, /Web push is not configured on this desk/);
assert.match(reminders, /1 reminder/);

const quietBook = sampleFleetBook();
quietBook.reminders = [];
const quiet = renderToStaticMarkup(
  createElement(RemindersPanel, {
    screen: 'settings',
    phase: 'ready',
    book: quietBook,
    role: 'owner',
    caps: capabilitiesFor('owner'),
    periodId: 'last',
    hrefBase: '/preview/fleetgraph',
    today: '2024-07-02',
  })
);
assert.match(quiet, /No reminder matches this date/);
assert.equal(quiet.includes('fleet-reminder-enabled'), true);
assert.equal(/data-testid="fleet-reminder-enabled"[^>]*checked/.test(quiet) || /checked[^>]*data-testid="fleet-reminder-enabled"/.test(quiet), false);

console.log('brief115-ui-parity.test.ts ok');
