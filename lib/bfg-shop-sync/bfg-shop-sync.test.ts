/**
 * Run: npx --yes tsx lib/bfg-shop-sync/bfg-shop-sync.test.ts
 * Mocks only: in-memory store and books. No database, no network.
 */
import assert from 'node:assert/strict';
import { createFakePorts, FakeDb } from './fakes';
import { processSyncRequest, type SyncHttpRequest } from './process';
import { readSyncConfig, type SyncConfig } from './config';
import { REQUEST_SIGNING_PREFIX, CALLBACK_SIGNING_PREFIX, signBfgPayload, verifyBfgSyncSignature } from './signature';
import { totalsInvariantFailures } from './money';
import {
  buildPaymentRecordedBody,
  callbackBackoffMs,
  drainCallbacks,
  sendCallback,
  shouldFlowBack,
  type CallbackOutbox,
  type OutboxRow,
} from './callback';
import { afterArPaymentRecorded } from './flow-back';
import type { Row } from './ports';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/webhooks/bfg-shop-sync/route';

const SECRET = 'test-secret-0123456789abcdef0123456789abcdef';
const NOW = Date.parse('2026-11-10T14:03:30.000Z');
const CONFIG: SyncConfig = {
  state: 'ok',
  secret: SECRET,
  profileId: 102,
  callbackUrl: 'https://shop.example/api/webhooks/supplieradvisor-payment',
  bankAccountId: null,
};

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`FAIL - ${name}`);
    throw e;
  }
}

// ── builders ────────────────────────────────────────────────────────────────

function address(): Row {
  return { line1: '1 Test Street', line2: '', city: 'Ballito', province: 'KZN', region: '', postal_code: '4420', country: 'South Africa', formatted: '' };
}

function customerSnap(over: Row = {}): Row {
  return {
    shop_customer_id: 'cust-uuid-1',
    origin: 'shop',
    fill_blanks_only: false,
    status_hint: 'active',
    trading_name: 'Example Spaza (Pty) Ltd',
    legal_name: 'Example Spaza (Pty) Ltd',
    email: 'Buyer@Example.co.za',
    contact_name: 'Thandi Example',
    phone: '+27 82 000 0000',
    vat_number: '4123456789',
    registration_number: '2020/123456/07',
    customer_type: 'business',
    billing_address: address(),
    shipping_address: address(),
    payment_terms: 'Net 30',
    payment_terms_code: 'days_30',
    credit_limit_cents: 5000000,
    sales_rep_name: 'Shannon Rick',
    match_hints: { source_customer_id: null, email_is_internal_domain: false },
    ...over,
  };
}

/** 10 x OnePot Beef, R126.09 ex VAT each (per-line VAT rounding as the shop does). */
function line(over: Row = {}): Row {
  return {
    shop_product_id: 'onepot-beef',
    sku: 'onepot-beef',
    name: 'OnePot Beef',
    pack: '12 x 400 g',
    description: 'OnePot Beef, 12 x 400 g',
    division: 'foods',
    quantity: 10,
    unit_ex_vat_cents: 12609,
    line_ex_vat_cents: 126090,
    line_vat_cents: 18913,
    line_inc_vat_cents: 145003,
    vat_rate_pct: 15,
    ...over,
  };
}

function placedData(over: Row = {}): Row {
  return {
    shop_order_id: 'order-uuid-1',
    reference: 'bfg-shop-abc123def',
    placed_at: '2026-11-10T14:03:22.123Z',
    issue_date: '2026-11-10',
    due_date: '2026-11-10',
    payment_method: 'card',
    payment_status: 'pending',
    fulfilment_status: 'received',
    payment_terms: null,
    payment_terms_code: null,
    customer: customerSnap(),
    contact: { name: 'Thandi Example', email: 'buyer@example.co.za', phone: '+27 82 000 0000' },
    billing_address: address(),
    shipping: { summary: '12 Example Street, Ballito, 4420', destinations: [{ position: 1, contact_name: '', phone: '', address: '12 Example Street', region_name: '', delivery_date: null }] },
    lines: [line()],
    transport: { status: 'quoted', ex_vat_cents: 0, vat_cents: 0, inc_vat_cents: 0, label: 'Transport' },
    totals: { currency: 'ZAR', subtotal_ex_vat_cents: 126090, vat_cents: 18913, total_inc_vat_cents: 145003, vat_rate_pct: 15 },
    sales_rep_name: null,
    expected_delivery_date: null,
    notes: 'Web order bfg-shop-abc123def',
    markers: { dunning_paused: true, origin: 'bfg_shop' },
    ...over,
  };
}

const paidData = (over: Row = {}): Row => ({
  reference: 'bfg-shop-abc123def',
  payment_reference: 'bfg-shop-abc123def',
  paystack_reference: 'bfg-shop-abc123def',
  method: 'paystack',
  channel: 'card',
  amount_cents: 145003,
  currency: 'ZAR',
  paid_at: '2026-11-10T14:05:41.000Z',
  note: 'Web order bfg-shop-abc123def',
  ...over,
});

const cancelData = (over: Row = {}): Row => ({
  reference: 'bfg-shop-abc123def',
  reason: 'expired_unpaid',
  cancelled_at: '2026-11-11T14:03:22.000Z',
  paid_at: null,
  note: 'Unpaid card checkout expired after 24 hours',
  ...over,
});

type Env = { event: string; key: string; data: Row; state?: string; dry?: boolean; profile?: number; version?: string };

function bodyOf(e: Env): string {
  return JSON.stringify({
    contract_version: e.version ?? '1.0',
    event: e.event,
    idempotency_key: e.key,
    state_version: e.state ?? '2026-11-10T14:03:22.123Z',
    sent_at: '2026-11-10T14:03:23.001Z',
    dry_run: e.dry ?? false,
    profile_id: e.profile ?? 102,
    outbox_id: 'outbox-1',
    attempt: 1,
    data: e.data,
  });
}

function signedRequest(e: Env, over: { ts?: number; secret?: string; rawBody?: string } = {}): SyncHttpRequest {
  const rawBody = over.rawBody ?? bodyOf(e);
  const ts = String(Math.floor((over.ts ?? NOW) / 1000));
  return {
    rawBody,
    headers: {
      timestamp: ts,
      signature: signBfgPayload(REQUEST_SIGNING_PREFIX, over.secret ?? SECRET, ts, rawBody),
      idempotencyKey: e.key,
      event: e.event,
      contentLength: String(Buffer.byteLength(rawBody)),
    },
  };
}

function seedProducts(db: FakeDb) {
  db.products.push(
    { id: 3, metadata: { shop_product_id: 'onepot-beef' } },
    { id: 10, metadata: { shop_product_id: 'soup-brown-onion' } },
    { id: 42, metadata: { shop_product_id: 'nsnp-beef-soya-5kg' } }
  );
}

function setup() {
  const db = new FakeDb();
  seedProducts(db);
  const ports = createFakePorts(db, NOW);
  const send = (e: Env, over?: Parameters<typeof signedRequest>[1]) =>
    processSyncRequest(signedRequest(e, over), { ports, config: CONFIG });
  return { db, ports, send };
}

const placed = (data: Row = placedData(), over: Partial<Env> = {}): Env => ({
  event: 'order.placed',
  key: `order.placed:${data.reference}`,
  data,
  ...over,
});
const paid = (data: Row = paidData(), over: Partial<Env> = {}): Env => ({
  event: 'order.paid',
  key: `order.paid:${data.payment_reference}`,
  data,
  ...over,
});
const cancelled = (data: Row = cancelData(), over: Partial<Env> = {}): Env => ({
  event: 'order.cancelled',
  key: `order.cancelled:${data.reference}`,
  data,
  ...over,
});

const errOf = (r: { body: Row }) => (r.body.error as Row) || {};
const saOf = (r: { body: Row }) => r.body.sa as Row;

async function main() {
  // ── configuration: default OFF ────────────────────────────────────────────
  await test('flag off (default): 503 unavailable, nothing touched', async () => {
    const db = new FakeDb();
    db.failOn = 'claimKey';
    const ports = createFakePorts(db, NOW);
    const e = placed();
    for (const env of [{}, { BFG_SYNC_ENABLED: 'false', BFG_SYNC_SIGNING_SECRET: SECRET, BFG_SYNC_PROFILE_ID: '102' }]) {
      const r = await processSyncRequest(signedRequest(e), { ports, env });
      assert.equal(r.status, 503);
      assert.equal(errOf(r).code, 'unavailable');
      assert.equal(errOf(r).retryable, true);
    }
    assert.equal(db.calls.length, 0);
    assert.equal(db.invoices.length, 0);
  });

  await test('missing secret or profile id other than 102 refuses safely', async () => {
    const { ports } = setup();
    const base = { BFG_SYNC_ENABLED: 'true', BFG_SYNC_SIGNING_SECRET: SECRET, BFG_SYNC_PROFILE_ID: '102' };
    for (const env of [
      { ...base, BFG_SYNC_SIGNING_SECRET: '' },
      { ...base, BFG_SYNC_PROFILE_ID: '' },
      { ...base, BFG_SYNC_PROFILE_ID: '7' },
      { ...base, BFG_SYNC_PROFILE_ID: '1020' },
    ]) {
      const r = await processSyncRequest(signedRequest(placed()), { ports, env });
      assert.equal(r.status, 503, JSON.stringify(env));
      assert.equal(errOf(r).code, 'unavailable');
    }
    const ok = readSyncConfig({ ...base, BFG_SYNC_BANK_ACCOUNT_ID: '55', BFG_SHOP_CALLBACK_URL: 'https://x.example/cb' });
    assert.equal(ok.state, 'ok');
    if (ok.state === 'ok') {
      assert.equal(ok.bankAccountId, 55);
      assert.equal(ok.callbackUrl, 'https://x.example/cb');
    }
  });

  // ── signature and replay window ───────────────────────────────────────────
  await test('signature: valid accepted; invalid, tampered, missing, wrong prefix refused', async () => {
    const { send, db } = setup();
    const e = placed();
    const good = await send(e);
    assert.equal(good.status, 200);

    const req = signedRequest(placed(placedData({ reference: 'bfg-shop-zzz' })));
    const bad = await processSyncRequest(
      { ...req, rawBody: req.rawBody.replace('Thandi', 'Mallory') },
      { ports: createFakePorts(db, NOW), config: CONFIG }
    );
    assert.equal(bad.status, 401);
    assert.equal(errOf(bad).code, 'bad_signature');
    assert.equal(errOf(bad).retryable, false);

    const wrongSecret = await send(placed(placedData({ reference: 'bfg-shop-yyy' })), { secret: 'another-secret-another-secret-123456' });
    assert.equal(errOf(wrongSecret).code, 'bad_signature');

    const noHeader = await processSyncRequest(
      { ...req, headers: { ...req.headers, signature: null } },
      { ports: createFakePorts(db, NOW), config: CONFIG }
    );
    assert.equal(errOf(noHeader).code, 'bad_signature');

    const noPrefix = await processSyncRequest(
      { ...req, headers: { ...req.headers, signature: (req.headers.signature as string).slice(3) } },
      { ports: createFakePorts(db, NOW), config: CONFIG }
    );
    assert.equal(errOf(noPrefix).code, 'bad_signature');

    // A flow-back signature (other direction prefix) is not accepted on this endpoint.
    const ts = req.headers.timestamp as string;
    const crossed = await processSyncRequest(
      { ...req, headers: { ...req.headers, signature: signBfgPayload(CALLBACK_SIGNING_PREFIX, SECRET, ts, req.rawBody) } },
      { ports: createFakePorts(db, NOW), config: CONFIG }
    );
    assert.equal(errOf(crossed).code, 'bad_signature');
    assert.equal(db.invoices.length, 1, 'only the first, valid request wrote');
  });

  await test('signature uses constant-time compare helper and rejects malformed input', async () => {
    const body = '{"a":1}';
    const sig = signBfgPayload(REQUEST_SIGNING_PREFIX, SECRET, '1762783410', body);
    assert.match(sig, /^v1=[0-9a-f]{64}$/);
    assert.equal(verifyBfgSyncSignature({ secret: SECRET, timestamp: '1762783410', signature: sig, rawBody: body }), true);
    assert.equal(verifyBfgSyncSignature({ secret: SECRET, timestamp: '1762783411', signature: sig, rawBody: body }), false);
    assert.equal(verifyBfgSyncSignature({ secret: SECRET, timestamp: 'abc', signature: sig, rawBody: body }), false);
    assert.equal(verifyBfgSyncSignature({ secret: SECRET, timestamp: '1762783410', signature: sig.toUpperCase(), rawBody: body }), false);
    assert.equal(verifyBfgSyncSignature({ secret: '', timestamp: '1762783410', signature: sig, rawBody: body }), false);
  });

  await test('stale timestamp: 401 stale_timestamp, retryable; signature is checked first', async () => {
    const { send, db } = setup();
    const e = placed();
    const stale = await send(e, { ts: NOW - 301_000 });
    assert.equal(stale.status, 401);
    assert.equal(errOf(stale).code, 'stale_timestamp');
    assert.equal(errOf(stale).retryable, true);
    const future = await send(e, { ts: NOW + 301_000 });
    assert.equal(errOf(future).code, 'stale_timestamp');
    const edge = await send(e, { ts: NOW - 300_000 });
    assert.equal(edge.status, 200, 'exactly 300 s is inside the window');

    // Stale AND badly signed: the answer is bad_signature, never stale_timestamp.
    const req = signedRequest(placed(placedData({ reference: 'bfg-shop-qqq' })), { ts: NOW - 900_000 });
    const both = await processSyncRequest(
      { ...req, headers: { ...req.headers, signature: `v1=${'0'.repeat(64)}` } },
      { ports: createFakePorts(db, NOW), config: CONFIG }
    );
    assert.equal(errOf(both).code, 'bad_signature');
  });

  await test('body limit and malformed envelopes', async () => {
    const { send } = setup();
    const huge = 'x'.repeat(256 * 1024 + 10);
    const r = await send(placed(), { rawBody: huge });
    assert.equal(errOf(r).code, 'bad_request');

    const notJson = await send(placed(), { rawBody: 'not json' });
    assert.equal(errOf(notJson).code, 'bad_request');

    assert.equal(errOf(await send(placed(placedData(), { version: '2.0' }))).code, 'unsupported_version');
    assert.equal(errOf(await send({ event: 'order.exploded', key: 'k1', data: {} })).code, 'unknown_event');
    const wrongProfile = await send(placed(placedData(), { profile: 7 }));
    assert.equal(wrongProfile.status, 403);
    assert.equal(errOf(wrongProfile).code, 'profile_not_allowed');

    const missing = await send(placed(placedData({ lines: [] })));
    assert.equal(missing.status, 400);
    assert.equal(errOf(missing).code, 'validation_failed');
    assert.deepEqual((errOf(missing).details as Row).fields, ['data.lines']);

    // Header / body mismatch
    const req = signedRequest(placed());
    const mismatch = await processSyncRequest(
      { ...req, headers: { ...req.headers, event: 'order.paid' } },
      { ports: createFakePorts(new FakeDb(), NOW), config: CONFIG }
    );
    assert.equal(errOf(mismatch).code, 'bad_request');
  });

  // ── order.placed ──────────────────────────────────────────────────────────
  await test('order.placed: customer, sales order and issued invoice, shop totals verbatim', async () => {
    const { send, db } = setup();
    const r = await send(placed());
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.ok, true);
    assert.equal(r.body.result, 'created');
    assert.equal(r.body.idempotent_replay, false);
    assert.equal(r.body.contract_version, '1.0');

    assert.equal(db.customers.length, 1);
    const cust = db.customers[0];
    assert.equal(cust.profile_id, 102);
    assert.equal(cust.source, 'bigfivegroup_web');
    assert.equal(cust.status, 'active');
    assert.equal(cust.email, 'buyer@example.co.za');
    assert.equal(cust.payment_terms, 'Net 30');
    assert.equal(cust.credit_limit, 50000);
    assert.equal(cust.created_by, 'bfg_shop_sync');
    assert.deepEqual(
      Object.keys(cust).filter((k) => /invite|rating|sa_|source_metadata|ar_account|sales_rep_user_id|merged_from|acquisition/.test(k)),
      []
    );
    assert.equal((cust.metadata as Row).shop_customer_id, 'cust-uuid-1');
    assert.equal((cust.metadata as Row).origin, 'bfg_shop');
    assert.equal(db.ensureGlCalls, 1, 'ensurePartyGlAccounts after create');

    assert.equal(db.orders.length, 1);
    const so = db.orders[0];
    assert.equal(so.origin, 'bigfivegroup_web');
    assert.equal(so.status, 'invoiced');
    assert.equal(so.invoice_id, db.invoices[0].id);
    assert.match(String(so.order_number), /^SO-/);
    assert.equal(so.notes, 'Web order bfg-shop-abc123def');
    assert.equal((so.metadata as Row).shop_order_ref, 'bfg-shop-abc123def');

    assert.equal(db.invoices.length, 1);
    const inv = db.invoices[0];
    assert.equal(inv.status, 'sent');
    assert.match(String(inv.invoice_number), /^INV-/);
    assert.equal(inv.profile_id, 102);
    assert.equal(inv.visibility, 'seller_only');
    assert.equal(inv.created_by, 'bfg_shop_sync');
    assert.equal(inv.amount_paid, 0);
    assert.ok(String(inv.notes).includes('[dunning paused]'));
    assert.ok(String(inv.notes).trimEnd().endsWith('[dunning paused]'), 'marker is appended after the note text');
    assert.equal((inv.metadata as Row).origin, 'bfg_shop');
    assert.equal((inv.metadata as Row).shop_order_ref, 'bfg-shop-abc123def');
    assert.equal((inv.metadata as Row).shop_state_version, '2026-11-10T14:03:22.123Z');
    assert.equal(inv.order_id, so.id);
    // totals verbatim from the shop (cents / 100), not recomputed
    assert.equal(inv.subtotal, 1260.9);
    assert.equal(inv.tax_amount, 189.13);
    assert.equal(inv.total_amount, 1450.03);
    assert.equal(inv.tax_rate, 15);
    const items = inv.items as Row[];
    assert.equal(items.length, 1);
    assert.equal(items[0].product_id, 3);
    assert.equal(items[0].sku, 'onepot-beef');
    assert.equal(items[0].unit_price, 126.09);
    assert.equal(items[0].line_total, 1260.9);
    assert.equal(items[0].uom, 'unit');
    assert.equal(items[0].currency, 'ZAR');

    // books through syncCrmInvoiceToBooks only; no stock, no email, no loyalty
    assert.deepEqual(db.syncCalls.map((c) => c.status), ['sent']);
    assert.equal(db.settleCalls.length, 0);
    const sa = saOf(r);
    assert.equal(sa.profile_id, 102);
    assert.equal(sa.invoice_status, 'sent');
    assert.equal(sa.invoice_id, inv.id);
    assert.equal(sa.invoice_number, inv.invoice_number);
    assert.equal(sa.sales_order_id, so.id);
    assert.equal(sa.customer_id, cust.id);
    assert.equal(sa.payment_id, null);
    assert.equal(sa.amount_paid_cents, 0);
    assert.equal(r.body.possible_duplicate, null);
    assert.deepEqual(r.body.warnings, []);
  });

  await test('order.placed: charged transport adds one line without product_id; quoted adds none', async () => {
    const { send, db } = setup();
    const data = placedData({
      reference: 'bfg-shop-transport1',
      transport: { status: 'charged', ex_vat_cents: 25000, vat_cents: 3750, inc_vat_cents: 28750, label: 'Transport' },
      totals: { currency: 'ZAR', subtotal_ex_vat_cents: 151090, vat_cents: 22663, total_inc_vat_cents: 173753, vat_rate_pct: 15 },
    });
    const r = await send(placed(data));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const items = db.invoices[0].items as Row[];
    assert.equal(items.length, 2);
    assert.equal(items[1].product_id, null);
    assert.equal(items[1].name, 'Transport');
    assert.equal(items[1].line_total, 250);
    assert.equal(db.invoices[0].total_amount, 1737.53);
  });

  await test('order.placed: multiple destinations summarised, list kept in sales order metadata', async () => {
    const { send, db } = setup();
    const dest = (n: number) => ({ position: n, contact_name: '', phone: '', address: `Addr ${n}`, region_name: '', delivery_date: null });
    const r = await send(placed(placedData({ reference: 'bfg-shop-multi', shipping: { summary: 'x', destinations: [dest(1), dest(2)] } })));
    assert.equal(r.status, 200);
    assert.equal(db.orders[0].shipping_address, 'Multiple destinations, see web order bfg-shop-multi');
    assert.equal(((db.orders[0].metadata as Row).shipments as Row[]).length, 2);
  });

  await test('idempotent replay: same key returns the same response, nothing written twice', async () => {
    const { send, db } = setup();
    const first = await send(placed());
    const again = await send(placed());
    assert.equal(again.status, 200);
    assert.equal(again.body.idempotent_replay, true);
    assert.equal(again.body.result, 'created');
    assert.deepEqual(saOf(again), saOf(first));
    assert.equal(db.invoices.length, 1);
    assert.equal(db.orders.length, 1);
    assert.equal(db.customers.length, 1);
    assert.equal(db.syncCalls.length, 1);
    assert.equal(db.docSeq, 2, 'one SO and one INV number allocated');
  });

  await test('order.placed noop at entity level, even with another state_version (no key stored)', async () => {
    const { send, db } = setup();
    const first = await send(placed());
    db.events.clear(); // key store lost: the entity key (shop_order_ref) still protects us
    const second = await send(placed(placedData(), { state: '2026-11-10T15:00:00.000Z' }));
    assert.equal(second.status, 200);
    assert.equal(second.body.result, 'noop');
    assert.equal(second.body.idempotent_replay, true);
    assert.equal(saOf(second).invoice_id, saOf(first).invoice_id);
    assert.equal(db.invoices.length, 1);
  });

  await test('same reference with different totals: 409 totals_changed (permanent)', async () => {
    const { send, db } = setup();
    await send(placed());
    const changed = placedData({
      totals: { currency: 'ZAR', subtotal_ex_vat_cents: 126190, vat_cents: 18913, total_inc_vat_cents: 145103, vat_rate_pct: 15 },
      lines: [line({ line_ex_vat_cents: 126190 })],
    });
    const viaKey = await send(placed(changed));
    assert.equal(viaKey.status, 409);
    assert.equal(errOf(viaKey).code, 'totals_changed');
    assert.equal(errOf(viaKey).retryable, false);
    db.events.clear();
    const viaEntity = await send(placed(changed));
    assert.equal(errOf(viaEntity).code, 'totals_changed');
    assert.equal(db.invoices.length, 1);
    assert.ok(db.alerts.some((a) => a.code === 'totals_changed'));
  });

  await test('unmapped product (UMTHOMBO waters): 422 unmapped_product, nothing written', async () => {
    const { send, db } = setup();
    const water = line({ shop_product_id: 'umthombo-still-500ml', sku: 'umthombo-still-500ml', name: 'UMTHOMBO Still', division: 'waters' });
    const data = placedData({
      reference: 'bfg-shop-water1',
      lines: [line(), water],
      totals: { currency: 'ZAR', subtotal_ex_vat_cents: 252180, vat_cents: 37826, total_inc_vat_cents: 290006, vat_rate_pct: 15 },
    });
    const r = await send(placed(data));
    assert.equal(r.status, 422);
    assert.equal(errOf(r).code, 'unmapped_product');
    assert.equal(errOf(r).retryable, false);
    assert.deepEqual((errOf(r).details as Row).shop_product_ids, ['umthombo-still-500ml']);
    assert.equal(db.customers.length + db.orders.length + db.invoices.length, 0);
    assert.equal(db.events.size, 0, 'the key is not kept after a failure');
  });

  await test('cent invariants: each failure is 422 totals_mismatch; VAT rate must be 15', async () => {
    const { send, db } = setup();
    const base = placedData();
    const cases: Array<[string, Row]> = [
      ['subtotal', { totals: { ...(base.totals as Row), subtotal_ex_vat_cents: 126091, total_inc_vat_cents: 145004 } }],
      ['vat', { totals: { ...(base.totals as Row), vat_cents: 18914, total_inc_vat_cents: 145004 } }],
      ['total', { totals: { ...(base.totals as Row), total_inc_vat_cents: 145002 } }],
      ['currency', { totals: { ...(base.totals as Row), currency: 'USD' } }],
    ];
    for (const [name, patch] of cases) {
      const r = await send(placed(placedData({ reference: `bfg-shop-inv-${name}`, ...patch })));
      assert.equal(r.status, 422, name);
      assert.equal(errOf(r).code, 'totals_mismatch', name);
      assert.equal(errOf(r).retryable, false);
      assert.ok(((errOf(r).details as Row).invariants as string[]).includes(name), name);
    }
    // transport must be part of the sums
    const t = await send(placed(placedData({
      reference: 'bfg-shop-inv-transport',
      transport: { status: 'charged', ex_vat_cents: 25000, vat_cents: 3750, inc_vat_cents: 28750, label: 'Transport' },
    })));
    assert.equal(errOf(t).code, 'totals_mismatch');
    // a different VAT rate is not accepted until a per-line rule exists
    const rate = await send(placed(placedData({ reference: 'bfg-shop-inv-rate', lines: [line({ vat_rate_pct: 0 })] })));
    assert.equal(errOf(rate).code, 'validation_failed');
    assert.equal(db.invoices.length, 0);

    assert.deepEqual(
      totalsInvariantFailures(
        [{ line_ex_vat_cents: 100, line_vat_cents: 15 }],
        { ex_vat_cents: 0, vat_cents: 0 },
        { currency: 'ZAR', subtotal_ex_vat_cents: 100, vat_cents: 15, total_inc_vat_cents: 115 }
      ),
      []
    );
  });

  await test('NSNP rounding: shop per-line VAT is stored as sent, never recomputed', async () => {
    const { send, db } = setup();
    // 10 packs, R126.087 ex VAT each as the shop derives it: shop total R1,450.00, calcDocTotals would say R1,450.04
    const nsnp = line({
      shop_product_id: 'nsnp-beef-soya-5kg', sku: 'nsnp-beef-soya-5kg', name: 'NSNP Beef Soya 5 kg', pack: '5 kg', description: '',
      quantity: 10, unit_ex_vat_cents: 12609, line_ex_vat_cents: 126087, line_vat_cents: 18913, line_inc_vat_cents: 145000,
    });
    const r = await send(placed(placedData({
      reference: 'bfg-shop-nsnp1',
      lines: [nsnp],
      totals: { currency: 'ZAR', subtotal_ex_vat_cents: 126087, vat_cents: 18913, total_inc_vat_cents: 145000, vat_rate_pct: 15 },
    })));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(db.invoices[0].subtotal, 1260.87);
    assert.equal(db.invoices[0].tax_amount, 189.13);
    assert.equal(db.invoices[0].total_amount, 1450);
    assert.equal(db.orders[0].total_amount, 1450);
  });

  await test('books failure at placement: nothing half-issued, retry completes once', async () => {
    const { send, db } = setup();
    db.booksFail = true;
    const r = await send(placed());
    assert.equal(r.status, 500);
    assert.equal(errOf(r).code, 'internal_error');
    assert.equal(errOf(r).retryable, true);
    assert.equal(db.invoices.length, 1);
    assert.equal(db.invoices[0].status, 'draft', 'invoice is put back to draft');
    assert.equal(db.events.size, 0, 'claim released');
    db.booksFail = false;
    const retry = await send(placed());
    assert.equal(retry.status, 200);
    assert.equal(retry.body.result, 'created');
    assert.equal(db.invoices.length, 1, 'the draft is resumed, not duplicated');
    assert.equal(db.invoices[0].status, 'sent');
    assert.equal(db.orders[0].status, 'invoiced');
    assert.equal(db.customers.length, 1);
  });

  await test('invoice number collision re-rolls', async () => {
    const { send, db } = setup();
    db.takenNumbers.add('INV-20261110-0002'); // the number the fake allocates first
    const r = await send(placed());
    assert.equal(r.status, 200);
    assert.notEqual(db.invoices[0].invoice_number, 'INV-20261110-0002');
    assert.equal(db.invoices.length, 1);
  });

  await test('dry_run: validated and planned, nothing written, no numbering, no key stored', async () => {
    const { send, db } = setup();
    const r = await send(placed(placedData(), { dry: true }));
    assert.equal(r.status, 200);
    assert.equal(r.body.result, 'dry_run');
    const plan = r.body.plan as Row;
    assert.equal(plan.customer, 'create');
    assert.equal(plan.lines, 1);
    assert.equal(plan.mapped, true);
    assert.equal(plan.totals_ok, true);
    assert.equal(plan.would_void, false);
    assert.equal(db.customers.length + db.orders.length + db.invoices.length, 0);
    assert.equal(db.docSeq, 0);
    assert.equal(db.events.size, 0);
    assert.equal(db.ensureGlCalls, 0);
    // dry run still rejects what a real run would reject
    const water = line({ shop_product_id: 'umthombo-still-500ml' });
    const bad = await send(placed(placedData({ reference: 'bfg-shop-dry2', lines: [water], totals: { currency: 'ZAR', subtotal_ex_vat_cents: 126090, vat_cents: 18913, total_inc_vat_cents: 145003, vat_rate_pct: 15 } }), { dry: true }));
    assert.equal(errOf(bad).code, 'unmapped_product');
    // dry-run of a paid event against an unseen order
    const unseen = await send(paid(paidData(), { dry: true }));
    assert.equal(errOf(unseen).code, 'order_not_synced');
  });

  // ── order.paid ────────────────────────────────────────────────────────────
  await test('order.paid: payment recorded, invoice paid, settled to the FNB account, order paid', async () => {
    const { send, db } = setup();
    await send(placed());
    const r = await send(paid());
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.result, 'created');
    assert.equal(db.payments.length, 1);
    const pay = db.payments[0];
    assert.equal(pay.method, 'paystack');
    assert.equal(pay.amount, 1450.03);
    assert.equal(pay.reference, 'bfg-shop-abc123def');
    assert.equal(pay.created_by, 'bfg_shop_sync');
    assert.equal(pay.notes, 'Web order bfg-shop-abc123def');
    assert.equal(pay.currency, 'ZAR');
    assert.equal(db.invoices[0].status, 'paid');
    assert.equal(db.invoices[0].amount_paid, 1450.03);
    assert.equal(db.orders[0].status, 'paid');
    assert.equal(db.settleCalls.length, 1);
    assert.equal(db.settleCalls[0].paymentId, pay.id);
    assert.equal(db.settleCalls[0].amount, 1450.03);
    assert.equal(db.settleCalls[0].bankAccountId, 101, 'the single FNB account of profile 102');
    const sa = saOf(r);
    assert.equal(sa.payment_id, pay.id);
    assert.equal(sa.amount_paid_cents, 145003);
    assert.equal(sa.invoice_status, 'paid');
  });

  await test('order.paid: BFG_SYNC_BANK_ACCOUNT_ID wins; no unique bank account refuses; replay and entity noop', async () => {
    const db = new FakeDb();
    seedProducts(db);
    const ports = createFakePorts(db, NOW);
    const withBank: SyncConfig = { ...CONFIG, bankAccountId: 77 } as SyncConfig;
    const run = (e: Env, cfg: SyncConfig) => processSyncRequest(signedRequest(e), { ports, config: cfg });
    await run(placed(), withBank);
    const r = await run(paid(), withBank);
    assert.equal(r.status, 200);
    assert.equal(db.settleCalls[0].bankAccountId, 77);

    // replay by key
    const again = await run(paid(), withBank);
    assert.equal(again.body.idempotent_replay, true);
    assert.equal(db.payments.length, 1);
    assert.equal(db.settleCalls.length, 1);
    // entity-level noop (key store lost): same (invoice, reference) records nothing new
    db.events.delete('order.paid:bfg-shop-abc123def');
    const noop = await run(paid(), withBank);
    assert.equal(noop.body.result, 'noop');
    assert.equal(db.payments.length, 1);

    // two bank accounts and none configured: refuse, write nothing
    const db2 = new FakeDb();
    seedProducts(db2);
    db2.banks = [1, 2];
    const ports2 = createFakePorts(db2, NOW);
    await processSyncRequest(signedRequest(placed()), { ports: ports2, config: CONFIG });
    const refused = await processSyncRequest(signedRequest(paid()), { ports: ports2, config: CONFIG });
    assert.equal(refused.status, 503);
    assert.equal(db2.payments.length, 0);
  });

  await test('order.paid: on-account receipt maps to eft; amount mismatch is permanent', async () => {
    const { send, db } = setup();
    await send(placed());
    const wrong = await send(paid(paidData({ amount_cents: 145002 })));
    assert.equal(wrong.status, 409);
    assert.equal(errOf(wrong).code, 'amount_mismatch');
    assert.equal(errOf(wrong).retryable, false);
    assert.equal(db.payments.length, 0);
    assert.ok(db.alerts.some((a) => a.code === 'amount_mismatch'));
    const ok = await send(paid(paidData({ method: 'on_account_receipt', payment_reference: 'onacct:bfg-shop-abc123def', paystack_reference: null }), { key: 'order.paid:onacct:bfg-shop-abc123def' }));
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(db.payments[0].method, 'eft');
    assert.equal(db.payments[0].reference, 'onacct:bfg-shop-abc123def');
  });

  await test('order.paid: partial, over and part-paid-invoice amounts: 409 amount_mismatch, nothing booked or marked paid', async () => {
    const { send, db } = setup();
    await send(placed());
    for (const amount of [1, 145000 - 1, 145000 + 1, 0.5 * 145000]) {
      const r = await send(paid(paidData({ amount_cents: amount }), { key: `order.paid:amt-${amount}` }));
      assert.equal(r.status, 409, `amount ${amount}`);
      assert.equal(errOf(r).code, 'amount_mismatch');
      assert.equal(errOf(r).retryable, false);
    }
    assert.equal(db.payments.length, 0);
    assert.equal(db.settleCalls.length, 0);
    assert.notEqual(db.invoices[0].status, 'paid');
    assert.equal(db.invoices[0].paid_at ?? null, null);
    assert.notEqual(db.orders[0].status, 'paid');
    assert.ok(db.alerts.filter((a) => a.code === 'amount_mismatch').length >= 4);
    // A part-paid invoice never accepts a top-up, even for exactly its outstanding balance.
    db.invoices[0].status = 'partial';
    db.invoices[0].amount_paid = 500;
    const top = await send(paid(paidData({ amount_cents: 145000 - 50000 }), { key: 'order.paid:topup' }));
    assert.equal(top.status, 409);
    assert.equal(errOf(top).code, 'amount_mismatch');
    assert.equal(db.payments.length, 0);
    assert.equal(db.settleCalls.length, 0);
    assert.notEqual(db.orders[0].status, 'paid');
  });

  await test('order.paid accepted against an overdue invoice', async () => {
    const { send, db } = setup();
    await send(placed());
    db.invoices[0].status = 'overdue';
    const r = await send(paid());
    assert.equal(r.status, 200);
    assert.equal(db.invoices[0].status, 'paid');
  });

  await test('order.paid with a failing settlement: retryable error, retry resumes the books once', async () => {
    const { send, db, ports } = setup();
    await send(placed());
    const real = ports.books.settlePayment;
    let fail = true;
    ports.books.settlePayment = async (p) => (fail ? { ok: false, error: 'coa' } : real(p));
    const r1 = await send(paid());
    assert.equal(r1.status, 500);
    assert.equal(errOf(r1).retryable, true);
    assert.equal(db.payments.length, 1, 'payment row exists');
    fail = false;
    const r2 = await send(paid());
    assert.equal(r2.status, 200);
    assert.equal(db.payments.length, 1, 'still one payment');
    assert.equal(db.settleCalls.length, 1);
    assert.equal(db.orders[0].status, 'paid');
  });

  // ── never void a paid invoice ─────────────────────────────────────────────
  await test('order.cancelled after paid: 409 void_after_paid, invoice untouched, books not reversed', async () => {
    const { send, db } = setup();
    await send(placed());
    await send(paid());
    const r = await send(cancelled());
    assert.equal(r.status, 409);
    assert.equal(errOf(r).code, 'void_after_paid');
    assert.equal(errOf(r).retryable, false);
    assert.equal(db.voidCalls.length, 0, 'reverseInvoiceBooks must not run');
    assert.equal(db.invoices[0].status, 'paid');
    assert.equal(db.orders[0].status, 'paid');
    assert.ok(db.alerts.some((a) => a.code === 'void_after_paid'));
  });

  await test('order.cancelled: any payment signal blocks the void (paid_at, payment row, amount_paid, partial)', async () => {
    for (const mutate of [
      (db: FakeDb) => void (db.invoices[0].amount_paid = 10),
      (db: FakeDb) => void db.payments.push({ id: 1, invoice_id: db.invoices[0].id, reference: 'EFT-1' }),
      (db: FakeDb) => void (db.invoices[0].status = 'partial'),
      (db: FakeDb) => void (db.invoices[0].paid_at = '2026-11-10T10:00:00Z'),
    ]) {
      const { send, db } = setup();
      await send(placed());
      mutate(db);
      const r = await send(cancelled());
      assert.equal(errOf(r).code, 'void_after_paid');
      assert.equal(db.voidCalls.length, 0);
      assert.notEqual(db.invoices[0].status, 'void');
    }
    // the shop says it was paid, even though SA has no payment yet
    const { send, db } = setup();
    await send(placed());
    const r = await send(cancelled(cancelData({ paid_at: '2026-11-11T10:00:00.000Z' })));
    assert.equal(errOf(r).code, 'void_after_paid');
    assert.equal(db.voidCalls.length, 0);
  });

  await test('order.cancelled unpaid: books reversed, invoice void (number kept), order cancelled; repeat is noop', async () => {
    const { send, db } = setup();
    await send(placed());
    const number = db.invoices[0].invoice_number;
    const r = await send(cancelled());
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.result, 'voided');
    assert.deepEqual(db.voidCalls, [db.invoices[0].id]);
    assert.equal(db.invoices[0].status, 'void');
    assert.equal(db.invoices[0].invoice_number, number);
    assert.equal(db.orders[0].status, 'cancelled');
    db.events.clear();
    const again = await send(cancelled());
    assert.equal(again.body.result, 'noop');
    assert.equal(db.voidCalls.length, 1);
  });

  await test('order.paid against a voided invoice: 409 payment_against_void, not reopened', async () => {
    const { send, db } = setup();
    await send(placed());
    await send(cancelled());
    const r = await send(paid());
    assert.equal(r.status, 409);
    assert.equal(errOf(r).code, 'payment_against_void');
    assert.equal(errOf(r).retryable, false);
    assert.equal(db.invoices[0].status, 'void');
    assert.equal(db.payments.length, 0);
    assert.equal(db.settleCalls.length, 0);
    assert.ok(db.alerts.some((a) => a.code === 'payment_against_void'));
  });

  await test('paid / status / cancel for an order never seen: 409 order_not_synced, retryable', async () => {
    const { send } = setup();
    for (const e of [
      paid(),
      cancelled(),
      { event: 'order.status', key: 'order.status:bfg-shop-abc123def:v1', data: { reference: 'bfg-shop-abc123def', fulfilment_status: 'dispatched' } },
      { event: 'order.refund', key: 'order.refund:bfg-shop-abc123def', data: { reference: 'bfg-shop-abc123def', refunded_at: '2026-11-12T09:00:00.000Z', amount_cents: 145003 } },
    ] as Env[]) {
      const r = await send(e);
      assert.equal(r.status, 409, e.event);
      assert.equal(errOf(r).code, 'order_not_synced', e.event);
      assert.equal(errOf(r).retryable, true, e.event);
    }
  });

  // ── order.status ──────────────────────────────────────────────────────────
  await test('order.status: mapping, courier/tracking, delivered_at, never backwards, stale ignored', async () => {
    const { send, db } = setup();
    await send(placed());
    const status = (s: string, v: string, extra: Row = {}): Env => ({
      event: 'order.status',
      key: `order.status:bfg-shop-abc123def:${v}`,
      state: v,
      data: { reference: 'bfg-shop-abc123def', fulfilment_status: s, payment_status: 'pending', courier: '', tracking_reference: '', expected_delivery_date: null, delivered_at: null, ...extra },
    });
    const received = await send(status('received', '2026-11-10T14:10:00.000Z'));
    assert.equal(received.status, 200);
    assert.equal(db.orders[0].status, 'invoiced', 'received never moves an invoiced order back');
    const proc = await send(status('processing', '2026-11-10T15:00:00.000Z'));
    assert.equal(proc.body.result, 'updated');
    assert.equal(db.orders[0].status, 'processing');
    const disp = await send(status('dispatched', '2026-11-11T08:00:00.000Z', { courier: 'Courier X', tracking_reference: 'TRK123', expected_delivery_date: '2026-11-13' }));
    assert.equal(db.orders[0].status, 'shipped');
    assert.equal((db.orders[0].metadata as Row).courier, 'Courier X');
    assert.equal((db.orders[0].metadata as Row).tracking, 'TRK123');
    assert.equal(db.orders[0].promised_date, '2026-11-13');
    assert.equal(db.invoices[0].status, 'sent', 'the invoice is not touched');
    assert.equal(disp.body.state_version_stored, '2026-11-11T08:00:00.000Z');
    const del = await send(status('delivered', '2026-11-13T12:00:00.000Z', { delivered_at: '2026-11-13T11:55:00.000Z' }));
    assert.equal(db.orders[0].status, 'shipped');
    assert.equal((db.orders[0].metadata as Row).delivered_at, '2026-11-13T11:55:00.000Z');
    assert.equal(del.status, 200);
    // shop aliases: exceptions must not move a shipped order backwards, but ETA still updates
    const hold = await send(status('on_hold', '2026-11-13T13:00:00.000Z', { expected_delivery_date: '2026-11-18' }));
    assert.equal(hold.body.result, 'updated');
    assert.equal(db.orders[0].status, 'shipped', 'on_hold must not move a shipped order backwards');
    assert.equal(db.orders[0].promised_date, '2026-11-18');
    const delayed = await send(status('delayed', '2026-11-13T14:00:00.000Z', { expected_delivery_date: '2026-11-20' }));
    assert.equal(db.orders[0].status, 'shipped', 'delayed must not change sales_orders.status');
    assert.equal(db.orders[0].promised_date, '2026-11-20');
    // an older state_version is stale and writes nothing
    const old = await send(status('processing', '2026-11-10T16:00:00.000Z'));
    assert.equal(old.body.result, 'stale');
    assert.equal(db.orders[0].status, 'shipped');
    assert.equal(db.invoices[0].status, 'sent');
  });

  await test('order.status keeps a paid order paid on received/confirmed', async () => {
    const { send, db } = setup();
    await send(placed());
    await send(paid());
    await send({ event: 'order.status', key: 'order.status:bfg-shop-abc123def:v9', state: '2026-11-10T20:00:00.000Z', data: { reference: 'bfg-shop-abc123def', fulfilment_status: 'confirmed', payment_status: 'paid' } });
    assert.equal(db.orders[0].status, 'paid');
  });

  await test('order.status: shop aliases dispatching, completed, on_hold and delayed', async () => {
    const { send, db } = setup();
    await send(placed());
    const status = (s: string, v: string, extra: Row = {}): Env => ({
      event: 'order.status',
      key: `order.status:bfg-shop-abc123def:${v}`,
      state: v,
      data: { reference: 'bfg-shop-abc123def', fulfilment_status: s, payment_status: 'paid', courier: '', tracking_reference: '', expected_delivery_date: null, delivered_at: null, ...extra },
    });
    const disp = await send(status('dispatching', '2026-11-11T09:00:00.000Z'));
    assert.equal(disp.body.result, 'updated');
    assert.equal(db.orders[0].status, 'processing', 'dispatching maps to processing');
    const done = await send(status('completed', '2026-11-14T10:00:00.000Z', { delivered_at: '2026-11-14T09:50:00.000Z' }));
    assert.equal(db.orders[0].status, 'shipped', 'completed maps to shipped');
    assert.equal((db.orders[0].metadata as Row).delivered_at, '2026-11-14T09:50:00.000Z');
    assert.equal(done.status, 200);
  });

  // ── order.refund ──────────────────────────────────────────────────────────
  await test('order.refund: alert only, order cancelled with a note, invoice and receipt untouched', async () => {
    const { send, db } = setup();
    await send(placed());
    await send(paid());
    const r = await send({
      event: 'order.refund',
      key: 'order.refund:bfg-shop-abc123def',
      data: { reference: 'bfg-shop-abc123def', refunded_at: '2026-11-12T09:00:00.000Z', amount_cents: 145003, paystack_reference: 'bfg-shop-abc123def', reason: 'refunded', note: 'Refund needed in SupplierAdvisor®' },
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.result, 'alerted');
    assert.equal(db.orders[0].status, 'cancelled');
    assert.match(String(db.orders[0].notes), /refund needed in SupplierAdvisor®/);
    assert.equal(db.invoices[0].status, 'paid');
    assert.equal(db.payments.length, 1);
    assert.equal(db.voidCalls.length, 0);
    assert.ok(db.alerts.some((a) => a.code === 'refund_needed'));
  });

  // ── customer.upsert and matching ──────────────────────────────────────────
  const upsert = (data: Row, version = '2026-11-10T10:00:00.000Z'): Env => ({
    event: 'customer.upsert',
    key: `customer.upsert:${data.shop_customer_id}:${version}`,
    state: version,
    data,
  });

  await test('customer.upsert: create prospect, update, noop, stale', async () => {
    const { send, db } = setup();
    const create = await send(upsert(customerSnap({ status_hint: 'prospect' })));
    assert.equal(create.status, 200, JSON.stringify(create.body));
    assert.equal(create.body.result, 'created');
    assert.equal(db.customers[0].status, 'prospect');
    assert.equal(saOf(create).customer_id, db.customers[0].id);
    assert.equal(db.ensureGlCalls, 1);

    const update = await send(upsert(customerSnap({ status_hint: 'active', phone: '+27 82 111 1111' }), '2026-11-10T11:00:00.000Z'));
    assert.equal(update.body.result, 'updated');
    assert.equal(db.customers[0].phone, '+27 82 111 1111');
    assert.equal(db.customers[0].status, 'active');
    assert.equal(db.customers.length, 1);

    // never downgrades active
    await send(upsert(customerSnap({ status_hint: 'prospect', phone: '+27 82 111 1111' }), '2026-11-10T12:00:00.000Z'));
    assert.equal(db.customers[0].status, 'active');

    // an older version writes nothing
    const stale = await send(upsert(customerSnap({ phone: '+27 82 999 9999' }), '2026-11-10T09:00:00.000Z'));
    assert.equal(stale.body.result, 'stale');
    assert.equal(db.customers[0].phone, '+27 82 111 1111');
    assert.equal(db.customers.length, 1);
  });

  await test('customer.upsert origin supplieradvisor: 403 origin_not_allowed', async () => {
    const { send, db } = setup();
    const r = await send(upsert(customerSnap({ origin: 'supplieradvisor', fill_blanks_only: true })));
    assert.equal(r.status, 403);
    assert.equal(errOf(r).code, 'origin_not_allowed');
    assert.equal(db.customers.length, 0);
  });

  await test('customer.upsert without a usable name: 422 customer_unresolvable', async () => {
    const { send } = setup();
    const r = await send(upsert(customerSnap({ trading_name: '', legal_name: '', contact_name: '' })));
    assert.equal(r.status, 422);
    assert.equal(errOf(r).code, 'customer_unresolvable');
  });

  await test('matching: VAT digits, registration, never internal email, never a supplier, name only = possible_duplicate', async () => {
    const { send, db } = setup();
    db.customers.push(
      { id: 1, profile_id: 102, trading_name: 'Old Name', vat_number: '4123 456 789', email: 'old@example.co.za', payment_terms: 'Net 7', metadata: {} },
      { id: 2, profile_id: 102, trading_name: 'Reg Co', registration_number: '2019/000111/07', metadata: {} },
      { id: 3, profile_id: 102, trading_name: 'Internal Co', email: 'sales@bigfivefoods.com', metadata: {} },
      { id: 4, profile_id: 102, trading_name: 'Supplier Co', email: 'orders@supplier.example', metadata: { party_book_role: 'supplier' } },
      { id: 5, profile_id: 102, trading_name: 'Name Only Ltd', metadata: {} }
    );
    // 3: VAT number matches id 1 (separators ignored)
    let r = await send(upsert(customerSnap({ shop_customer_id: 'c-vat', vat_number: '4123456789', email: '' })));
    assert.equal(saOf(r).customer_id, 1);
    assert.equal(db.customers.length, 5);
    assert.equal((db.customers[0].metadata as Row).shop_customer_id, 'c-vat');
    // 4: registration
    r = await send(upsert(customerSnap({ shop_customer_id: 'c-reg', vat_number: '', registration_number: '2019-000111-07', email: '' })));
    assert.equal(saOf(r).customer_id, 2);
    // 5: internal domain never matches by email -> a new customer
    r = await send(upsert(customerSnap({ shop_customer_id: 'c-int', vat_number: '', registration_number: '', email: 'sales@bigfivefoods.com', trading_name: 'Web Internal Buyer' })));
    assert.notEqual(saOf(r).customer_id, 3);
    assert.equal(r.body.result, 'created');
    // 5: a supplier is never matched by email
    r = await send(upsert(customerSnap({ shop_customer_id: 'c-sup', vat_number: '', registration_number: '', email: 'orders@supplier.example', trading_name: 'Another Buyer' })));
    assert.notEqual(saOf(r).customer_id, 4);
    // 5: a unique, allowed email matches
    r = await send(upsert(customerSnap({ shop_customer_id: 'c-mail', vat_number: '', registration_number: '', email: 'OLD@example.co.za', trading_name: 'Whatever' })));
    assert.equal(saOf(r).customer_id, 1 , 'id 1 already linked: matched by email, link not overwritten');
    assert.equal((db.customers[0].metadata as Row).shop_customer_id, 'c-vat');
    // 6: name only never matches; a new customer plus possible_duplicate
    const before = db.customers.length;
    r = await send(upsert(customerSnap({ shop_customer_id: 'c-name', vat_number: '', registration_number: '', email: '', trading_name: 'Name Only Ltd' })));
    assert.equal(r.body.result, 'created');
    assert.equal(db.customers.length, before + 1);
    assert.notEqual(saOf(r).customer_id, 5);
    assert.deepEqual(r.body.possible_duplicate, { shop_customer_id: 'c-name', sa_customer_ids: [5], reason: 'name_match' });
  });

  await test('order.placed with origin supplieradvisor: fill blanks only, terms and credit untouched; unknown customer refused', async () => {
    const { send, db } = setup();
    db.customers.push({ id: 7, profile_id: 102, trading_name: 'Imported Co', email: '', phone: '', payment_terms: 'Net 7', credit_limit: 1000, status: 'prospect', metadata: {} });
    const snap = customerSnap({
      shop_customer_id: 'c-imp', origin: 'supplieradvisor', fill_blanks_only: true, trading_name: 'Different Name',
      phone: '+27 11 000 0000', payment_terms: 'Net 30', credit_limit_cents: 9900000,
      match_hints: { source_customer_id: 7, email_is_internal_domain: false },
    });
    const r = await send(placed(placedData({ reference: 'bfg-shop-imp1', customer: snap })));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const c = db.customers.find((x) => x.id === 7)!;
    assert.equal(c.trading_name, 'Imported Co');
    assert.equal(c.phone, '+27 11 000 0000', 'a blank was filled');
    assert.equal(c.payment_terms, 'Net 7');
    assert.equal(c.credit_limit, 1000);
    assert.equal(c.status, 'prospect');
    assert.equal(db.customers.length, 1);
    assert.equal(db.invoices[0].customer_id, 7);

    const unknown = await send(placed(placedData({ reference: 'bfg-shop-imp2', customer: customerSnap({ shop_customer_id: 'c-imp2', origin: 'supplieradvisor', vat_number: '', registration_number: '', email: '', trading_name: 'Nobody' }) })));
    assert.equal(unknown.status, 403);
    assert.equal(errOf(unknown).code, 'origin_not_allowed');
  });

  // ── concurrency and failures ──────────────────────────────────────────────
  await test('a key being processed: 409 conflict_in_progress, retryable', async () => {
    const { send, db } = setup();
    db.events.set('order.placed:bfg-shop-abc123def', { status: 'processing', fingerprint: null });
    const r = await send(placed());
    assert.equal(r.status, 409);
    assert.equal(errOf(r).code, 'conflict_in_progress');
    assert.equal(errOf(r).retryable, true);
    assert.equal(db.invoices.length, 0);
  });

  await test('unexpected store failure: 500 internal_error retryable, no detail leaked, claim released', async () => {
    const { send, db } = setup();
    db.failOn = 'insertOrder';
    const r = await send(placed());
    assert.equal(r.status, 500);
    assert.equal(errOf(r).code, 'internal_error');
    assert.equal(errOf(r).retryable, true);
    assert.ok(!JSON.stringify(r.body).includes('boom'));
    assert.equal(db.events.size, 0);
  });

  await test('responses never carry personal data in error details', async () => {
    const { send } = setup();
    const r = await send(placed(placedData({ lines: [] })));
    const text = JSON.stringify(r.body);
    assert.ok(!text.includes('Thandi') && !text.includes('example.co.za'));
  });

  // ── flow-back ─────────────────────────────────────────────────────────────
  const shopInvoice: Row = {
    id: 9012,
    invoice_number: 'INV-20261110-CD34',
    total_amount: 1450.03,
    metadata: { origin: 'bfg_shop', shop_order_ref: 'bfg-shop-abc123def' },
  };
  const eftPayment = { id: 55501, profile_id: 102, invoice_id: 9012, amount: 1450.03, paid_at: '2026-11-12T07:55:00.000Z', method: 'eft', reference: 'FNB-EFT-20261112-001', created_by: 'user_abc' };

  await test('flow-back: skipped for payments created by the sync, other origins and other profiles', async () => {
    assert.equal(shouldFlowBack(shopInvoice, eftPayment, 102), true);
    assert.equal(shouldFlowBack(shopInvoice, { ...eftPayment, created_by: 'bfg_shop_sync' }, 102), false, 'loop guard');
    assert.equal(shouldFlowBack({ ...shopInvoice, metadata: { origin: 'import' } }, eftPayment, 102), false);
    assert.equal(shouldFlowBack({ ...shopInvoice, metadata: {} }, eftPayment, 102), false);
    assert.equal(shouldFlowBack(null, eftPayment, 102), false);
    assert.equal(shouldFlowBack(shopInvoice, { ...eftPayment, profile_id: 5 }, 102), false);
  });

  await test('flow-back hook is a no-op without the flag (no env, no database)', async () => {
    const saved = { f: process.env.BFG_SYNC_ENABLED, u: process.env.BFG_SHOP_CALLBACK_URL };
    delete process.env.BFG_SYNC_ENABLED;
    delete process.env.BFG_SHOP_CALLBACK_URL;
    await afterArPaymentRecorded(eftPayment); // would throw on getSupabaseServer if it touched the database
    process.env.BFG_SYNC_ENABLED = 'true';
    process.env.BFG_SYNC_SIGNING_SECRET = SECRET;
    process.env.BFG_SYNC_PROFILE_ID = '102';
    await afterArPaymentRecorded({ ...eftPayment, created_by: 'bfg_shop_sync' }); // no callback url: returns early
    for (const k of ['BFG_SYNC_ENABLED', 'BFG_SYNC_SIGNING_SECRET', 'BFG_SYNC_PROFILE_ID']) delete process.env[k];
    if (saved.f) process.env.BFG_SYNC_ENABLED = saved.f;
    if (saved.u) process.env.BFG_SHOP_CALLBACK_URL = saved.u;
  });

  await test('flow-back body and signature (prefix bfg-sa-callback.v1.)', async () => {
    const { key, body } = buildPaymentRecordedBody({
      profileId: 102, invoice: shopInvoice, payment: eftPayment, paidTotalCents: 145003, sentAt: '2026-11-12T08:00:00.000Z',
    });
    assert.equal(key, 'invoice.payment_recorded:9012:55501');
    assert.deepEqual(body, {
      contract_version: '1.0',
      event: 'invoice.payment_recorded',
      idempotency_key: key,
      profile_id: 102,
      sent_at: '2026-11-12T08:00:00.000Z',
      data: {
        shop_order_reference: 'bfg-shop-abc123def',
        sa_invoice_id: 9012,
        sa_invoice_number: 'INV-20261110-CD34',
        sa_payment_id: 55501,
        payment_reference: 'FNB-EFT-20261112-001',
        method: 'eft',
        paid_at: '2026-11-12T07:55:00.000Z',
        amount_cents: 145003,
        amount_paid_total_cents: 145003,
        invoice_total_cents: 145003,
        invoice_status: 'paid',
      },
    });
    const part = buildPaymentRecordedBody({ profileId: 102, invoice: shopInvoice, payment: eftPayment, paidTotalCents: 100000, sentAt: 'x' });
    assert.equal((part.body.data as Row).invoice_status, 'partial');

    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;
    const bodyJson = JSON.stringify(body);
    const out = await sendCallback({ url: CONFIG.state === 'ok' ? CONFIG.callbackUrl! : '', secret: SECRET, key, bodyJson, nowMs: NOW, fetchImpl });
    assert.equal(out.ok, true);
    const h = (seen!.init.headers as Record<string, string>);
    assert.equal(h['x-bfg-event'], 'invoice.payment_recorded');
    assert.equal(h['x-bfg-idempotency-key'], key);
    assert.equal(h['user-agent'], 'supplieradvisor-bfg-sync/1.0');
    assert.equal(seen!.init.body, bodyJson, 'the exact raw body is signed and sent');
    assert.equal(verifyBfgSyncSignature({ secret: SECRET, timestamp: h['x-bfg-timestamp'], signature: h['x-bfg-signature'], rawBody: bodyJson, prefix: CALLBACK_SIGNING_PREFIX }), true);
    assert.equal(verifyBfgSyncSignature({ secret: SECRET, timestamp: h['x-bfg-timestamp'], signature: h['x-bfg-signature'], rawBody: bodyJson }), false, 'not valid for the request direction');
  });

  await test('flow-back retries with backoff, goes dead after 8 attempts or on a permanent error', async () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(callbackBackoffMs), [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000, 21_600_000, 21_600_000]);
    const rows: OutboxRow[] = [{ id: 1, profile_id: 102, idempotency_key: 'k1', body: '{}', attempts: 0 }];
    const log: string[] = [];
    const outbox: CallbackOutbox = {
      claimDue: async () => rows.splice(0, rows.length),
      markDone: async (id, a) => void log.push(`done:${id}:${a}`),
      markRetry: async (id, a, next, code) => void log.push(`retry:${id}:${a}:${next - NOW}:${code}`),
      markDead: async (id, a, code) => void log.push(`dead:${id}:${a}:${code}`),
    };
    const respond = (status: number, body: Row = {}) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    const base = { outbox, url: 'https://shop.example/cb', secret: SECRET, nowMs: NOW };

    await drainCallbacks({ ...base, fetchImpl: respond(503, { ok: false, error: { code: 'unavailable', retryable: true } }) });
    assert.deepEqual(log.splice(0), ['retry:1:1:60000:unavailable']);

    rows.push({ id: 2, profile_id: 102, idempotency_key: 'k2', body: '{}', attempts: 7 });
    await drainCallbacks({ ...base, fetchImpl: respond(500) });
    assert.deepEqual(log.splice(0), ['dead:2:8:http_500'], '8th failure is dead');

    rows.push({ id: 3, profile_id: 102, idempotency_key: 'k3', body: '{}', attempts: 0 });
    await drainCallbacks({ ...base, fetchImpl: respond(404, { ok: false, error: { code: 'order_not_found', retryable: false } }) });
    assert.deepEqual(log.splice(0), ['dead:3:1:order_not_found'], 'permanent 4xx is dead at once');

    rows.push({ id: 4, profile_id: 102, idempotency_key: 'k4', body: '{}', attempts: 2 });
    await drainCallbacks({ ...base, fetchImpl: (async () => { throw new Error('network'); }) as unknown as typeof fetch });
    assert.equal(log.splice(0)[0], 'retry:4:3:1800000:network');

    rows.push({ id: 5, profile_id: 102, idempotency_key: 'k5', body: '{}', attempts: 0 });
    await drainCallbacks({ ...base, fetchImpl: respond(200, { ok: true, result: 'applied' }) });
    assert.deepEqual(log.splice(0), ['done:5:1']);
  });

  await test('route POST with the flag off answers 503 JSON and touches no database', async () => {
    const saved = { ...process.env };
    for (const k of ['BFG_SYNC_ENABLED', 'BFG_SYNC_SIGNING_SECRET', 'BFG_SYNC_PROFILE_ID', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) delete process.env[k];
    try {
      const req = signedRequest(placed());
      const res = await POST(
        new NextRequest('https://www.supplieradvisor.com/api/webhooks/bfg-shop-sync', {
          method: 'POST',
          body: req.rawBody,
          headers: {
            'content-type': 'application/json',
            'x-bfg-timestamp': req.headers.timestamp as string,
            'x-bfg-signature': req.headers.signature as string,
            'x-bfg-idempotency-key': req.headers.idempotencyKey as string,
            'x-bfg-event': 'order.placed',
          },
        })
      );
      assert.equal(res.status, 503);
      assert.match(res.headers.get('content-type') || '', /application\/json/);
      const j = (await res.json()) as Row;
      assert.equal(j.ok, false);
      assert.equal((j.error as Row).code, 'unavailable');
    } finally {
      process.env = saved;
    }
  });

  console.log(`\n${passed} tests passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
