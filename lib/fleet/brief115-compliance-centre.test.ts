/**
 * FleetAdvisor® compliance centre rows and views.
 * Run: npx --yes tsx lib/fleet/brief115-compliance-centre.test.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComplianceView, DriverDetailView, ImportView, RemindersPanel, VehicleDetailView } from '../../components/fleet/ComplianceViews';
import { centreRows, centreSummary, monthAgenda } from './compliance-centre';
import { emptyFleetBook } from './empty-book';
import { capabilitiesFor } from './roles';
import { renewItem, timelineFor } from './renewal';
import { sampleFleetBook } from './sample-book';
import type { FleetBook, FleetCompliance } from './types';

function item(patch: Partial<FleetCompliance>): FleetCompliance {
  return {
    id: 'item',
    company_id: 1,
    subject_kind: 'vehicle',
    subject_id: 'v',
    kind: 'licence_disc',
    reference: '',
    issued_on: '2024-01-01',
    expires_on: '2024-06-01',
    detail: {},
    status_note: '',
    archived_at: null,
    updated_at: '2024-01-01T00:00:00.000Z',
    ...patch,
  };
}

const book = emptyFleetBook(1, '2024-07-02T00:00:00.000Z');
book.vehicles = [
  {
    id: 'v',
    company_id: 1,
    reg_no: 'SAMPLE 01',
    kind: 'rigid',
    ownership: 'owned',
    make: '',
    model: '',
    year: null,
    vin: '',
    gvm_kg: null,
    tare_kg: null,
    payload_kg: null,
    fuel_type: '',
    tank_litres: null,
    odometer_km: null,
    odometer_at: null,
    status: 'active',
    depot_label: 'Sample Depot',
    tracker_fitted: false,
    tracker_provider: '',
    notes: '',
    archived_at: null,
    updated_at: '2024-07-02T00:00:00.000Z',
  },
];
book.compliance = [
  item({ id: 'old', expires_on: '2023-01-01', archived_at: '2024-01-01T00:00:00.000Z' }),
  item({ id: 'current', expires_on: '2024-06-01', renewed_from_id: 'old' }),
  item({ id: 'leap', kind: 'roadworthy', expires_on: '2024-02-29' }),
  item({ id: 'march', kind: 'other', expires_on: '2024-03-01T22:30:00.000Z' }),
];
book.workspace.expected_vehicle_kinds = ['licence_disc', 'roadworthy', 'insurance'];

const rows = centreRows(book, '2024-07-02');
assert.equal(rows.some((row) => row.id === 'old'), false);
assert.ok(rows.some((row) => row.id === 'current' && row.historyCount === 1));
assert.equal(rows.find((row) => row.kind === 'roadworthy')?.synthetic, false);
assert.ok(rows.some((row) => row.synthetic && row.kind === 'insurance' && row.status === 'no_date'));
assert.equal(rows[0].status, 'expired');
const summary = centreSummary(rows);
assert.equal(summary.expired + summary.expiring + summary.not_recorded + summary.valid, rows.length);

const filtered = centreRows(book, '2024-07-02', { kind: 'licence_disc', depot: 'Sample Depot', search: 'sample' });
assert.ok(filtered.every((row) => row.kind === 'licence_disc'));

const agenda = monthAgenda(rows);
const feb = agenda.find((month) => month.month === '2024-03');
assert.ok(feb);
assert.ok(feb?.dates.some((day) => day.date === '2024-03-02'));
const leap = monthAgenda(centreRows(book, '2024-07-02')).flatMap((month) => month.dates.map((day) => day.date));
assert.ok(leap.includes('2024-02-29'));

const renewed = renewItem(book, 'current', { expires_on: '2025-06-01', reference: 'Next' }, '2024-07-02T00:00:00.000Z');
assert.equal(renewed.ok, true);
if (renewed.ok) {
  assert.equal(renewed.item.renewed_from_id, 'current');
  assert.ok(renewed.book.compliance.find((row) => row.id === 'current')?.archived_at);
  const line = timelineFor({ kind: 'vehicle', id: 'v' }, renewed.book.compliance);
  assert.equal(line[0].current, true);
}
const earlier = renewItem(book, 'current', { expires_on: '2024-01-01' }, '2024-07-02T00:00:00.000Z');
assert.equal(earlier.ok, false);

function render(node: ReturnType<typeof createElement>) {
  const html = renderToStaticMarkup(node);
  assert.equal(html.includes('NaN'), false);
  assert.equal(html.includes('undefined'), false);
  assert.equal(html.includes('[object Object]'), false);
  return html;
}

const caps = capabilitiesFor('owner');
const base = {
  phase: 'ready' as const,
  book: emptyFleetBook(),
  role: 'owner' as const,
  caps,
  periodId: 'last' as const,
  hrefBase: '/preview/fleetgraph',
  today: '2024-07-02',
  illustrate: false,
};
for (const phase of ['loading', 'error', 'ready'] as const) {
  render(createElement(ComplianceView, { ...base, phase, screen: 'compliance' }));
  render(createElement(ImportView, { ...base, phase, screen: 'import' }));
  render(createElement(VehicleDetailView, { ...base, phase, screen: 'vehicle', subjectId: 'missing' }));
  render(createElement(DriverDetailView, { ...base, phase, screen: 'driver', subjectId: 'missing' }));
}
const sample = sampleFleetBook();
render(createElement(ComplianceView, { ...base, book: sample, screen: 'compliance', illustrate: true }));
render(createElement(ImportView, { ...base, book: sample, screen: 'import', illustrate: true }));
render(createElement(VehicleDetailView, { ...base, book: sample, screen: 'vehicle', subjectId: 'sample-01', illustrate: true }));
render(createElement(DriverDetailView, { ...base, book: sample, screen: 'driver', subjectId: 'driver-a', illustrate: true }));
render(createElement(RemindersPanel, { ...base, book: sample, screen: 'settings' }));
const emptyHtml = render(createElement(ComplianceView, { ...base, screen: 'compliance' }));
assert.match(emptyHtml, /Add your first licence disc date/);

console.log('brief115-compliance-centre.test.ts ok');
