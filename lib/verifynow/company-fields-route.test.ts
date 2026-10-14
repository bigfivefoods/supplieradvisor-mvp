/**
 * Route-auth wiring for company-profile VerifyNow checks.
 * Handlers stay unimported here so the check runs without a Next server.
 * Run: npx --yes tsx lib/verifynow/company-fields-route.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const fields = read('app/api/business/verifynow/fields/route.ts');
const runner = read('lib/verifynow/run-paid-field-check.ts');
const webhook = read('app/api/webhooks/verifynow/route.ts');
const paystackWebhook = read('app/api/paystack/webhook/route.ts');
const client = read('lib/verifynow/client.ts');
const ui = read('components/business/CompanyFieldVerify.tsx');

assert.match(fields, /requireCompanyPermission\(/);
assert.match(
  fields,
  /requireCompanyPermission\(request, companyId, 'verification', 'view'/
);
assert.match(
  fields,
  /requireCompanyPermission\(request, companyId, 'verification', 'admin'/
);
assert.match(fields, /rateLimit\(`verifynow-fields:/);
assert.match(fields, /body\.consent !== true/);
assert.match(fields, /VERIFYNOW_API_KEY is not configured/);
assert.equal(fields.includes('NEXT_PUBLIC_VERIFYNOW'), false);

const signatureAt = webhook.indexOf('verifyWebhookSignature(');
const supabaseAt = webhook.indexOf('getSupabaseServer(');
assert.ok(signatureAt > 0, 'webhook must verify the signature');
assert.ok(supabaseAt > signatureAt, 'signature check must run before any database read');
assert.match(webhook, /status: 401/);
assert.match(webhook, /VERIFYNOW_WEBHOOK_SECRET/);

assert.match(client, /'x-api-key': apiKey/);
assert.match(client, /'Idempotency-Key': key/);
assert.match(client, /reportType: 'cipc_company_match'/);
assert.match(client, /reportType: 'cipc_director_search'/);
assert.match(client, /'\/aml-screening'/);
assert.match(client, /'\/business-bank-account-verification'/);
assert.equal(client.includes('NEXT_PUBLIC_'), false);

assert.match(fields, /fulfillPaidFieldCheck\(/);
assert.match(fields, /paystackReference/);
assert.match(runner, /verifyPaystackTransaction\(/);
assert.match(runner, /refundPaystackTransaction\(/);
const verifyAt = runner.indexOf('verifyPaystackTransaction(');
const providerAt = runner.indexOf('callVerifyNowCipcCompany(');
assert.ok(verifyAt > 0 && providerAt > verifyAt, 'Paystack verify must run before VerifyNow');
assert.match(runner, /paystack_reference: receipt.reference/);

const fieldChargeAt = paystackWebhook.indexOf('isFieldCheckCharge(');
const cipcChargeAt = paystackWebhook.indexOf('isCipcVerificationCharge(');
assert.ok(fieldChargeAt > 0 && cipcChargeAt > fieldChargeAt, 'field checks must be handled before CIPC');
assert.match(paystackWebhook, /CUSTOMER_PRICES.cipc_company_match.cents/);

assert.match(ui, /openPaystackCheckout\(/);
assert.match(ui, /VAT inclusive/);
assert.match(ui, /buildFieldCheckReference\(/);
assert.equal(ui.includes('excl. VAT'), false);
assert.equal(ui.includes('VERIFYNOW_API_KEY'), false);

console.log('company-fields-route.test.ts ok');
