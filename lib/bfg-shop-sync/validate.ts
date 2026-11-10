/**
 * Hand-written validation for the shop sync envelope and event payloads
 * (contract v1.0, sections 2.3, 3 and 4). Failures list field paths only:
 * never the values, because they can hold personal data.
 */
import { CONTRACT_VERSION, SHOP_REFERENCE_PREFIX } from './config';
import { SyncError } from './errors';

export const EVENTS = [
  'customer.upsert',
  'order.placed',
  'order.paid',
  'order.cancelled',
  'order.status',
  'order.refund',
] as const;
export type SyncEventName = (typeof EVENTS)[number];

type Obj = Record<string, unknown>;

export type Address = {
  line1: string;
  line2: string;
  city: string;
  province: string;
  region: string;
  postal_code: string;
  country: string;
  formatted: string;
};

export type CustomerSnapshot = {
  shop_customer_id: string;
  origin: 'shop' | 'supplieradvisor';
  fill_blanks_only: boolean;
  status_hint: 'prospect' | 'active';
  trading_name: string;
  legal_name: string;
  email: string;
  contact_name: string;
  phone: string;
  job_title: string;
  website: string;
  industry: string;
  logo_url: string;
  vat_number: string;
  registration_number: string;
  customer_type: 'ngo' | 'business';
  billing_address: Address;
  shipping_address: Address;
  payment_terms: string;
  payment_terms_code: string;
  credit_limit_cents: number | null;
  sales_rep_name: string;
  source_customer_id: number | null;
  email_is_internal_domain: boolean;
};

export type OrderLine = {
  shop_product_id: string;
  sku: string;
  name: string;
  pack: string;
  description: string;
  division: string;
  quantity: number;
  unit_ex_vat_cents: number;
  line_ex_vat_cents: number;
  line_vat_cents: number;
  line_inc_vat_cents: number;
  vat_rate_pct: number;
};

export type Transport = {
  status: 'charged' | 'quoted';
  ex_vat_cents: number;
  vat_cents: number;
  inc_vat_cents: number;
  label: string;
};

export type Totals = {
  currency: string;
  subtotal_ex_vat_cents: number;
  vat_cents: number;
  total_inc_vat_cents: number;
  vat_rate_pct: number;
};

export type Destination = {
  position: number;
  contact_name: string;
  phone: string;
  address: string;
  region_name: string;
  delivery_date: string | null;
};

export type OrderPlaced = {
  shop_order_id: string;
  reference: string;
  placed_at: string;
  issue_date: string;
  due_date: string;
  payment_method: 'card' | 'on_account';
  payment_status: string;
  fulfilment_status: string;
  payment_terms: string;
  payment_terms_code: string;
  customer: CustomerSnapshot;
  contact: { name: string; email: string; phone: string };
  billing_address: Address;
  shipping: { summary: string; destinations: Destination[] };
  lines: OrderLine[];
  transport: Transport;
  totals: Totals;
  sales_rep_name: string;
  expected_delivery_date: string | null;
  notes: string;
};

export type OrderPaid = {
  reference: string;
  payment_reference: string;
  paystack_reference: string | null;
  method: 'paystack' | 'on_account_receipt';
  channel: string;
  amount_cents: number;
  currency: string;
  paid_at: string;
  note: string;
};

export type OrderCancelled = {
  reference: string;
  reason: 'expired_unpaid' | 'cancelled_by_customer' | 'cancelled_by_staff' | 'payment_failed';
  cancelled_at: string;
  paid_at: string | null;
  note: string;
};

export type OrderStatus = {
  reference: string;
  fulfilment_status: string;
  payment_status: string;
  courier: string;
  tracking_reference: string;
  expected_delivery_date: string | null;
  delivered_at: string | null;
};

export type OrderRefund = {
  reference: string;
  refunded_at: string;
  amount_cents: number;
  paystack_reference: string | null;
  reason: string;
  note: string;
};

export type Envelope = {
  contract_version: string;
  event: SyncEventName;
  idempotency_key: string;
  state_version: string;
  sent_at: string;
  dry_run: boolean;
  profile_id: number;
  outbox_id: string;
  attempt: number;
};

export type ParsedEvent =
  | { event: 'customer.upsert'; data: CustomerSnapshot }
  | { event: 'order.placed'; data: OrderPlaced }
  | { event: 'order.paid'; data: OrderPaid }
  | { event: 'order.cancelled'; data: OrderCancelled }
  | { event: 'order.status'; data: OrderStatus }
  | { event: 'order.refund'; data: OrderRefund };

const KEY_RE = /^[A-Za-z0-9:._-]{1,200}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isObj(v: unknown): v is Obj {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

class Checker {
  readonly fields: string[] = [];
  bad(path: string) {
    if (!this.fields.includes(path)) this.fields.push(path);
  }
  obj(v: unknown, path: string): Obj {
    if (!isObj(v)) {
      this.bad(path);
      return {};
    }
    return v;
  }
  /** Required non-empty string. */
  str(v: unknown, path: string): string {
    if (typeof v !== 'string' || !v.trim()) {
      this.bad(path);
      return '';
    }
    return v;
  }
  /** Optional string: null, undefined and "" become "". */
  optStr(v: unknown, path: string): string {
    if (v == null) return '';
    if (typeof v !== 'string') {
      this.bad(path);
      return '';
    }
    return v;
  }
  /** Optional string or null (kept as null). */
  nullableStr(v: unknown, path: string): string | null {
    if (v == null || v === '') return null;
    if (typeof v !== 'string') {
      this.bad(path);
      return null;
    }
    return v;
  }
  date(v: unknown, path: string): string {
    if (typeof v !== 'string' || !DATE_RE.test(v)) {
      this.bad(path);
      return '';
    }
    return v;
  }
  nullableDate(v: unknown, path: string): string | null {
    if (v == null || v === '') return null;
    return this.date(v, path) || null;
  }
  ts(v: unknown, path: string): string {
    if (typeof v !== 'string' || !v.trim() || Number.isNaN(Date.parse(v))) {
      this.bad(path);
      return '';
    }
    return v;
  }
  nullableTs(v: unknown, path: string): string | null {
    if (v == null || v === '') return null;
    return this.ts(v, path) || null;
  }
  cents(v: unknown, path: string, opts: { min?: number } = {}): number {
    const min = opts.min ?? 0;
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min) {
      this.bad(path);
      return 0;
    }
    return v;
  }
  posInt(v: unknown, path: string): number {
    return this.cents(v, path, { min: 1 });
  }
  oneOf<T extends string>(v: unknown, allowed: readonly T[], path: string, fallback: T): T {
    if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
      this.bad(path);
      return fallback;
    }
    return v as T;
  }
  bool(v: unknown, path: string, fallback = false): boolean {
    if (v == null) return fallback;
    if (typeof v !== 'boolean') {
      this.bad(path);
      return fallback;
    }
    return v;
  }
}

function address(c: Checker, raw: unknown, path: string): Address {
  const o = raw == null ? {} : c.obj(raw, path);
  return {
    line1: c.optStr(o.line1, `${path}.line1`),
    line2: c.optStr(o.line2, `${path}.line2`),
    city: c.optStr(o.city, `${path}.city`),
    province: c.optStr(o.province, `${path}.province`),
    region: c.optStr(o.region, `${path}.region`),
    postal_code: c.optStr(o.postal_code, `${path}.postal_code`),
    country: c.optStr(o.country, `${path}.country`),
    formatted: c.optStr(o.formatted, `${path}.formatted`),
  };
}

function customer(c: Checker, raw: unknown, path: string): CustomerSnapshot {
  const o = c.obj(raw, path);
  const hints = o.match_hints == null ? {} : c.obj(o.match_hints, `${path}.match_hints`);
  let sourceId: number | null = null;
  if (hints.source_customer_id != null) {
    const n = Number(hints.source_customer_id);
    if (Number.isSafeInteger(n) && n > 0) sourceId = n;
    else c.bad(`${path}.match_hints.source_customer_id`);
  }
  let credit: number | null = null;
  if (o.credit_limit_cents != null) {
    credit = c.cents(o.credit_limit_cents, `${path}.credit_limit_cents`);
  }
  return {
    shop_customer_id: c.str(o.shop_customer_id, `${path}.shop_customer_id`),
    origin: c.oneOf(o.origin, ['shop', 'supplieradvisor'] as const, `${path}.origin`, 'shop'),
    fill_blanks_only: c.bool(o.fill_blanks_only, `${path}.fill_blanks_only`),
    status_hint:
      o.status_hint == null
        ? 'prospect'
        : c.oneOf(o.status_hint, ['prospect', 'active'] as const, `${path}.status_hint`, 'prospect'),
    trading_name: c.optStr(o.trading_name, `${path}.trading_name`),
    legal_name: c.optStr(o.legal_name, `${path}.legal_name`),
    email: c.optStr(o.email, `${path}.email`).trim().toLowerCase(),
    contact_name: c.optStr(o.contact_name, `${path}.contact_name`),
    phone: c.optStr(o.phone, `${path}.phone`),
    job_title: c.optStr(o.job_title, `${path}.job_title`),
    website: c.optStr(o.website, `${path}.website`),
    industry: c.optStr(o.industry, `${path}.industry`),
    logo_url: c.optStr(o.logo_url, `${path}.logo_url`),
    vat_number: c.optStr(o.vat_number, `${path}.vat_number`),
    registration_number: c.optStr(o.registration_number, `${path}.registration_number`),
    customer_type:
      o.customer_type == null
        ? 'business'
        : c.oneOf(o.customer_type, ['ngo', 'business'] as const, `${path}.customer_type`, 'business'),
    billing_address: address(c, o.billing_address, `${path}.billing_address`),
    shipping_address: address(c, o.shipping_address, `${path}.shipping_address`),
    payment_terms: c.optStr(o.payment_terms, `${path}.payment_terms`),
    payment_terms_code: c.optStr(o.payment_terms_code, `${path}.payment_terms_code`),
    credit_limit_cents: credit,
    sales_rep_name: c.optStr(o.sales_rep_name, `${path}.sales_rep_name`),
    source_customer_id: sourceId,
    email_is_internal_domain: c.bool(
      hints.email_is_internal_domain,
      `${path}.match_hints.email_is_internal_domain`
    ),
  };
}

function reference(c: Checker, v: unknown, path: string): string {
  const s = c.str(v, path);
  if (s && !s.startsWith(SHOP_REFERENCE_PREFIX)) c.bad(path);
  return s;
}

function line(c: Checker, raw: unknown, path: string): OrderLine {
  const o = c.obj(raw, path);
  const rate = o.vat_rate_pct;
  if (typeof rate !== 'number' || rate !== 15) c.bad(`${path}.vat_rate_pct`);
  return {
    shop_product_id: c.str(o.shop_product_id, `${path}.shop_product_id`),
    sku: c.optStr(o.sku, `${path}.sku`),
    name: c.str(o.name, `${path}.name`),
    pack: c.optStr(o.pack, `${path}.pack`),
    description: c.optStr(o.description, `${path}.description`),
    division: c.optStr(o.division, `${path}.division`),
    quantity: c.posInt(o.quantity, `${path}.quantity`),
    unit_ex_vat_cents: c.cents(o.unit_ex_vat_cents, `${path}.unit_ex_vat_cents`),
    line_ex_vat_cents: c.cents(o.line_ex_vat_cents, `${path}.line_ex_vat_cents`),
    line_vat_cents: c.cents(o.line_vat_cents, `${path}.line_vat_cents`),
    line_inc_vat_cents: c.cents(o.line_inc_vat_cents, `${path}.line_inc_vat_cents`),
    vat_rate_pct: 15,
  };
}

function orderPlaced(c: Checker, d: Obj): OrderPlaced {
  const linesRaw = Array.isArray(d.lines) ? d.lines : null;
  if (!linesRaw || linesRaw.length === 0) c.bad('data.lines');
  const t = c.obj(d.transport, 'data.transport');
  const tot = c.obj(d.totals, 'data.totals');
  if (typeof tot.vat_rate_pct !== 'number' || tot.vat_rate_pct !== 15) {
    c.bad('data.totals.vat_rate_pct');
  }
  const destinationsRaw = isObj(d.shipping) && Array.isArray(d.shipping.destinations)
    ? d.shipping.destinations
    : [];
  const ship = d.shipping == null ? {} : c.obj(d.shipping, 'data.shipping');
  const contact = d.contact == null ? {} : c.obj(d.contact, 'data.contact');
  return {
    shop_order_id: c.str(d.shop_order_id, 'data.shop_order_id'),
    reference: reference(c, d.reference, 'data.reference'),
    placed_at: c.ts(d.placed_at, 'data.placed_at'),
    issue_date: c.date(d.issue_date, 'data.issue_date'),
    due_date: c.date(d.due_date, 'data.due_date'),
    payment_method: c.oneOf(d.payment_method, ['card', 'on_account'] as const, 'data.payment_method', 'card'),
    payment_status: c.optStr(d.payment_status, 'data.payment_status'),
    fulfilment_status: c.optStr(d.fulfilment_status, 'data.fulfilment_status'),
    payment_terms: c.optStr(d.payment_terms, 'data.payment_terms'),
    payment_terms_code: c.optStr(d.payment_terms_code, 'data.payment_terms_code'),
    customer: customer(c, d.customer, 'data.customer'),
    contact: {
      name: c.optStr(contact.name, 'data.contact.name'),
      email: c.optStr(contact.email, 'data.contact.email').trim().toLowerCase(),
      phone: c.optStr(contact.phone, 'data.contact.phone'),
    },
    billing_address: address(c, d.billing_address, 'data.billing_address'),
    shipping: {
      summary: c.optStr(ship.summary, 'data.shipping.summary'),
      destinations: destinationsRaw.map((raw, i): Destination => {
        const p = `data.shipping.destinations[${i}]`;
        const o = c.obj(raw, p);
        return {
          position: typeof o.position === 'number' ? o.position : i + 1,
          contact_name: c.optStr(o.contact_name, `${p}.contact_name`),
          phone: c.optStr(o.phone, `${p}.phone`),
          address: c.optStr(o.address, `${p}.address`),
          region_name: c.optStr(o.region_name, `${p}.region_name`),
          delivery_date: c.nullableDate(o.delivery_date, `${p}.delivery_date`),
        };
      }),
    },
    lines: (linesRaw || []).map((raw, i) => line(c, raw, `data.lines[${i}]`)),
    transport: {
      status: c.oneOf(t.status, ['charged', 'quoted'] as const, 'data.transport.status', 'quoted'),
      ex_vat_cents: c.cents(t.ex_vat_cents, 'data.transport.ex_vat_cents'),
      vat_cents: c.cents(t.vat_cents, 'data.transport.vat_cents'),
      inc_vat_cents: c.cents(t.inc_vat_cents, 'data.transport.inc_vat_cents'),
      label: c.optStr(t.label, 'data.transport.label') || 'Transport',
    },
    totals: {
      currency: c.str(tot.currency, 'data.totals.currency'),
      subtotal_ex_vat_cents: c.cents(tot.subtotal_ex_vat_cents, 'data.totals.subtotal_ex_vat_cents'),
      vat_cents: c.cents(tot.vat_cents, 'data.totals.vat_cents'),
      total_inc_vat_cents: c.cents(tot.total_inc_vat_cents, 'data.totals.total_inc_vat_cents'),
      vat_rate_pct: 15,
    },
    sales_rep_name: c.optStr(d.sales_rep_name, 'data.sales_rep_name'),
    expected_delivery_date: c.nullableDate(d.expected_delivery_date, 'data.expected_delivery_date'),
    notes: c.optStr(d.notes, 'data.notes'),
  };
}

function orderPaid(c: Checker, d: Obj): OrderPaid {
  const currency = c.str(d.currency, 'data.currency');
  if (currency && currency !== 'ZAR') c.bad('data.currency');
  return {
    reference: reference(c, d.reference, 'data.reference'),
    payment_reference: c.str(d.payment_reference, 'data.payment_reference'),
    paystack_reference: c.nullableStr(d.paystack_reference, 'data.paystack_reference'),
    method: c.oneOf(d.method, ['paystack', 'on_account_receipt'] as const, 'data.method', 'paystack'),
    channel: c.optStr(d.channel, 'data.channel'),
    amount_cents: c.posInt(d.amount_cents, 'data.amount_cents'),
    currency: 'ZAR',
    paid_at: c.ts(d.paid_at, 'data.paid_at'),
    note: c.optStr(d.note, 'data.note'),
  };
}

function orderCancelled(c: Checker, d: Obj): OrderCancelled {
  return {
    reference: reference(c, d.reference, 'data.reference'),
    reason: c.oneOf(
      d.reason,
      ['expired_unpaid', 'cancelled_by_customer', 'cancelled_by_staff', 'payment_failed'] as const,
      'data.reason',
      'cancelled_by_staff'
    ),
    cancelled_at: c.ts(d.cancelled_at, 'data.cancelled_at'),
    paid_at: c.nullableTs(d.paid_at, 'data.paid_at'),
    note: c.optStr(d.note, 'data.note'),
  };
}

function orderStatus(c: Checker, d: Obj): OrderStatus {
  return {
    reference: reference(c, d.reference, 'data.reference'),
    fulfilment_status: c.str(d.fulfilment_status, 'data.fulfilment_status').toLowerCase(),
    payment_status: c.optStr(d.payment_status, 'data.payment_status'),
    courier: c.optStr(d.courier, 'data.courier'),
    tracking_reference: c.optStr(d.tracking_reference, 'data.tracking_reference'),
    expected_delivery_date: c.nullableDate(d.expected_delivery_date, 'data.expected_delivery_date'),
    delivered_at: c.nullableTs(d.delivered_at, 'data.delivered_at'),
  };
}

function orderRefund(c: Checker, d: Obj): OrderRefund {
  return {
    reference: reference(c, d.reference, 'data.reference'),
    refunded_at: c.ts(d.refunded_at, 'data.refunded_at'),
    amount_cents: c.cents(d.amount_cents, 'data.amount_cents', { min: 0 }),
    paystack_reference: c.nullableStr(d.paystack_reference, 'data.paystack_reference'),
    reason: c.optStr(d.reason, 'data.reason'),
    note: c.optStr(d.note, 'data.note'),
  };
}

/**
 * Parse the JSON envelope. The order of the checks follows the contract:
 * not JSON / not an object -> bad_request, version -> unsupported_version,
 * event -> unknown_event, then field shape -> validation_failed, then
 * the profile allow-list -> profile_not_allowed.
 */
export function parseEnvelope(
  body: unknown,
  headers: { event: string | null; idempotencyKey: string | null }
): { envelope: Envelope; data: Obj } {
  if (!isObj(body)) {
    throw new SyncError('bad_request', 'Body must be a JSON object.');
  }
  const version = typeof body.contract_version === 'string' ? body.contract_version : '';
  if (!version) throw new SyncError('bad_request', 'contract_version is required.');
  if (version.split('.')[0] !== CONTRACT_VERSION.split('.')[0]) {
    throw new SyncError('unsupported_version', 'Unsupported contract_version.');
  }
  const event = typeof body.event === 'string' ? body.event : '';
  if (!event) throw new SyncError('bad_request', 'event is required.');
  if (!(EVENTS as readonly string[]).includes(event)) {
    throw new SyncError('unknown_event', 'Unknown event.');
  }
  const key = typeof body.idempotency_key === 'string' ? body.idempotency_key : '';
  if (!key) throw new SyncError('bad_request', 'idempotency_key is required.');
  if (headers.event && headers.event !== event) {
    throw new SyncError('bad_request', 'X-BFG-Event does not match the body.');
  }
  if (!headers.idempotencyKey) {
    throw new SyncError('bad_request', 'X-BFG-Idempotency-Key is required.');
  }
  if (headers.idempotencyKey !== key) {
    throw new SyncError('bad_request', 'X-BFG-Idempotency-Key does not match the body.');
  }

  const c = new Checker();
  if (!KEY_RE.test(key)) c.bad('idempotency_key');
  const stateVersion = c.ts(body.state_version, 'state_version');
  if (typeof body.profile_id !== 'number' || !Number.isSafeInteger(body.profile_id)) {
    c.bad('profile_id');
  }
  const dryRun = c.bool(body.dry_run, 'dry_run');
  if (!isObj(body.data)) c.bad('data');
  if (c.fields.length) {
    throw new SyncError('validation_failed', 'Schema validation failed.', { fields: c.fields });
  }
  return {
    envelope: {
      contract_version: version,
      event: event as SyncEventName,
      idempotency_key: key,
      state_version: stateVersion,
      sent_at: typeof body.sent_at === 'string' ? body.sent_at : '',
      dry_run: dryRun,
      profile_id: body.profile_id as number,
      outbox_id: typeof body.outbox_id === 'string' ? body.outbox_id : '',
      attempt: typeof body.attempt === 'number' ? body.attempt : 0,
    },
    data: body.data as Obj,
  };
}

/** Validate `data` for the event. Throws validation_failed with field paths. */
export function parseEventData(event: SyncEventName, data: Obj): ParsedEvent {
  const c = new Checker();
  let parsed: ParsedEvent;
  switch (event) {
    case 'customer.upsert':
      parsed = { event, data: customer(c, data, 'data') };
      break;
    case 'order.placed':
      parsed = { event, data: orderPlaced(c, data) };
      break;
    case 'order.paid':
      parsed = { event, data: orderPaid(c, data) };
      break;
    case 'order.cancelled':
      parsed = { event, data: orderCancelled(c, data) };
      break;
    case 'order.status':
      parsed = { event, data: orderStatus(c, data) };
      break;
    case 'order.refund':
      parsed = { event, data: orderRefund(c, data) };
      break;
  }
  if (c.fields.length) {
    throw new SyncError('validation_failed', 'Schema validation failed.', { fields: c.fields });
  }
  return parsed;
}
