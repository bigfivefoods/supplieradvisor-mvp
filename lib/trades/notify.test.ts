/**
 * Run: npx --yes tsx lib/trades/notify.test.ts
 */
import assert from 'node:assert/strict';
import { sendTradeEmail, sendTradePush, tradeNotifyConfig, TRADE_EMAIL_ENV, TRADE_PUSH_ENV } from './notify';

async function main() {
const previous = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
};

delete process.env.RESEND_API_KEY;
delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;

const skipped = await sendTradeEmail({
  to: 'customer@example.com',
  subject: 'Job',
  html: '<p>Hi</p>',
  text: 'Hi',
});
assert.equal(skipped, 'skipped');
assert.equal(await sendTradePush([], { title: 'Job', body: 'Updated' }), 0);
assert.equal(await sendTradePush([{ endpoint: 'https://push.example/1', p256dh: 'k', auth: 'a' }], { title: 'Job', body: 'Updated' }), 0);

const config = tradeNotifyConfig();
assert.equal(config.email, false);
assert.equal(config.push, false);
assert.deepEqual(config.missing, [...TRADE_EMAIL_ENV, ...TRADE_PUSH_ENV]);

if (previous.RESEND_API_KEY) process.env.RESEND_API_KEY = previous.RESEND_API_KEY;
if (previous.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = previous.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
}
if (previous.VAPID_PRIVATE_KEY) process.env.VAPID_PRIVATE_KEY = previous.VAPID_PRIVATE_KEY;

console.log('notify.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
