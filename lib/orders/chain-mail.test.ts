/**
 * Run: npx --yes tsx lib/orders/chain-mail.test.ts
 */
import assert from 'node:assert/strict';
import { chainPoSubject, chainProductionSubject } from './chain-mail-copy';
import { customerVisibleProductionStatus } from './order-links';
import { safeFilterEmails } from '../security/email-filter';

const po = chainPoSubject('Big Five Foods', 'PO-1042');
assert.equal(po, 'Big Five Foods sent you purchase order PO-1042');
assert.equal(po.includes('Boxer'), false);
assert.equal(po.toLowerCase().includes('kelpac'), false);

const prod = chainProductionSubject(
  'Big Five Foods',
  'SO-88',
  customerVisibleProductionStatus('in_progress')
);
assert.equal(
  prod,
  'Big Five Foods updated your order SO-88 — In production'
);
assert.equal(prod.includes('Boxer'), false);
assert.equal(prod.toLowerCase().includes('kelpac'), false);
assert.equal(customerVisibleProductionStatus('released'), 'Scheduled');
assert.equal(customerVisibleProductionStatus('completed'), 'Produced');

assert.deepEqual(
  safeFilterEmails([
    'ops@kelpac.com',
    'OPS@kelpac.com',
    'not-an-email',
    null,
    'buyer@boxer.co.za',
  ]),
  ['ops@kelpac.com', 'buyer@boxer.co.za']
);

console.log('chain-mail.test.ts ok');
