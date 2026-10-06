/**
 * Run: npx --yes tsx lib/credit/brief79-crypto.test.ts
 */
import assert from 'node:assert/strict';
import { assertCreditEncryptionReady, decryptField, encryptField } from '@/lib/credit/crypto';

const oldKey = process.env.CREDIT_APP_ENCRYPTION_KEY;
const oldNodeEnv = process.env.NODE_ENV;

process.env.CREDIT_APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const plain = '1234567890';
const enc = encryptField(plain);
assert.ok(enc.startsWith('v1.'), 'encrypted payload should be versioned');
assert.equal(decryptField(enc), plain, 'decrypt should recover original value');

const tampered = `${enc.slice(0, -2)}ab`;
assert.throws(() => decryptField(tampered), /invalid|auth|state|CREDIT_ENCRYPTION_PAYLOAD_INVALID/i, 'tamper should fail');

process.env.CREDIT_APP_ENCRYPTION_KEY = '';
process.env.NODE_ENV = 'production';
const missing = assertCreditEncryptionReady();
assert.equal(missing.ok, false, 'missing key should fail in production');
if (!missing.ok) {
  assert.equal(missing.status, 503);
  assert.equal(missing.code, 'CREDIT_ENCRYPTION_NOT_CONFIGURED');
}

process.env.CREDIT_APP_ENCRYPTION_KEY = oldKey;
process.env.NODE_ENV = oldNodeEnv;

console.log('brief79-crypto.test.ts ok');
