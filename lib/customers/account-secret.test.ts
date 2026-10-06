import assert from 'node:assert/strict';
import { openAccountNumber, sealAccountNumber, isSealedAccount } from './account-secret';

process.env.CREDIT_ACCOUNT_KEY = 'test-credit-key';

const sealed = sealAccountNumber('1234567890');
assert.equal(isSealedAccount(sealed), true);
assert.equal(sealed.includes('1234567890'), false);
assert.equal(openAccountNumber(sealed), '1234567890');
assert.equal(openAccountNumber('12-34 56'), '123456');
assert.equal(openAccountNumber(''), '');
assert.notEqual(sealAccountNumber('1234567890'), sealed);

console.log('account-secret.test.ts ok');
