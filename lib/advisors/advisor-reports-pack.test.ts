/**
 * Advisor Reports: nav label + one slicer then full pack.
 * Run: npx --yes tsx lib/advisors/advisor-reports-pack.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODULE_NAV } from '../chrome/module-nav';

const ids = [
  'fitgraph',
  'physiograph',
  'dentalgraph',
  'psychiatrygraph',
  'medicalgraph',
  'vetgraph',
];
for (const id of ids) {
  const mod = MODULE_NAV.find((m) => m.id === id);
  assert.ok(mod, id);
  const step = mod!.steps.find((s) => s.href.endsWith('/management'));
  assert.ok(step, `${id} reports step`);
  assert.equal(step!.name, 'Reports');
  assert.equal(step!.section, 'Insights');
}

const panel = readFileSync(
  resolve('components/advisors/ManagementReportPanel.tsx'),
  'utf8'
);
assert.match(panel, /Reports/);
assert.match(panel, /Slice & dice/);
assert.match(panel, /Report pack/);
assert.doesNotMatch(panel, /availableSlices/);

const gymPage = readFileSync(
  resolve('app/dashboard/fitgraph/report/page.tsx'),
  'utf8'
);
assert.match(gymPage, /title="Reports"/);
assert.doesNotMatch(gymPage, /Slice filters/);

const build = readFileSync(
  resolve('lib/advisors/management-report-build.ts'),
  'utf8'
);
assert.match(build, /daily_sessions/);
assert.match(build, /daily_appts/);
assert.match(build, /People · coaches/);
assert.match(build, /People · practitioner load/);

console.log('advisor-reports-pack.test.ts ok');
