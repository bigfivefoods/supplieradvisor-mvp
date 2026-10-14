/**
 * Pay-then-verify rules for company-profile VerifyNow checks.
 * Run: npx --yes tsx lib/verifynow/pay-then-check.test.ts
 */
import assert from 'node:assert/strict';
import { fieldIdempotencyKey } from './company-checks';
import { refundPaystackTransaction } from '@/lib/billing/paystack';
import {
  buildFieldCheckReference,
  canRefundPayment,
  chargeMatchesPrice,
  decidePaidCheck,
  isFieldCheckCharge,
  parseFieldCheckReference,
  paymentAlreadyConsumed,
  readChargeMeta,
} from './pay-then-check';
import { bundleListZar, customerPriceFor, CUSTOMER_PRICES, formatCustomerZar } from './prices';

assert.equal(CUSTOMER_PRICES.cipc_company_match.zar, 69);
assert.equal(CUSTOMER_PRICES.cipc_company_match.cents, 6900);
assert.equal(CUSTOMER_PRICES.cipc_director_search.zar, 69);
assert.equal(CUSTOMER_PRICES.said_verification.zar, 15);
assert.equal(CUSTOMER_PRICES.aml_pep.zar, 15);
assert.equal(CUSTOMER_PRICES.bank_account.zar, 50);
assert.equal(CUSTOMER_PRICES.bank_account.cents, 5000);
assert.equal(CUSTOMER_PRICES.business_bank_account.zar, 55);
assert.equal(customerPriceFor('supplier_bundle', false).zar, 169);
assert.equal(customerPriceFor('supplier_bundle', false).cents, 16900);
assert.equal(customerPriceFor('supplier_bundle', true).zar, 179);
assert.equal(customerPriceFor('bank_account', true).zar, 55);
assert.equal(customerPriceFor('bank_account', false).zar, 50);
assert.equal(bundleListZar(false), 203);
assert.equal(bundleListZar(true), 208);
assert.equal(CUSTOMER_PRICES.supplier_bundle.listZar, bundleListZar(false));
assert.equal(CUSTOMER_PRICES.supplier_bundle_capitec.listZar, bundleListZar(true));
assert.ok(CUSTOMER_PRICES.supplier_bundle.zar < bundleListZar(false));
assert.equal(formatCustomerZar(69), 'R69');
assert.equal(CUSTOMER_PRICES.cipc_company_match.vatInclusive, true);

const ref = buildFieldCheckReference('cipc_director_search', 42, 123);
assert.equal(ref, 'sa-vn-cipc_director_search-42-123');
assert.deepEqual(parseFieldCheckReference(ref), {
  check: 'cipc_director_search',
  companyId: 42,
  nonce: '123',
});
assert.equal(parseFieldCheckReference('sa-verify-42-123'), null);
assert.equal(isFieldCheckCharge({ reference: 'sa-verify-42-123' }), false);
assert.equal(isFieldCheckCharge({ reference: ref }), true);
assert.equal(chargeMatchesPrice(6900, 6900), true);
assert.equal(chargeMatchesPrice(6899, 6900), false);

const paid = {
  status: 'match',
  paystack_reference: ref,
  payment_status: 'paid' as const,
  idempotency_key: 'sa-stored',
  provider_attempted: true,
};
assert.equal(paymentAlreadyConsumed(paid, ref), true);
assert.equal(
  decidePaidCheck({
    intent: 'run',
    reference: ref,
    companyId: 42,
    check: 'cipc_director_search',
    asyncBank: false,
    paidAmountCents: 1,
    existing: paid,
    freshIdempotencyKey: 'sa-new',
  }).action,
  'replay'
);

const retry = decidePaidCheck({
  intent: 'run',
  reference: ref,
  companyId: 42,
  check: 'cipc_director_search',
  asyncBank: false,
  paidAmountCents: 6900,
  existing: { ...paid, status: 'error' },
  freshIdempotencyKey: 'sa-stored',
});
assert.equal(retry.action, 'retry');
if (retry.action === 'retry') assert.equal(retry.idempotencyKey, 'sa-stored');

const drifted = decidePaidCheck({
  intent: 'run',
  reference: ref,
  companyId: 42,
  check: 'cipc_director_search',
  asyncBank: false,
  paidAmountCents: 6900,
  existing: { ...paid, status: 'error' },
  freshIdempotencyKey: 'sa-other',
});
assert.equal(drifted.action, 'reject');
if (drifted.action === 'reject') assert.equal(drifted.httpStatus, 409);

const again = decidePaidCheck({
  intent: 'run',
  reference: 'sa-vn-cipc_director_search-42-999',
  companyId: 42,
  check: 'cipc_director_search',
  asyncBank: false,
  paidAmountCents: 6900,
  existing: paid,
  freshIdempotencyKey: 'sa-second-payment',
});
assert.equal(again.action, 'run');
if (again.action === 'run') assert.equal(again.idempotencyKey, 'sa-second-payment');

assert.equal(canRefundPayment({ ...paid, status: 'mismatch' }, ref), false);
assert.equal(canRefundPayment({ ...paid, status: 'error' }, ref), true);
assert.equal(
  decidePaidCheck({
    intent: 'refund',
    reference: ref,
    companyId: 42,
    check: 'cipc_director_search',
    asyncBank: false,
    paidAmountCents: null,
    existing: { ...paid, status: 'error' },
    freshIdempotencyKey: 'sa-stored',
  }).action,
  'refund'
);
assert.equal(
  decidePaidCheck({
    intent: 'refund',
    reference: ref,
    companyId: 42,
    check: 'cipc_director_search',
    asyncBank: false,
    paidAmountCents: null,
    existing: paid,
    freshIdempotencyKey: 'sa-stored',
  }).action,
  'reject'
);

const refunded = decidePaidCheck({
  intent: 'run',
  reference: ref,
  companyId: 42,
  check: 'cipc_director_search',
  asyncBank: false,
  paidAmountCents: 6900,
  existing: { ...paid, status: 'error', payment_status: 'refunded' },
  freshIdempotencyKey: 'sa-stored',
});
assert.equal(refunded.action, 'reject');
if (refunded.action === 'reject') assert.equal(refunded.httpStatus, 409);

const unpaid = decidePaidCheck({
  intent: 'run',
  reference: '',
  companyId: 42,
  check: 'aml_pep',
  asyncBank: false,
  paidAmountCents: null,
  existing: null,
  freshIdempotencyKey: 'sa-none',
});
assert.equal(unpaid.action, 'reject');
if (unpaid.action === 'reject') assert.equal(unpaid.httpStatus, 402);

assert.equal(
  paymentAlreadyConsumed({ ...paid, status: 'pending' }, ref),
  true
);
assert.equal(paymentAlreadyConsumed({ ...paid, status: 'failed' }, ref), true);

const samePayment = fieldIdempotencyKey([ref, 'production', 'aml_pep', '8001015009087']);
const otherPayment = fieldIdempotencyKey([
  'sa-vn-aml_pep-42-2',
  'production',
  'aml_pep',
  '8001015009087',
]);
assert.notEqual(samePayment, otherPayment);
assert.equal(samePayment, fieldIdempotencyKey([ref, 'production', 'aml_pep', '8001015009087']));

const meta = readChargeMeta({
  metadata: {
    purpose: 'supplier_field_check',
    custom_fields: [{ variable_name: 'check_purpose', value: 'Supplier due diligence for onboarding' }],
  },
});
assert.equal(meta.purpose, 'supplier_field_check');
assert.equal(meta.check_purpose, 'Supplier due diligence for onboarding');
assert.equal(meta.purpose.includes('verifynow'), false);

const previousKey = process.env.PAYSTACK_SECRET_KEY;
process.env.PAYSTACK_SECRET_KEY = 'sk_test_field_check';
const originalFetch = global.fetch;
global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  assert.equal(String(input), 'https://api.paystack.co/refund');
  assert.match(String(init?.body || ''), /sa-vn-aml_pep-7-9/);
  assert.equal(init?.method, 'POST');
  return new Response(JSON.stringify({ status: true, data: { status: 'processed' } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}) as typeof fetch;

void refundPaystackTransaction('sa-vn-aml_pep-7-9').then((refundedPayment) => {
  global.fetch = originalFetch;
  if (previousKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
  else process.env.PAYSTACK_SECRET_KEY = previousKey;
  assert.equal(refundedPayment.ok, true);
  if (refundedPayment.ok) assert.equal(refundedPayment.status, 'processed');
  console.log('pay-then-check.test.ts ok');
});
