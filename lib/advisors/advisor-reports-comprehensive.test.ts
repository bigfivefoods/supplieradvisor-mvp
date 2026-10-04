/**
 * Comprehensive advisor reports: tabs, expandable sections, graph above lists.
 * Run: npx --yes tsx lib/advisors/advisor-reports-comprehensive.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chartFromTableColumn } from './management-report';

const chart = chartFromTableColumn(
  {
    title: 'Coaches',
    headers: ['Coach', 'Sessions', 'Attended'],
    rows: [
      ['Ada', 12, 40],
      ['Ben', 8, 22],
      ['Cara', 3, 9],
    ],
  },
  { id: 'coaches_chart', type: 'horizontal_bar', valueCol: 1 }
);
assert.ok(chart);
assert.equal(chart!.id, 'coaches_chart');
assert.equal(chart!.type, 'horizontal_bar');
assert.equal(chart!.series[0].label, 'Ada');
assert.equal(chart!.series[0].value, 12);

const empty = chartFromTableColumn({
  title: 'Empty',
  headers: ['Name', 'Notes'],
  rows: [['Ada', 'ok']],
});
assert.equal(empty, undefined);

const panel = readFileSync(
  resolve('components/advisors/ManagementReportPanel.tsx'),
  'utf8'
);
assert.match(panel, /ManagementReportSectionCard/);
assert.match(panel, /aria-label="Report tabs"/);
assert.match(panel, /s\.tab === tab/);

const section = readFileSync(
  resolve('components/advisors/ManagementReportSectionCard.tsx'),
  'utf8'
);
assert.match(section, /ManagementChartCard/);
assert.match(section, /aria-expanded/);
assert.match(section, /Search this list/);

const gym = readFileSync(
  resolve('app/dashboard/fitgraph/report/page.tsx'),
  'utf8'
);
assert.match(gym, /sessionStatus/);
assert.match(gym, /specialty/);

for (const id of [
  'physiograph',
  'dentalgraph',
  'psychiatrygraph',
  'medicalgraph',
  'vetgraph',
]) {
  const page = readFileSync(
    resolve(`app/dashboard/${id}/report/page.tsx`),
    'utf8'
  );
  assert.match(page, /CLINIC_REPORT_STATUS_DIM/, id);
  assert.match(page, /serviceId/, id);
}

console.log('advisor-reports-comprehensive.test.ts ok');
