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
const webhook = read('app/api/webhooks/verifynow/route.ts');
const client = read('lib/verifynow/client.ts');

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

console.log('company-fields-route.test.ts ok');
