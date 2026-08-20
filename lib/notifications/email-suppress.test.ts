/**
 * Run: npx --yes tsx lib/notifications/email-suppress.test.ts
 */
import assert from 'node:assert/strict';
import {
  isVukaNotificationSuppressed,
  VUKA_EMAIL_SUPPRESS_COMPANY_ID,
  vukaNotificationEmailsAllowed,
} from './email-suppress';

const prevAllow = process.env.EMAIL_ALLOW_VUKA;
delete process.env.EMAIL_ALLOW_VUKA;

assert.equal(VUKA_EMAIL_SUPPRESS_COMPANY_ID, 110);
assert.equal(vukaNotificationEmailsAllowed(), false);

assert.equal(
  isVukaNotificationSuppressed({ companyId: 110 }),
  true
);
assert.equal(
  isVukaNotificationSuppressed({
    tags: [{ name: 'company_id', value: '110' }],
  }),
  true
);
assert.equal(
  isVukaNotificationSuppressed({ companyName: 'VUKA Fitness' }),
  true
);
assert.equal(
  isVukaNotificationSuppressed({
    from: 'VUKA Fitness <hello@supplieradvisor.com>',
  }),
  true
);
assert.equal(
  isVukaNotificationSuppressed({
    html: '<p>Train with VUKA Fitness on GymAdvisor</p>',
  }),
  true
);
assert.equal(
  isVukaNotificationSuppressed({
    companyId: 999,
    companyName: 'Other Gym',
    subject: 'Invoice ready',
    html: '<p>Hello</p>',
  }),
  false
);

process.env.EMAIL_ALLOW_VUKA = 'true';
assert.equal(isVukaNotificationSuppressed({ companyId: 110 }), false);
if (prevAllow == null) delete process.env.EMAIL_ALLOW_VUKA;
else process.env.EMAIL_ALLOW_VUKA = prevAllow;

console.log('email-suppress.test.ts ok');
