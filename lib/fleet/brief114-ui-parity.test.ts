/**
 * FleetAdvisor® kit parity and static views.
 * Run: npx --yes tsx lib/fleet/brief114-ui-parity.test.ts
 */
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { tradeBtn, tradeCard, tradeField } from '../../components/trades/TradeUi';
import { fleetBtn, fleetCard, fleetField } from '../../components/fleet/FleetUi';
import { FleetDesk } from '../../components/fleet/FleetViews';
import { emptyFleetBook } from './empty-book';
import { capabilitiesFor } from './roles';
import { sampleFleetBook } from './sample-book';

assert.equal(fleetCard, tradeCard);
assert.equal(fleetBtn, tradeBtn);
assert.equal(fleetField, tradeField);
assert.match(fleetBtn, /min-h-11/);
assert.match(fleetField, /min-h-11/);

const screens = ['command', 'map', 'vehicles', 'drivers', 'jobs', 'cpk', 'settings'] as const;

function render(phase: 'loading' | 'error' | 'ready', book = emptyFleetBook(), role: 'owner' | 'dispatcher' | 'office' = 'owner') {
  return renderToStaticMarkup(
    createElement(FleetDesk, {
      screen: 'command',
      phase,
      book,
      role,
      caps: capabilitiesFor(role, { dispatcherSeesRates: false }),
      periodId: 'last',
      hrefBase: '/preview/fleetgraph',
      today: '2024-07-02',
      illustrate: book.vehicles.length > 0,
    })
  );
}

for (const phase of ['loading', 'error', 'ready'] as const) {
  const html = render(phase, phase === 'ready' ? sampleFleetBook() : emptyFleetBook());
  assert.equal(html.includes('undefined'), false, phase);
  assert.equal(html.includes('NaN'), false, phase);
  assert.equal(html.includes('[object Object]'), false, phase);
}

for (const screen of screens) {
  for (const book of [emptyFleetBook(), sampleFleetBook()]) {
    const html = renderToStaticMarkup(
      createElement(FleetDesk, {
        screen,
        phase: 'ready',
        book,
        role: 'owner',
        caps: capabilitiesFor('owner'),
        periodId: 'last',
        hrefBase: '/preview/fleetgraph',
        today: '2024-07-02',
        illustrate: true,
      })
    );
    assert.equal(html.includes('undefined'), false, screen);
    assert.equal(html.includes('NaN'), false, screen);
    assert.equal(html.includes('[object Object]'), false, screen);
    if (book.vehicles.length === 0 && screen !== 'settings') assert.match(html, /Add |Create |Back /);
  }
}

const emptyCommand = render('ready');
assert.match(emptyCommand, /Add your first vehicle/);
assert.match(emptyCommand, /Illustration · sample data/);

console.log('brief114-ui-parity.test.ts ok');
