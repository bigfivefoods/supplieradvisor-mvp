/**
 * Customer match / create / update (contract v1.0, sections 3.1 and 4.1).
 *
 * Match order, stop at the first hit:
 *  1 metadata.shop_customer_id link
 *  2 match_hints.source_customer_id
 *  3 VAT number, digits only, unique hit
 *  4 registration number, unique hit
 *  5 email, only if exactly one hit, not an internal Big Five domain, and not a
 *    sister company / supplier
 *  6 name NEVER auto-matches: create a new customer and report possible_duplicate
 *  7 create
 */
import {
  SHOP_CUSTOMER_SOURCE,
  SHOP_ORIGIN,
  SYNC_ACTOR,
} from './config';
import { SyncError } from './errors';
import {
  addressText,
  asMeta,
  digitsOnly,
  isInternalEmail,
  isStaleVersion,
  normaliseRegistration,
  paymentTermsLabel,
} from './mapping';
import { centsToRands } from './money';
import type { Row, SyncPorts } from './ports';
import type { CustomerSnapshot } from './validate';

export type PossibleDuplicate = {
  shop_customer_id: string;
  sa_customer_ids: number[];
  reason: 'name_match';
};

export type CustomerPlan = {
  existing: Row | null;
  matchedBy: 'shop_link' | 'source_customer_id' | 'vat' | 'registration' | 'email' | null;
  possibleDuplicate: PossibleDuplicate | null;
};

export type CustomerOutcome = {
  row: Row;
  created: boolean;
  changed: boolean;
  stale: boolean;
  possibleDuplicate: PossibleDuplicate | null;
};

const num = (v: unknown) => Number(v || 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function displayName(c: CustomerSnapshot): string {
  return (c.trading_name || c.legal_name || c.contact_name).trim();
}

/** Step 5 exclusion: a sister company or supplier is never matched by email. */
function emailMatchAllowed(candidate: Row): boolean {
  if (num(candidate.linked_profile_id) > 0) return false;
  const meta = asMeta(candidate.metadata);
  const role = String(meta.party_book_role || meta.book_role || '').toLowerCase();
  if (role === 'supplier' || role === 'both') return false;
  if (meta.sister_company === true) return false;
  return true;
}

export async function planCustomer(
  ports: SyncPorts,
  profileId: number,
  c: CustomerSnapshot
): Promise<CustomerPlan> {
  const { store } = ports;
  const none = (dup: PossibleDuplicate | null): CustomerPlan => ({
    existing: null,
    matchedBy: null,
    possibleDuplicate: dup,
  });

  const linked = await store.customerByShopId(profileId, c.shop_customer_id);
  if (linked) return { existing: linked, matchedBy: 'shop_link', possibleDuplicate: null };

  if (c.source_customer_id) {
    const byId = await store.customerById(profileId, c.source_customer_id);
    if (byId) return { existing: byId, matchedBy: 'source_customer_id', possibleDuplicate: null };
  }

  const vat = digitsOnly(c.vat_number);
  if (vat.length >= 5) {
    const hits = (await store.customersByVat(profileId, vat)).filter(
      (r) => digitsOnly(str(r.vat_number)) === vat
    );
    if (hits.length === 1) return { existing: hits[0], matchedBy: 'vat', possibleDuplicate: null };
  }

  const reg = normaliseRegistration(c.registration_number);
  if (reg.length >= 4) {
    const hits = (await store.customersByRegistration(profileId, reg)).filter(
      (r) => normaliseRegistration(str(r.registration_number)) === reg
    );
    if (hits.length === 1) {
      return { existing: hits[0], matchedBy: 'registration', possibleDuplicate: null };
    }
  }

  if (c.email && !c.email_is_internal_domain && !isInternalEmail(c.email)) {
    const hits = await store.customersByEmail(profileId, c.email);
    if (hits.length === 1 && emailMatchAllowed(hits[0])) {
      return { existing: hits[0], matchedBy: 'email', possibleDuplicate: null };
    }
  }

  // Name never auto-matches. Report the near hits so a person can decide.
  const name = displayName(c);
  if (name) {
    const hits = await store.customersByName(profileId, name);
    const ids = hits.map((r) => num(r.id)).filter((n) => n > 0);
    if (ids.length) {
      return none({
        shop_customer_id: c.shop_customer_id,
        sa_customer_ids: ids,
        reason: 'name_match',
      });
    }
  }
  return none(null);
}

function addressColumns(c: CustomerSnapshot): Row {
  const b = c.billing_address;
  return {
    billing_address: addressText(b) || null,
    shipping_address: addressText(c.shipping_address) || null,
    city: b.city || null,
    province: b.province || null,
    region: b.region || null,
    postal_code: b.postal_code || null,
    country: b.country || null,
  };
}

/** Columns the snapshot may set. Never invite_*, rating, bank, sa_*, source_metadata... */
function snapshotColumns(c: CustomerSnapshot, includeCommercial: boolean): Row {
  const cols: Row = {
    trading_name: displayName(c) || null,
    legal_name: c.legal_name || null,
    email: c.email || null,
    contact_name: c.contact_name || null,
    phone: c.phone || null,
    job_title: c.job_title || null,
    website: c.website || null,
    industry: c.industry || null,
    logo_url: c.logo_url || null,
    vat_number: c.vat_number || null,
    registration_number: c.registration_number || null,
    customer_type: c.customer_type,
    ...addressColumns(c),
  };
  if (includeCommercial) {
    cols.payment_terms = paymentTermsLabel(c.payment_terms, c.payment_terms_code) || null;
    if (c.credit_limit_cents != null) cols.credit_limit = centsToRands(c.credit_limit_cents);
    // Text only. sales_rep_user_id is never set.
    cols.sales_rep_name = c.sales_rep_name || null;
  }
  return cols;
}

const isBlank = (v: unknown) => v == null || (typeof v === 'string' && !v.trim());

/**
 * Build the update patch.
 * - origin "shop": the web wins. Non-empty snapshot values overwrite.
 * - origin "supplieradvisor" (fill_blanks_only): only blank columns are filled.
 *   Terms, credit limit, rep and status are never touched.
 */
export function customerPatch(
  existing: Row,
  c: CustomerSnapshot,
  opts: { statusActive: boolean }
): Row {
  const fillOnly = c.origin === 'supplieradvisor' || c.fill_blanks_only;
  const cols = snapshotColumns(c, c.origin === 'shop');
  const patch: Row = {};
  for (const [k, v] of Object.entries(cols)) {
    if (isBlank(v)) continue; // an empty value never blanks an existing one
    if (fillOnly && !isBlank(existing[k])) continue;
    if (String(existing[k] ?? '') === String(v)) continue;
    patch[k] = v;
  }
  if (!fillOnly && opts.statusActive && String(existing.status || '') === 'prospect') {
    patch.status = 'active';
  }
  return patch;
}

export function newCustomerRow(
  profileId: number,
  c: CustomerSnapshot,
  statusActive: boolean,
  stateVersion: string
): Row {
  const row: Row = {
    profile_id: profileId,
    ...snapshotColumns(c, true),
    status: statusActive || c.status_hint === 'active' ? 'active' : 'prospect',
    source: SHOP_CUSTOMER_SOURCE,
    currency: 'ZAR',
    created_by: SYNC_ACTOR,
    metadata: {
      shop_customer_id: c.shop_customer_id,
      origin: SHOP_ORIGIN,
      shop_state_version: stateVersion,
    },
  };
  for (const k of Object.keys(row)) if (row[k] === null) delete row[k];
  return row;
}

/**
 * Resolve (match or create) the customer. Writes only when `write` is true.
 * `forbidCreate` is set for a payload whose origin is "supplieradvisor":
 * an imported customer must already exist, it is never created from the web.
 */
export async function resolveCustomer(args: {
  ports: SyncPorts;
  profileId: number;
  snapshot: CustomerSnapshot;
  stateVersion: string;
  /** order.placed: the customer is active and the state version is not compared. */
  forOrder: boolean;
  write: boolean;
  plan?: CustomerPlan;
}): Promise<CustomerOutcome> {
  const { ports, profileId, snapshot: c, stateVersion } = args;
  const { store, books } = ports;
  if (!displayName(c)) {
    throw new SyncError('customer_unresolvable', 'Customer has no usable name.');
  }
  const plan = args.plan ?? (await planCustomer(ports, profileId, c));
  const statusActive = args.forOrder || c.status_hint === 'active';

  if (!plan.existing) {
    if (c.origin === 'supplieradvisor') {
      throw new SyncError(
        'origin_not_allowed',
        'An imported SupplierAdvisor® customer cannot be created from the web.'
      );
    }
    if (!args.write) {
      return {
        row: {},
        created: true,
        changed: true,
        stale: false,
        possibleDuplicate: plan.possibleDuplicate,
      };
    }
    const ins = await store.insertCustomer(newCustomerRow(profileId, c, statusActive, stateVersion));
    if (!ins.ok) {
      // A concurrent request created the same shop customer: use that row.
      const again = await store.customerByShopId(profileId, c.shop_customer_id);
      if (!again) throw new SyncError('conflict_in_progress', 'Customer is being created.');
      return {
        row: again,
        created: false,
        changed: false,
        stale: false,
        possibleDuplicate: plan.possibleDuplicate,
      };
    }
    await books.ensurePartyGl(profileId);
    return {
      row: ins.row,
      created: true,
      changed: true,
      stale: false,
      possibleDuplicate: plan.possibleDuplicate,
    };
  }

  const existing = plan.existing;
  const meta = asMeta(existing.metadata);
  if (!args.forOrder && isStaleVersion(meta.shop_state_version, stateVersion)) {
    return { row: existing, created: false, changed: false, stale: true, possibleDuplicate: null };
  }
  const patch = customerPatch(existing, c, { statusActive });
  const metaPatch: Row = { ...meta };
  let metaChanged = false;
  // Link the shop customer unless this SA customer already carries another link.
  if (!meta.shop_customer_id && c.origin === 'shop') {
    metaPatch.shop_customer_id = c.shop_customer_id;
    metaPatch.shop_link_origin = SHOP_ORIGIN;
    metaChanged = true;
  }
  if (!args.forOrder && c.origin === 'shop' && meta.shop_customer_id === c.shop_customer_id) {
    metaPatch.shop_state_version = stateVersion;
    metaChanged = true;
  }
  const changed = Object.keys(patch).length > 0;
  if (!args.write || (!changed && !metaChanged)) {
    return { row: existing, created: false, changed, stale: false, possibleDuplicate: null };
  }
  if (metaChanged) patch.metadata = metaPatch;
  patch.updated_at = new Date(ports.nowMs()).toISOString();
  const row = await store.updateCustomer(profileId, num(existing.id), patch);
  return { row, created: false, changed, stale: false, possibleDuplicate: null };
}
