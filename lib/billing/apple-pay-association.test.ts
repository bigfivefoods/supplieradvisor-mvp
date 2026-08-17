/**
 * Run: npx --yes tsx lib/billing/apple-pay-association.test.ts
 */
import assert from 'node:assert/strict';
import { APPLE_PAY_DOMAIN_ASSOCIATION_BODY } from './apple-pay-domain-association';
import {
  decodeAssociationPayload,
  parseBrokerCertExpiry,
} from './apple-pay-status';

const body = APPLE_PAY_DOMAIN_ASSOCIATION_BODY;
assert.match(body, /^7[Bb]22/);
assert.equal(body.length % 2, 0);
assert.equal(body.endsWith('\n'), false);

const decoded = decodeAssociationPayload(body);
assert.ok(decoded.startsWith('{"pspId"'));
const j = JSON.parse(decoded) as { pspId?: string; signature?: string };
assert.equal(
  j.pspId,
  '4BE8DFE7C705DD585139674DF649F2B7DF89B44591CC26245B848EB2586E087B'
);
assert.ok(String(j.signature || '').length > 100);

const cert = parseBrokerCertExpiry(body);
assert.ok(cert.note);

console.log('apple-pay-association.test.ts ok');
