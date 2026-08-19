/**
 * Run: npx --yes tsx lib/advisors/system-overview.test.ts
 */
import assert from 'node:assert/strict';
import {
  advisorSystemOverview,
  advisorSystemOverviewFilename,
  parseAdvisorOverviewModule,
} from './system-overview';
import { buildAdvisorSystemOverviewPdf } from './system-overview-pdf';

assert.equal(parseAdvisorOverviewModule('medicalgraph'), 'medicalgraph');
assert.equal(parseAdvisorOverviewModule('nope'), null);

const medical = advisorSystemOverview('medicalgraph');
assert.ok(medical.core.length >= 4);
assert.ok(medical.advisor.length >= 4);
assert.ok(medical.clients.length >= 4);
assert.ok(medical.enhance.length === 4);
assert.match(medical.headline, /MedicalAdvisor/);
assert.match(advisorSystemOverviewFilename('medicalgraph'), /MedicalAdvisor-System-Overview-A4\.pdf/);

const gym = advisorSystemOverview('fitgraph');
assert.match(gym.headline, /GymAdvisor/);
assert.equal(gym.clientNoun, 'members');

async function main() {
  const buf = await buildAdvisorSystemOverviewPdf('medicalgraph');
  assert.ok(buf.length > 2_000);
  assert.equal(buf.subarray(0, 4).toString(), '%PDF');

  const buf2 = await buildAdvisorSystemOverviewPdf('retailgraph');
  assert.ok(buf2.length > 2_000);

  console.log('system-overview.test.ts ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
