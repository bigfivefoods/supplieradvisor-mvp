/**
 * Big Five Group shop relay on the SupplierAdvisor® Paystack webhook.
 * Run: npx --yes tsx lib/billing/bfg-shop-webhook.test.ts
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/paystack/webhook/route';
import {
  BFG_SHOP_WEBHOOK_TIMEOUT_MS,
  BFG_SHOP_WEBHOOK_URL,
  bfgShopWebhookUrl,
  isBfgShopReference,
} from './bfg-shop-webhook';

const SECRET = 'sk_test_bfg_shop_forward_unit';

const ENV_KEYS = [
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_SECRET',
  'PAYSTACK_LIVE_SECRET_KEY',
  'BFG_SHOP_WEBHOOK_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

type FetchCall = {
  url: string;
  method: string;
  body: unknown;
  contentType: string | null;
  signature: string | null;
  redirect: RequestRedirect | undefined;
  hasSignal: boolean;
};

const savedEnv = new Map<string, string | undefined>();
const originalFetch = globalThis.fetch;
const originalError = console.error;
const originalWarn = console.warn;
const logs: string[] = [];
const warns: string[] = [];
let calls: FetchCall[] = [];

function sign(raw: string): string {
  return createHmac('sha512', SECRET).update(raw).digest('hex');
}

function stringifyLog(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function installEnv(): void {
  for (const key of ENV_KEYS) {
    if (!savedEnv.has(key)) savedEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  process.env.PAYSTACK_SECRET_KEY = SECRET;
}

function restoreEnv(): void {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function installFetch(
  handler: (url: string, init: RequestInit | undefined) => Response | Promise<Response>
): void {
  calls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      method: String(init?.method || 'GET'),
      body: init?.body,
      contentType: headers.get('content-type'),
      signature: headers.get('x-paystack-signature'),
      redirect: init?.redirect,
      hasSignal: Boolean(init?.signal),
    });
    return handler(url, init);
  }) as typeof fetch;
}

function post(raw: string, signature: string | null) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (signature !== null) headers.set('x-paystack-signature', signature);
  return POST(
    new NextRequest('https://www.supplieradvisor.com/api/paystack/webhook', {
      method: 'POST',
      headers,
      body: raw,
    })
  );
}

function joinedLogs(): string {
  return logs.join('\n');
}

async function main(): Promise<void> {
  installEnv();
  console.error = (...args: unknown[]) => {
    logs.push(args.map(stringifyLog).join(' '));
  };
  console.warn = (...args: unknown[]) => {
    warns.push(args.map(stringifyLog).join(' '));
  };

  assert.equal(
    BFG_SHOP_WEBHOOK_TIMEOUT_MS >= 8_000 && BFG_SHOP_WEBHOOK_TIMEOUT_MS <= 10_000,
    true
  );
  assert.equal(bfgShopWebhookUrl(), BFG_SHOP_WEBHOOK_URL);
  assert.equal(isBfgShopReference('bfg-shop-1'), true);
  assert.equal(isBfgShopReference('bfg-shop-'), true);
  assert.equal(isBfgShopReference('bfg-shop'), false);
  assert.equal(isBfgShopReference('BFG-SHOP-1'), false);
  assert.equal(isBfgShopReference(' bfg-shop-1'), false);
  assert.equal(isBfgShopReference(123), false);
  assert.equal(isBfgShopReference(null), false);

  const chargeRaw =
    '{\n  "event": "charge.success",\n  "data": {\n    "reference": "bfg-shop-sub-1001",\n    "authorization": {"authorization_code": "AUTH_test"},\n    "amount": 25000\n  }\n}\n';
  assert.notEqual(JSON.stringify(JSON.parse(chargeRaw)), chargeRaw);
  const chargeSig = sign(chargeRaw);
  const warnsBeforeCharge = warns.length;

  installFetch(() => new Response('{"received":true}', { status: 200 }));
  const chargeRes = await post(chargeRaw, chargeSig);
  assert.equal(chargeRes.status, 200);
  assert.match(chargeRes.headers.get('cache-control') || '', /no-store/);
  assert.deepEqual(await chargeRes.json(), {
    received: true,
    forwarded: 'bfg_shop',
    reference: 'bfg-shop-sub-1001',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, BFG_SHOP_WEBHOOK_URL);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].body, chargeRaw);
  assert.equal(typeof calls[0].body, 'string');
  assert.equal(calls[0].contentType, 'application/json');
  assert.equal(calls[0].signature, chargeSig);
  assert.equal(calls[0].hasSignal, true);
  assert.equal(calls[0].redirect, 'manual');
  assert.equal(
    warns.slice(warnsBeforeCharge).some((line) => line.includes('claimPaystackWebhook')),
    false
  );

  const invoiceRaw =
    '{"event":"invoice.update","data":{"reference":"bfg-shop-inv-9","status":"success"}}';
  const invoiceSig = sign(invoiceRaw);
  process.env.BFG_SHOP_WEBHOOK_URL = '  https://shop.test/api/paystack/webhook  ';
  installFetch(() => new Response(null, { status: 204 }));
  const invoiceRes = await post(invoiceRaw, invoiceSig);
  assert.equal(invoiceRes.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://shop.test/api/paystack/webhook');
  assert.equal(calls[0].body, invoiceRaw);
  assert.equal(calls[0].signature, invoiceSig);
  delete process.env.BFG_SHOP_WEBHOOK_URL;
  assert.equal(bfgShopWebhookUrl(), BFG_SHOP_WEBHOOK_URL);

  const saRaw =
    '{"event":"charge.success","data":{"reference":"sa-verify-12-1700000000","metadata":{"purpose":"verifynow_company_verification"}}}';
  installFetch(() => {
    throw new Error('shop forward must not run for a SupplierAdvisor reference');
  });
  const saRes = await post(saRaw, sign(saRaw));
  assert.equal(saRes.status, 503);
  const saBody = (await saRes.json()) as {
    code?: string;
    reference?: string;
    reason?: string;
  };
  assert.equal(saBody.code, 'WEBHOOK_CLAIM_UNAVAILABLE');
  assert.equal(saBody.reference, 'sa-verify-12-1700000000');
  assert.equal(
    saBody.reason,
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  );
  assert.equal(calls.length, 0);
  assert.equal(
    warns.some((line) => line.includes('claimPaystackWebhook')),
    true
  );

  const nestedRaw =
    '{"event":"charge.success","data":{"reference":"sa-order-4","transaction_reference":"bfg-shop-not-top-level"}}';
  installFetch(() => {
    throw new Error('transaction_reference must not select the shop relay');
  });
  const nestedRes = await post(nestedRaw, sign(nestedRaw));
  assert.equal(nestedRes.status, 503);
  const nestedBody = (await nestedRes.json()) as { reference?: string };
  assert.equal(nestedBody.reference, 'sa-order-4');
  assert.equal(calls.length, 0);

  const shopRaw =
    '{"event":"charge.success","data":{"reference":"bfg-shop-order-44"}}';
  const shopSig = sign(shopRaw);
  installFetch(() => {
    throw new Error('invalid signature must not forward');
  });
  const badRes = await post(shopRaw, 'not-the-signature');
  assert.equal(badRes.status, 401);
  assert.deepEqual(await badRes.json(), { error: 'Invalid signature' });
  assert.equal(calls.length, 0);

  const missingSig = await post(shopRaw, null);
  assert.equal(missingSig.status, 401);
  assert.equal(calls.length, 0);

  logs.length = 0;
  installFetch(() => new Response('upstream failed', { status: 500 }));
  const httpFail = await post(shopRaw, shopSig);
  assert.equal(httpFail.status, 502);
  assert.equal(httpFail.headers.get('retry-after'), '30');
  assert.deepEqual(await httpFail.json(), {
    error: 'Shop webhook forward failed',
    code: 'BFG_SHOP_FORWARD_FAILED',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body, shopRaw);
  assert.equal(calls[0].signature, shopSig);
  const httpLog = joinedLogs();
  assert.match(httpLog, /non_2xx/);
  assert.match(httpLog, /"status":500/);
  assert.match(httpLog, /bfg-shop-order-44/);
  assert.equal(httpLog.includes('upstream failed'), false);
  assert.equal(httpLog.includes(SECRET), false);
  assert.equal(httpLog.includes(shopSig), false);
  assert.equal(httpLog.includes(shopRaw), false);

  logs.length = 0;
  installFetch(() => {
    throw new Error(`connect failed ${SECRET} ${shopSig}`);
  });
  const netFail = await post(shopRaw, shopSig);
  assert.equal(netFail.status, 502);
  assert.equal(calls.length, 1);
  const netLog = joinedLogs();
  assert.match(netLog, /network_error/);
  assert.match(netLog, /"error":"Error"/);
  assert.match(netLog, /bfg-shop-order-44/);
  assert.equal(netLog.includes(SECRET), false);
  assert.equal(netLog.includes(shopSig), false);
  assert.equal(netLog.includes('connect failed'), false);
  const netBody = (await netFail.json()) as { error?: string };
  assert.equal(netBody.error, 'Shop webhook forward failed');
  assert.equal(String(netBody.error).includes(SECRET), false);

  logs.length = 0;
  installFetch(() => new Response('go away', { status: 302 }));
  const redirectFail = await post(shopRaw, shopSig);
  assert.equal(redirectFail.status, 502);
  const redirectLog = joinedLogs();
  assert.match(redirectLog, /non_2xx/);
  assert.match(redirectLog, /"status":302/);
  assert.equal(redirectLog.includes(SECRET), false);
  assert.equal(redirectLog.includes(shopSig), false);

  const invalidPayload = '{';
  installFetch(() => {
    throw new Error('invalid payload must not forward');
  });
  const invalidRes = await post(invalidPayload, sign(invalidPayload));
  assert.equal(invalidRes.status, 400);
  assert.deepEqual(await invalidRes.json(), { error: 'Invalid payload' });
  assert.equal(calls.length, 0);

  console.log('bfg-shop webhook tests passed');
}

main()
  .catch((err: unknown) => {
    console.error = originalError;
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    console.error = originalError;
    console.warn = originalWarn;
    globalThis.fetch = originalFetch;
    restoreEnv();
  });
