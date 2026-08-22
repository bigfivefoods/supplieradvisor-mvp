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
  advisorWorkInviteShareText,
} from './advisor-workforce';
import {
  canAppearInCompanySwitcher,
  canOpenCompanyWorkspace,
} from '@/lib/business/permissions';

assert.equal(accessLaneForEngagement('employed'), 'b2c');
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

const wa = advisorWorkInviteShareText({
  personName: 'Sam Coach',
  businessName: 'Vuka',
  inviteLink: 'https://example.com/join',
  lane: 'b2c',
  roleLabel: 'Coach',
});
assert.match(wa, /Sam/);
assert.match(wa, /Vuka/);
assert.match(wa, /https:\/\/example.com\/join/);
assert.match(wa, /work app/);

assert.equal(canOpenCompanyWorkspace('owner'), true);
assert.equal(canOpenCompanyWorkspace('admin'), false);
assert.equal(canOpenCompanyWorkspace('operations'), false);
assert.equal(canOpenCompanyWorkspace('member'), false);
assert.equal(canAppearInCompanySwitcher('owner'), true);
assert.equal(canAppearInCompanySwitcher('admin'), true);
assert.equal(canAppearInCompanySwitcher('finance'), true);
assert.equal(canAppearInCompanySwitcher('operations'), false);
assert.equal(canAppearInCompanySwitcher('sales_contractor'), true);

console.log('advisor-workforce.test.ts ok');
