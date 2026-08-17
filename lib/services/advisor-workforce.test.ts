/**
 * Run: npx --yes tsx lib/services/advisor-workforce.test.ts
 */
import assert from 'node:assert/strict';
import {
  accessLaneForEngagement,
  isAdvisorWorkforceModule,
  parseAdvisorWorkInviteToken,
  resolveAdvisorEngagement,
  issueAdvisorWorkInviteToken,
  buildAdvisorWorkPortalPath,
} from './advisor-workforce';

assert.equal(accessLaneForEngagement('employed'), 'b2b');
assert.equal(accessLaneForEngagement('contractor'), 'b2c');
assert.equal(resolveAdvisorEngagement({}), 'contractor');
assert.equal(resolveAdvisorEngagement({ hr_employee_id: 9 }), 'employed');
assert.equal(
  resolveAdvisorEngagement({ engagement: 'employed' }),
  'employed'
);
assert.equal(
  resolveAdvisorEngagement({ employment_type: 'full_time' }),
  'employed'
);
assert.equal(
  resolveAdvisorEngagement({ engagement: 'contractor', hr_employee_id: 1 }),
  'contractor'
);

assert.equal(isAdvisorWorkforceModule('fitgraph'), true);
assert.equal(isAdvisorWorkforceModule('nope'), false);

const tok = issueAdvisorWorkInviteToken('fitgraph', 42);
const parsed = parseAdvisorWorkInviteToken(tok);
assert.equal(parsed.module, 'fitgraph');
assert.equal(parsed.companyId, 42);

assert.ok(
  buildAdvisorWorkPortalPath('fitgraph', 'abc').startsWith('/coach/fitgraph/')
);
assert.ok(
  buildAdvisorWorkPortalPath('physiograph', 'abc').startsWith(
    '/clinician/physiograph/'
  )
);

console.log('advisor-workforce.test.ts ok');
