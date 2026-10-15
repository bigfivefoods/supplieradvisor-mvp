/**
 * ConstructionAdvisor® (constructiongraph) — building / construction OS.
 * The book stays in profiles.metadata.constructiongraph. Portal guess
 * counters live in construction_portal_attempts (separate migration).
 * Distinct from Core Projects — this hub is the industry site OS.
 *
 * Client → many projects (sites) → BOQ quotes → programme plan vs actuals
 * → progress-payment dates (claim / certify / client pay) → cost allocation
 * → certificates → programme roll-up reports.
 */
import { sha256Hex } from './sha256';

export const CONSTRUCTIONGRAPH_MODULE_ID = 'constructiongraph' as const;
export const CONSTRUCTIONGRAPH_META_KEY = 'constructiongraph' as const;
export const CONSTRUCTIONGRAPH_PACK_ID = 'construction_building' as const;
export const CONSTRUCTIONGRAPH_TOKEN_KEY = 'constructiongraph_public_token' as const;
export const CONSTRUCTIONGRAPH_TOKENS_KEY = 'constructiongraph_tokens' as const;
export const CONSTRUCTIONGRAPH_HASH_KEY = 'constructiongraph_token_hashes' as const;
export const CONSTRUCTIONGRAPH_AUDIT_KEY = 'constructiongraph_audit' as const;

export const SITE_STATUSES = [
  'tender',
  'awarded',
  'on_site',
  'practical_completion',
  'final_account',
  'closed',
] as const;

export const CONTRACT_TYPES = ['JBCC', 'GCC', 'NEC', 'FIDIC', 'other'] as const;

export const DRAWING_DISCIPLINES = [
  'architectural',
  'structural',
  'civil',
  'electrical',
  'mechanical',
  'other',
] as const;

export const QUOTE_STATUSES = [
  'draft',
  'issued',
  'accepted',
  'declined',
] as const;

export const COST_KINDS = [
  'labour',
  'material',
  'plant',
  'subcontract',
  'other',
] as const;

export const PAYMENT_STATUSES = [
  'planned',
  'claimed',
  'certified',
  'paid',
  'overdue',
] as const;

export type ConstructionSiteStatus = (typeof SITE_STATUSES)[number];
export type ConstructionContractType = (typeof CONTRACT_TYPES)[number];
export type ConstructionQuoteStatus = (typeof QUOTE_STATUSES)[number];
export type ConstructionCostKind = (typeof COST_KINDS)[number];
export type ConstructionPaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type ConstructionClient = {
  id: string;
  name: string;
  crm_customer_id?: number | null;
  city?: string;
  contact?: string;
  notes?: string;
};

export type ConstructionSite = {
  id: string;
  code: string;
  name: string;
  client_id?: string | null;
  client?: string;
  quote_id?: string | null;
  contract_value?: number | null;
  address?: string;
  city?: string;
  province?: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: ConstructionSiteStatus | string;
  contract_type?: ConstructionContractType | string;
  notes?: string;
};

export type ConstructionQuote = {
  id: string;
  number: string;
  title: string;
  client_id?: string | null;
  site_id?: string | null;
  status?: ConstructionQuoteStatus | string;
  issued_at?: string | null;
  accepted_at?: string | null;
  notes?: string;
};

export type ConstructionDrawing = {
  id: string;
  site_id?: string | null;
  drawing_no: string;
  title: string;
  revision?: string;
  discipline?: (typeof DRAWING_DISCIPLINES)[number] | string;
  status?: 'issued' | 'superseded' | 'for_construction' | 'as_built' | string;
};

export type ConstructionBoqItem = {
  id: string;
  site_id?: string | null;
  quote_id?: string | null;
  item_no: string;
  description: string;
  uom: string;
  qty: number;
  rate: number;
  amount?: number;
  actual_qty?: number;
  actual_amount?: number;
};

export type ConstructionCost = {
  id: string;
  site_id?: string | null;
  boq_id?: string | null;
  kind: ConstructionCostKind | string;
  description: string;
  amount: number;
  date?: string | null;
  cost_code?: string;
};

export type ConstructionSubcontractor = {
  id: string;
  name: string;
  trade: string;
  site_id?: string | null;
  contact?: string;
  status?: 'appointed' | 'tendering' | 'complete' | string;
  contract_value?: number | null;
};

export type ConstructionMaterial = {
  id: string;
  site_id?: string | null;
  item: string;
  uom: string;
  ordered_qty: number;
  delivered_qty?: number;
  po_number?: string | null;
};

export type ConstructionPlant = {
  id: string;
  site_id?: string | null;
  plant_no: string;
  description: string;
  status?: 'on_site' | 'off_hire' | 'breakdown' | string;
  hired?: boolean;
};

export type ConstructionProgrammeRow = {
  id: string;
  site_id?: string | null;
  activity: string;
  start_date?: string | null;
  end_date?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  pct_complete?: number;
  planned_pct?: number;
  actual_pct?: number;
  status?: 'planned' | 'in_progress' | 'complete' | 'delayed' | string;
};

export type ConstructionSafetyRow = {
  id: string;
  site_id?: string | null;
  kind: 'toolbox' | 'incident' | 'inspection' | 'permit' | string;
  title: string;
  date?: string | null;
  status?: 'open' | 'closed' | string;
  notes?: string;
};

export type ConstructionVariation = {
  id: string;
  site_id?: string | null;
  number: string;
  description: string;
  amount?: number | null;
  status?: 'draft' | 'submitted' | 'approved' | 'rejected' | 'claimed' | string;
};

export type ConstructionCertificate = {
  id: string;
  site_id?: string | null;
  number: string;
  period?: string | null;
  certified_amount?: number | null;
  retention?: number | null;
  issued_at?: string | null;
  paid_at?: string | null;
  paid_amount?: number | null;
  status?: 'draft' | 'issued' | 'paid' | string;
};

/** Dated progress payment on the project plan (JBCC-style claim → certify → pay). */
export type ConstructionProgressPayment = {
  id: string;
  site_id?: string | null;
  programme_id?: string | null;
  certificate_id?: string | null;
  number: string;
  title: string;
  planned_claim_date?: string | null;
  planned_pay_date?: string | null;
  planned_amount: number;
  claimed_at?: string | null;
  claimed_amount?: number | null;
  certified_at?: string | null;
  certified_amount?: number | null;
  retention?: number | null;
  paid_at?: string | null;
  paid_amount?: number | null;
  status?: ConstructionPaymentStatus | string;
  notes?: string;
  /** Set when a portal link records the figure. */
  reported_via?: 'portal' | string;
  reported_portal_id?: string;
  reported_at?: string;
};

export type ConstructionSnag = {
  id: string;
  site_id?: string | null;
  item: string;
  location?: string;
  status?: 'open' | 'in_progress' | 'closed' | string;
  due_date?: string | null;
};

export type ConstructionPortal = {
  id?: string;
  /**
   * Deprecated plaintext secret. Read from old stored rows only.
   * Never written back to metadata.
   */
  token?: string;
  token_hash?: string;
  token_hint?: string;
  kind: 'public' | 'client' | 'contractor';
  client_id?: string | null;
  site_id?: string | null;
  label?: string;
  created_at?: string;
  created_by?: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  legacy?: boolean;
};

export type ConstructionAuditEntry = {
  at: string;
  actor_kind: 'staff' | 'portal';
  actor_id: string;
  action: string;
  target: string;
};

export type ConstructionSettings = {
  public_token?: string;
};

export type ConstructiongraphStore = {
  clients: ConstructionClient[];
  sites: ConstructionSite[];
  quotes: ConstructionQuote[];
  drawings: ConstructionDrawing[];
  boq: ConstructionBoqItem[];
  costs: ConstructionCost[];
  subcontractors: ConstructionSubcontractor[];
  materials: ConstructionMaterial[];
  plant: ConstructionPlant[];
  programme: ConstructionProgrammeRow[];
  safety: ConstructionSafetyRow[];
  variations: ConstructionVariation[];
  certificates: ConstructionCertificate[];
  payments: ConstructionProgressPayment[];
  snags: ConstructionSnag[];
  portals: ConstructionPortal[];
  settings: ConstructionSettings;
  updated_at?: string;
};

function asObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function money(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export function boqAmount(row: ConstructionBoqItem): number {
  if (row.amount != null) return money(row.amount);
  return money(row.qty) * money(row.rate);
}

export function boqActualAmount(row: ConstructionBoqItem): number {
  if (row.actual_amount != null) return money(row.actual_amount);
  return money(row.actual_qty) * money(row.rate);
}

export function quoteBoqTotal(
  store: ConstructiongraphStore,
  quoteId?: string | null
): number {
  if (!quoteId) return 0;
  return store.boq
    .filter((row) => row.quote_id === quoteId)
    .reduce((sum, row) => sum + boqAmount(row), 0);
}

export function newConstructionId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) {
    throw new Error('CSPRNG unavailable');
  }
  webCrypto.getRandomValues(bytes);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/**
 * CSPRNG portal token (cgp_ + 256 bits). Server routes issue through
 * newPortalToken in portal-tokens.ts; this export stays for callers that
 * already import the name. Web Crypto, not Math.random.
 */
export function mintConstructionToken(): string {
  return `cgp_${randomHex(32)}`;
}

function newPortalRowIdLocal(): string {
  return `cgpr_${randomHex(16)}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(isoDate).slice(0, 10);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function resolvePaymentStatus(
  row: ConstructionProgressPayment,
  today = new Date().toISOString().slice(0, 10)
): ConstructionPaymentStatus {
  if (row.paid_at || row.status === 'paid') return 'paid';
  if (row.certified_at || row.status === 'certified') {
    if (row.planned_pay_date && row.planned_pay_date < today) return 'overdue';
    return 'certified';
  }
  if (row.claimed_at || row.status === 'claimed') {
    if (row.planned_pay_date && row.planned_pay_date < today) return 'overdue';
    return 'claimed';
  }
  if (row.planned_claim_date && row.planned_claim_date < today) return 'overdue';
  return 'planned';
}

export function paymentsForProject(
  store: ConstructiongraphStore,
  siteId?: string | null
): ConstructionProgressPayment[] {
  if (!siteId) return store.payments;
  return store.payments.filter((row) => row.site_id === siteId);
}

export function paymentCashflow(
  store: ConstructiongraphStore,
  siteId?: string | null,
  today = new Date().toISOString().slice(0, 10)
) {
  const rows = paymentsForProject(store, siteId);
  const planned = rows.reduce((s, row) => s + money(row.planned_amount), 0);
  const claimed = rows.reduce(
    (s, row) => s + money(row.claimed_amount ?? (row.claimed_at ? row.planned_amount : 0)),
    0
  );
  const certified = rows.reduce((s, row) => s + money(row.certified_amount), 0);
  const paid = rows.reduce((s, row) => s + money(row.paid_amount), 0);
  const outstanding = Math.max(certified - paid, 0);
  const overdue = rows.filter((row) => resolvePaymentStatus(row, today) === 'overdue').length;
  return { planned, claimed, certified, paid, outstanding, overdue, count: rows.length };
}

export function emptyConstructiongraphStore(): ConstructiongraphStore {
  return {
    clients: [],
    sites: [],
    quotes: [],
    drawings: [],
    boq: [],
    costs: [],
    subcontractors: [],
    materials: [],
    plant: [],
    programme: [],
    safety: [],
    variations: [],
    certificates: [],
    payments: [],
    snags: [],
    portals: [],
    settings: {},
  };
}

function slugClientId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24);
  return slug ? `cli_${slug}` : `cli_${Date.now()}`;
}

const PRESERVED = Symbol.for('constructiongraph.preserved');

const KNOWN_STORE_KEYS = new Set([
  'clients',
  'sites',
  'quotes',
  'drawings',
  'boq',
  'costs',
  'subcontractors',
  'materials',
  'plant',
  'programme',
  'safety',
  'variations',
  'certificates',
  'payments',
  'snags',
  'portals',
  'settings',
  'updated_at',
]);

const BOOK_COLLECTIONS = [
  'clients',
  'sites',
  'quotes',
  'drawings',
  'boq',
  'costs',
  'subcontractors',
  'materials',
  'plant',
  'programme',
  'safety',
  'variations',
  'certificates',
  'payments',
  'snags',
] as const;

function preservedOf(store: object | null | undefined): Record<string, unknown> {
  if (!store) return {};
  const value = (store as { [PRESERVED]?: unknown })[PRESERVED];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function withPreserved<T extends object>(
  store: T,
  preserved: Record<string, unknown>
): T {
  Object.defineProperty(store, PRESERVED, {
    value: preserved,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return store;
}

function hexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function constructionBookHasRows(store: ConstructiongraphStore): boolean {
  for (const key of BOOK_COLLECTIONS) {
    if (Array.isArray(store[key]) && store[key].length > 0) return true;
  }
  for (const value of Object.values(preservedOf(store))) {
    if (Array.isArray(value) && value.length > 0) return true;
  }
  return false;
}

export function keepConstructionExtras(
  next: ConstructiongraphStore,
  previous: ConstructiongraphStore
): ConstructiongraphStore {
  return withPreserved(next, {
    ...preservedOf(previous),
    ...preservedOf(next),
  });
}

export function stripPortalOwnedFields(
  partial: Partial<ConstructiongraphStore>
): Partial<ConstructiongraphStore> {
  const copy: Partial<ConstructiongraphStore> = { ...partial };
  delete copy.portals;
  delete copy.settings;
  return copy;
}

export function appendConstructionAudit(
  meta: Record<string, unknown>,
  entry: ConstructionAuditEntry
): Record<string, unknown> {
  const prev = Array.isArray(meta[CONSTRUCTIONGRAPH_AUDIT_KEY])
    ? (meta[CONSTRUCTIONGRAPH_AUDIT_KEY] as ConstructionAuditEntry[])
    : [];
  const next = [
    ...prev,
    {
      at: entry.at,
      actor_kind: entry.actor_kind,
      actor_id: String(entry.actor_id || ''),
      action: entry.action,
      target: String(entry.target || ''),
    },
  ].slice(-200);
  return { ...meta, [CONSTRUCTIONGRAPH_AUDIT_KEY]: next };
}

export function hydrateConstructiongraphStore(
  store: ConstructiongraphStore
): ConstructiongraphStore {
  const preserved = preservedOf(store);
  const next: ConstructiongraphStore = {
    ...emptyConstructiongraphStore(),
    clients: [...(store.clients || [])],
    sites: (store.sites || []).map((s) => ({ ...s })),
    quotes: [...(store.quotes || [])],
    drawings: [...(store.drawings || [])],
    boq: [...(store.boq || [])],
    costs: [...(store.costs || [])],
    subcontractors: [...(store.subcontractors || [])],
    materials: [...(store.materials || [])],
    plant: [...(store.plant || [])],
    programme: [...(store.programme || [])],
    safety: [...(store.safety || [])],
    variations: [...(store.variations || [])],
    certificates: [...(store.certificates || [])],
    payments: [...(store.payments || [])],
    snags: [...(store.snags || [])],
    settings: { ...(store.settings || {}) },
    portals: (store.portals || []).map((p) => ({
      ...p,
      id: p.id || p.token,
    })),
    updated_at: store.updated_at,
  };

  for (const site of next.sites) {
    if (site.client_id) {
      const linked = next.clients.find((c) => c.id === site.client_id);
      if (linked) site.client = linked.name;
      continue;
    }
    const name = String(site.client || '').trim();
    if (!name) continue;
    let client = next.clients.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    if (!client) {
      client = { id: slugClientId(name), name };
      next.clients.push(client);
    }
    site.client_id = client.id;
    site.client = client.name;
  }

  for (const row of next.programme) {
    if (!row.planned_start && row.start_date) row.planned_start = row.start_date;
    if (!row.planned_end && row.end_date) row.planned_end = row.end_date;
    if (row.planned_pct == null && row.pct_complete != null) {
      row.planned_pct = row.pct_complete;
    }
    if (row.actual_pct == null && row.pct_complete != null) {
      row.actual_pct = row.pct_complete;
    }
  }

  if (next.settings.public_token) {
    const master = next.settings.public_token;
    const masterHash = sha256Hex(master);
    const already = next.portals.some(
      (portal) =>
        portal.kind === 'public' &&
        (portal.token === master ||
          (portal.token_hash && hexEqual(portal.token_hash, masterHash)))
    );
    if (!already) {
      next.portals.push({
        token: master,
        kind: 'public',
        label: 'Client & contractor PWA',
        legacy: true,
      });
    }
  }

  return withPreserved(next, preserved);
}

export function readConstructiongraphFromMetadata(
  meta: Record<string, unknown> | null | undefined
): ConstructiongraphStore {
  const src = asObject(meta);
  const raw = asObject(src[CONSTRUCTIONGRAPH_META_KEY]);
  const settings = asObject(raw.settings);
  const preserved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!KNOWN_STORE_KEYS.has(key)) preserved[key] = value;
  }
  const store: ConstructiongraphStore = {
    clients: asArray<ConstructionClient>(raw.clients),
    sites: asArray<ConstructionSite>(raw.sites),
    quotes: asArray<ConstructionQuote>(raw.quotes),
    drawings: asArray<ConstructionDrawing>(raw.drawings),
    boq: asArray<ConstructionBoqItem>(raw.boq),
    costs: asArray<ConstructionCost>(raw.costs),
    subcontractors: asArray<ConstructionSubcontractor>(raw.subcontractors),
    materials: asArray<ConstructionMaterial>(raw.materials),
    plant: asArray<ConstructionPlant>(raw.plant),
    programme: asArray<ConstructionProgrammeRow>(raw.programme),
    safety: asArray<ConstructionSafetyRow>(raw.safety),
    variations: asArray<ConstructionVariation>(raw.variations),
    certificates: asArray<ConstructionCertificate>(raw.certificates),
    payments: asArray<ConstructionProgressPayment>(raw.payments),
    snags: asArray<ConstructionSnag>(raw.snags),
    portals: asArray<ConstructionPortal>(raw.portals),
    settings: {
      public_token:
        typeof settings.public_token === 'string'
          ? settings.public_token
          : typeof src[CONSTRUCTIONGRAPH_TOKEN_KEY] === 'string'
            ? String(src[CONSTRUCTIONGRAPH_TOKEN_KEY])
            : undefined,
    },
    updated_at:
      typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
  };
  return hydrateConstructiongraphStore(withPreserved(store, preserved));
}

function rowIdentity(row: unknown): string {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return '';
  const rec = row as { id?: unknown; token?: unknown };
  return String(rec.id || rec.token || '').trim();
}

function mergeIdArray(existing: unknown, incoming: unknown): unknown[] {
  const prev = Array.isArray(existing) ? existing : [];
  const next = Array.isArray(incoming) ? incoming : [];
  const out: unknown[] = [];
  const seen = new Set<string>();

  for (const row of next) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const id = rowIdentity(row);
      if (!id) continue;
      if (seen.has(id)) continue;
      out.push(row);
      seen.add(id);
      continue;
    }
    out.push(row);
  }

  for (const row of prev) {
    const id = rowIdentity(row);
    if (id && seen.has(id)) continue;
    out.push(row);
  }

  return out;
}

function deepMergeValue(existing: unknown, incoming: unknown): unknown {
  if (incoming === undefined) return existing;
  if (Array.isArray(incoming)) {
    return mergeIdArray(existing, incoming);
  }
  if (
    incoming &&
    typeof incoming === 'object' &&
    !Array.isArray(incoming) &&
    existing &&
    typeof existing === 'object' &&
    !Array.isArray(existing)
  ) {
    const left = existing as Record<string, unknown>;
    const right = incoming as Record<string, unknown>;
    const out: Record<string, unknown> = { ...left };
    for (const [k, v] of Object.entries(right)) {
      out[k] = deepMergeValue(left[k], v);
    }
    return out;
  }
  return incoming;
}

export function mergeConstructiongraphStore(
  existing: ConstructiongraphStore,
  incoming: Partial<ConstructiongraphStore>
): ConstructiongraphStore {
  const preserved = {
    ...preservedOf(existing),
    ...preservedOf(incoming),
  };
  for (const [key, value] of Object.entries(incoming)) {
    if (!KNOWN_STORE_KEYS.has(key)) preserved[key] = value;
  }
  const merged = deepMergeValue(existing, incoming) as ConstructiongraphStore;
  return withPreserved(hydrateConstructiongraphStore(merged), preserved);
}

function serialisePortal(portal: ConstructionPortal, now: string): ConstructionPortal {
  const plaintext = String(portal.token || '').trim();
  let id = String(portal.id || '').trim();
  let tokenHash = String(portal.token_hash || '').trim();
  let tokenHint = String(portal.token_hint || '').trim();
  let legacy = Boolean(portal.legacy);
  if (plaintext) {
    tokenHash = sha256Hex(plaintext);
    tokenHint = tokenHint || plaintext.slice(-4);
    legacy = true;
    if (!id || id === plaintext) id = newPortalRowIdLocal();
  }
  if (!id) id = newPortalRowIdLocal();
  const row: ConstructionPortal = {
    id,
    token_hash: tokenHash || undefined,
    token_hint: tokenHint || undefined,
    kind: portal.kind,
    client_id: portal.client_id ?? null,
    site_id: portal.site_id ?? null,
    label: portal.label,
    created_at: portal.created_at || now,
    created_by: portal.created_by,
    expires_at: portal.expires_at ?? null,
    revoked_at: portal.revoked_at ?? null,
  };
  if (legacy) row.legacy = true;
  return row;
}

export function writeConstructiongraphToMetadata(
  meta: Record<string, unknown>,
  store: ConstructiongraphStore
): Record<string, unknown> {
  const hydrated = hydrateConstructiongraphStore(store);
  const now = new Date().toISOString();
  const portals = hydrated.portals.map((portal) => serialisePortal(portal, now));
  const hashes: Record<string, string> = {};
  for (const portal of portals) {
    if (portal.revoked_at || !portal.token_hash) continue;
    hashes[portal.token_hash] = portal.kind;
  }
  const settings = { ...(hydrated.settings || {}) };
  delete settings.public_token;
  const body: Record<string, unknown> = {
    ...preservedOf(hydrated),
    clients: hydrated.clients,
    sites: hydrated.sites,
    quotes: hydrated.quotes,
    drawings: hydrated.drawings,
    boq: hydrated.boq,
    costs: hydrated.costs,
    subcontractors: hydrated.subcontractors,
    materials: hydrated.materials,
    plant: hydrated.plant,
    programme: hydrated.programme,
    safety: hydrated.safety,
    variations: hydrated.variations,
    certificates: hydrated.certificates,
    payments: hydrated.payments,
    snags: hydrated.snags,
    portals,
    settings,
    updated_at: now,
  };
  return {
    ...meta,
    [CONSTRUCTIONGRAPH_META_KEY]: body,
    [CONSTRUCTIONGRAPH_TOKEN_KEY]: null,
    [CONSTRUCTIONGRAPH_TOKENS_KEY]: null,
    [CONSTRUCTIONGRAPH_HASH_KEY]: hashes,
  };
}

export function clientById(
  store: ConstructiongraphStore,
  id?: string | null
): ConstructionClient | undefined {
  if (!id) return undefined;
  return store.clients.find((c) => c.id === id);
}

export function projectsForClient(
  store: ConstructiongraphStore,
  clientId?: string | null
): ConstructionSite[] {
  if (!clientId) return store.sites;
  return store.sites.filter((s) => s.client_id === clientId);
}

export function boqForProject(
  store: ConstructiongraphStore,
  siteId?: string | null
): ConstructionBoqItem[] {
  if (!siteId) return store.boq;
  return store.boq.filter((row) => row.site_id === siteId);
}

export type ConstructionBoqLineReport = {
  id: string;
  item_no: string;
  description: string;
  uom: string;
  qty: number;
  rate: number;
  planned: number;
  actual: number;
};

export type ConstructionProjectReport = {
  siteId: string;
  code: string;
  name: string;
  clientName: string;
  status: string;
  boqPlanned: number;
  boqActual: number;
  costs: number;
  certified: number;
  variations: number;
  contractValue: number;
  variance: number;
  openSnags: number;
  plannedPct: number;
  actualPct: number;
  budget: number;
  plannedBillings: number;
  claimedBillings: number;
  paidBillings: number;
  outstandingBillings: number;
  overduePayments: number;
  boqLines: ConstructionBoqLineReport[];
};

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export function projectReport(
  store: ConstructiongraphStore,
  siteId: string
): ConstructionProjectReport | null {
  const site = store.sites.find((s) => s.id === siteId);
  if (!site) return null;
  const client = clientById(store, site.client_id);
  const boq = boqForProject(store, siteId);
  const boqLines = boq.map((row) => ({
    id: row.id,
    item_no: row.item_no,
    description: row.description,
    uom: row.uom,
    qty: money(row.qty),
    rate: money(row.rate),
    planned: boqAmount(row),
    actual: boqActualAmount(row),
  }));
  const boqPlanned = boqLines.reduce((s, row) => s + row.planned, 0);
  const boqActual = boqLines.reduce((s, row) => s + row.actual, 0);
  const costs = store.costs
    .filter((c) => c.site_id === siteId)
    .reduce((s, c) => s + money(c.amount), 0);
  const certified = store.certificates
    .filter((c) => c.site_id === siteId)
    .reduce((s, c) => s + money(c.certified_amount), 0);
  const variations = store.variations
    .filter((c) => c.site_id === siteId)
    .reduce((s, c) => s + money(c.amount), 0);
  const openSnags = store.snags.filter(
    (c) => c.site_id === siteId && c.status !== 'closed'
  ).length;
  const prog = store.programme.filter((p) => p.site_id === siteId);
  const plannedPct = avg(prog.map((p) => money(p.planned_pct ?? p.pct_complete)));
  const actualPct = avg(prog.map((p) => money(p.actual_pct ?? p.pct_complete)));
  const contractValue = money(site.contract_value) || boqPlanned;
  const approvedVos = store.variations
    .filter(
      (v) =>
        v.site_id === siteId &&
        (v.status === 'approved' || v.status === 'claimed')
    )
    .reduce((s, v) => s + money(v.amount), 0);
  const budget = contractValue + approvedVos;
  const cash = paymentCashflow(store, siteId);
  const certifiedFromPayments = cash.certified || certified;
  return {
    siteId: site.id,
    code: site.code,
    name: site.name,
    clientName: client?.name || site.client || '—',
    status: String(site.status || '—'),
    boqPlanned,
    boqActual,
    costs,
    certified: certifiedFromPayments,
    variations,
    contractValue,
    variance: budget - costs,
    openSnags,
    plannedPct,
    actualPct,
    budget,
    plannedBillings: cash.planned,
    claimedBillings: cash.claimed,
    paidBillings: cash.paid,
    outstandingBillings: cash.outstanding,
    overduePayments: cash.overdue,
    boqLines,
  };
}

export function programmeReport(store: ConstructiongraphStore) {
  const projects = store.sites
    .map((s) => projectReport(store, s.id))
    .filter((r): r is ConstructionProjectReport => Boolean(r));
  const sum = (
    key:
      | 'contractValue'
      | 'boqPlanned'
      | 'costs'
      | 'certified'
      | 'variations'
      | 'variance'
      | 'openSnags'
      | 'budget'
      | 'plannedBillings'
      | 'claimedBillings'
      | 'paidBillings'
      | 'outstandingBillings'
      | 'overduePayments'
  ) => projects.reduce((n, p) => n + money(p[key]), 0);
  return {
    projectCount: projects.length,
    clientCount: store.clients.length,
    quoteCount: store.quotes.length,
    contractValue: sum('contractValue'),
    boqPlanned: sum('boqPlanned'),
    costs: sum('costs'),
    certified: sum('certified'),
    variations: sum('variations'),
    variance: sum('variance'),
    openSnags: sum('openSnags'),
    budget: sum('budget'),
    plannedBillings: sum('plannedBillings'),
    claimedBillings: sum('claimedBillings'),
    paidBillings: sum('paidBillings'),
    outstandingBillings: sum('outstandingBillings'),
    overduePayments: sum('overduePayments'),
    plannedPct: avg(projects.map((p) => p.plannedPct)),
    actualPct: avg(projects.map((p) => p.actualPct)),
    projects,
  };
}

export function clientReport(store: ConstructiongraphStore, clientId: string) {
  const client = clientById(store, clientId);
  const projects = projectsForClient(store, clientId)
    .map((s) => projectReport(store, s.id))
    .filter((r): r is ConstructionProjectReport => Boolean(r));
  const sum = (
    key: Exclude<
      keyof ConstructionProjectReport,
      'boqLines' | 'siteId' | 'code' | 'name' | 'clientName' | 'status'
    >
  ) => projects.reduce((n, p) => n + money(p[key]), 0);
  return {
    client,
    projectCount: projects.length,
    contractValue: sum('contractValue'),
    costs: sum('costs'),
    certified: sum('certified'),
    variance: sum('variance'),
    budget: sum('budget'),
    plannedBillings: sum('plannedBillings'),
    paidBillings: sum('paidBillings'),
    outstandingBillings: sum('outstandingBillings'),
    projects,
  };
}

export function upsertPortal(
  store: ConstructiongraphStore,
  portal: ConstructionPortal
): ConstructiongraphStore {
  const plaintext = String(portal.token || '').trim();
  const row: ConstructionPortal = {
    ...portal,
    id:
      portal.id && portal.id !== plaintext
        ? portal.id
        : newPortalRowIdLocal(),
    token: undefined,
    token_hash: portal.token_hash || (plaintext ? sha256Hex(plaintext) : undefined),
    token_hint: portal.token_hint || (plaintext ? plaintext.slice(-4) : undefined),
    legacy: plaintext ? true : portal.legacy,
    created_at: portal.created_at || new Date().toISOString(),
  };
  const active = (p: ConstructionPortal) => !p.revoked_at;
  const match = (p: ConstructionPortal) => {
    if (!active(p)) return false;
    if (row.kind === 'public') return p.kind === 'public';
    if (row.kind === 'client') {
      return p.kind === 'client' && p.client_id === row.client_id;
    }
    if (row.kind === 'contractor') {
      return p.kind === 'contractor' && p.site_id === row.site_id;
    }
    return p.token_hash === row.token_hash;
  };
  const portals = store.portals.some(match)
    ? store.portals.map((p) => (match(p) ? row : p))
    : [...store.portals, row];
  const settings = { ...store.settings };
  delete settings.public_token;
  return hydrateConstructiongraphStore(withPreserved({ ...store, portals, settings }, preservedOf(store)));
}

export function allocateCostPatch(
  store: ConstructiongraphStore,
  cost: ConstructionCost
): Pick<ConstructiongraphStore, 'costs' | 'boq'> {
  const boq = store.boq.map((row) => {
    if (!cost.boq_id || row.id !== cost.boq_id) return row;
    return {
      ...row,
      actual_amount: boqActualAmount(row) + money(cost.amount),
    };
  });
  return { costs: [cost], boq };
}

export function acceptQuotePatch(
  store: ConstructiongraphStore,
  quoteId: string,
  acceptedAt = new Date().toISOString().slice(0, 10)
): Partial<ConstructiongraphStore> {
  const quote = store.quotes.find((q) => q.id === quoteId);
  if (!quote) return {};
  const total = quoteBoqTotal(store, quoteId);
  const quotes: ConstructionQuote[] = [
    {
      ...quote,
      status: 'accepted',
      accepted_at: acceptedAt,
    },
  ];
  const site = quote.site_id
    ? store.sites.find((s) => s.id === quote.site_id)
    : undefined;
  const sites: ConstructionSite[] = site
    ? [
        {
          ...site,
          quote_id: quote.id,
          contract_value: total > 0 ? total : money(site.contract_value) || null,
          status:
            !site.status || site.status === 'tender' ? 'awarded' : site.status,
        },
      ]
    : [];
  return { quotes, sites };
}

export function claimPaymentPatch(
  store: ConstructiongraphStore,
  paymentId: string,
  claimedAt = new Date().toISOString().slice(0, 10),
  amount?: number
): Partial<ConstructiongraphStore> {
  const row = store.payments.find((p) => p.id === paymentId);
  if (!row || row.paid_at) return {};
  const claimedAmount = amount != null ? money(amount) : money(row.planned_amount);
  return {
    payments: [
      {
        ...row,
        claimed_at: claimedAt,
        claimed_amount: claimedAmount,
        status: 'claimed',
      },
    ],
  };
}

export function certifyPaymentPatch(
  store: ConstructiongraphStore,
  paymentId: string,
  certifiedAt = new Date().toISOString().slice(0, 10),
  amount?: number
): Partial<ConstructiongraphStore> {
  const row = store.payments.find((p) => p.id === paymentId);
  if (!row || row.paid_at) return {};
  const certifiedAmount =
    amount != null
      ? money(amount)
      : money(row.claimed_amount ?? row.planned_amount);
  const retention = Math.round(certifiedAmount * 0.1);
  const certId = row.certificate_id || newConstructionId('cert');
  const existing = store.certificates.find((c) => c.id === certId);
  const certificate: ConstructionCertificate = {
    ...(existing || {
      id: certId,
      site_id: row.site_id,
      number: row.number.replace(/^PP/i, 'IPC'),
    }),
    period: certifiedAt.slice(0, 7),
    certified_amount: certifiedAmount,
    retention,
    issued_at: certifiedAt,
    status: 'issued',
  };
  return {
    payments: [
      {
        ...row,
        certificate_id: certId,
        certified_at: certifiedAt,
        certified_amount: certifiedAmount,
        retention,
        status: 'certified',
      },
    ],
    certificates: [certificate],
  };
}

export function payPaymentPatch(
  store: ConstructiongraphStore,
  paymentId: string,
  paidAt = new Date().toISOString().slice(0, 10),
  amount?: number
): Partial<ConstructiongraphStore> {
  const row = store.payments.find((p) => p.id === paymentId);
  if (!row) return {};
  const paidAmount =
    amount != null
      ? money(amount)
      : money(row.certified_amount ?? row.claimed_amount ?? row.planned_amount);
  const certificates = row.certificate_id
    ? store.certificates
        .filter((c) => c.id === row.certificate_id)
        .map((c) => ({
          ...c,
          status: 'paid' as const,
          paid_at: paidAt,
          paid_amount: paidAmount,
        }))
    : [];
  return {
    payments: [
      {
        ...row,
        paid_at: paidAt,
        paid_amount: paidAmount,
        status: 'paid',
      },
    ],
    certificates,
  };
}

export function applyPaymentAction(
  store: ConstructiongraphStore,
  opts: {
    paymentId: string;
    action: 'claim' | 'certify' | 'pay';
    amount?: number;
    date?: string;
    actor: 'staff' | 'client' | 'contractor' | 'public';
    portal?: ConstructionPortal | null;
  }
): { ok: true; store: ConstructiongraphStore } | { ok: false; error: string } {
  const row = store.payments.find((p) => p.id === opts.paymentId);
  if (!row) return { ok: false, error: 'Payment not found' };
  const site = store.sites.find((s) => s.id === row.site_id);
  if (opts.actor === 'public') {
    return { ok: false, error: 'Public portal is read-only' };
  }
  if (opts.actor === 'contractor') {
    if (opts.action !== 'claim') {
      return { ok: false, error: 'Contractor can only issue claims' };
    }
    if (!opts.portal?.site_id || row.site_id !== opts.portal.site_id) {
      return { ok: false, error: 'Payment is not on this project' };
    }
  }
  if (opts.actor === 'client') {
    if (opts.action !== 'pay') {
      return { ok: false, error: 'Client can only record payments' };
    }
    if (!opts.portal?.client_id || !site?.client_id || site.client_id !== opts.portal.client_id) {
      return { ok: false, error: 'Payment is not for this client' };
    }
    if (!row.claimed_at && !row.certified_at) {
      return { ok: false, error: 'Claim has not been issued yet' };
    }
  }
  if (opts.actor === 'staff' && opts.action === 'pay' && !row.claimed_at && !row.certified_at) {
    return { ok: false, error: 'Claim has not been issued yet' };
  }
  const date = opts.date || new Date().toISOString().slice(0, 10);
  const patch =
    opts.action === 'claim'
      ? claimPaymentPatch(store, opts.paymentId, date, opts.amount)
      : opts.action === 'certify'
        ? certifyPaymentPatch(store, opts.paymentId, date, opts.amount)
        : payPaymentPatch(store, opts.paymentId, date, opts.amount);
  if (!patch.payments?.length) {
    return { ok: false, error: 'Payment cannot be updated' };
  }
  return { ok: true, store: mergeConstructiongraphStore(store, patch) };
}

export function summariseConstructiongraph(store: ConstructiongraphStore) {
  const roll = programmeReport(store);
  const quotesIssued = store.quotes.filter((q) => q.status === 'issued').length;
  const quotesAccepted = store.quotes.filter((q) => q.status === 'accepted').length;
  return {
    clients: store.clients.length,
    sites: store.sites.length,
    onSite: store.sites.filter((s) => s.status === 'on_site').length,
    drawings: store.drawings.length,
    boqLines: store.boq.length,
    boqAmount: roll.boqPlanned,
    subcontractors: store.subcontractors.length,
    materials: store.materials.length,
    plant: store.plant.length,
    programmeRows: store.programme.length,
    safetyOpen: store.safety.filter((s) => s.status !== 'closed').length,
    variations: roll.variations,
    variationCount: store.variations.length,
    certified: roll.certified,
    certificateCount: store.certificates.length,
    contractValue: roll.contractValue,
    costs: roll.costs,
    variance: roll.variance,
    plannedPct: roll.plannedPct,
    actualPct: roll.actualPct,
    quotes: store.quotes.length,
    quotesIssued,
    quotesAccepted,
    openSnags: roll.openSnags,
    snags: store.snags.length,
    plannedBillings: roll.plannedBillings,
    paidBillings: roll.paidBillings,
    outstandingBillings: roll.outstandingBillings,
    overduePayments: roll.overduePayments,
  };
}

export type ConstructionPortalActivity = {
  id: string;
  siteCode: string;
  siteName: string;
  activity: string;
  plannedPct: number;
  actualPct: number;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  status: string;
};

export type ConstructionPortalPayment = {
  id: string;
  siteCode: string;
  number: string;
  title: string;
  status: string;
  plannedClaimDate?: string | null;
  plannedPayDate?: string | null;
  plannedAmount: number;
  claimedAmount: number;
  certifiedAmount?: number;
  paidAmount?: number;
  claimedAt?: string | null;
  certifiedAt?: string | null;
  paidAt?: string | null;
};

export type ConstructionPortalQuote = {
  id: string;
  number: string;
  title: string;
  status: string;
  total: number;
  projectCode: string;
};

export type ClientPortalProject = {
  siteId: string;
  code: string;
  name: string;
  clientName: string;
  status: string;
  plannedPct: number;
  actualPct: number;
  openSnags: number;
  variationsTotal: number;
  contractValue: number;
  certified: number;
  paid: number;
  outstanding: number;
  overdueCount: number;
};

export type ClientPortalView = {
  kind: 'client';
  companyName: string;
  clientName: string;
  projects: ClientPortalProject[];
  quotes: ConstructionPortalQuote[];
  payments: ConstructionPortalPayment[];
  activities: ConstructionPortalActivity[];
};

export type ContractorPortalView = {
  kind: 'contractor';
  companyName: string;
  projectName: string;
  projectCode: string;
  status: string;
  projects: Array<{
    siteId: string;
    code: string;
    name: string;
    status: string;
    plannedPct: number;
    actualPct: number;
    openSnags: number;
  }>;
  activities: ConstructionPortalActivity[];
  openSnags: Array<{ item: string; location: string; status: string }>;
  payments: ConstructionPortalPayment[];
};

export type PublicPortalView = {
  kind: 'public';
  companyName: string;
  projects: Array<{
    code: string;
    name: string;
    status: string;
    plannedPct: number;
    actualPct: number;
  }>;
};

export type ConstructionPortalView =
  | ClientPortalView
  | ContractorPortalView
  | PublicPortalView;

export type PortalDenial = 'missing' | 'revoked' | 'expired' | 'unscoped';

export function portalDenial(
  portal: ConstructionPortal | null | undefined,
  now = Date.now()
): PortalDenial | null {
  if (!portal) return 'missing';
  if (portal.revoked_at) return 'revoked';
  if (portal.expires_at && Date.parse(portal.expires_at) <= now) return 'expired';
  if (portal.kind === 'client' && !portal.client_id) return 'unscoped';
  if (portal.kind === 'contractor' && !portal.site_id) return 'unscoped';
  return null;
}

export function resolvePresentedPortal(
  store: ConstructiongraphStore,
  token: string
): { portal: ConstructionPortal; via: 'hash' | 'legacy' } | null {
  const presented = String(token || '');
  const hash = sha256Hex(presented);
  const byHash = store.portals.find(
    (portal) => portal.token_hash && hexEqual(portal.token_hash, hash)
  );
  if (byHash) return { portal: byHash, via: 'hash' };
  const byPlain = store.portals.find((portal) => portal.token && portal.token === presented);
  if (byPlain) return { portal: byPlain, via: 'legacy' };
  if (store.settings.public_token && store.settings.public_token === presented) {
    const master = store.portals.find((portal) => portal.kind === 'public' && !portal.revoked_at);
    if (master) return { portal: master, via: 'legacy' };
  }
  return null;
}

function activityView(
  store: ConstructiongraphStore,
  row: ConstructionProgrammeRow
): ConstructionPortalActivity {
  const site = store.sites.find((item) => item.id === row.site_id);
  return {
    id: row.id,
    siteCode: site?.code || '—',
    siteName: site?.name || '—',
    activity: row.activity,
    plannedPct: money(row.planned_pct ?? row.pct_complete),
    actualPct: money(row.actual_pct ?? row.pct_complete),
    plannedStart: row.planned_start || row.start_date || null,
    plannedEnd: row.planned_end || row.end_date || null,
    actualStart: row.actual_start || null,
    actualEnd: row.actual_end || null,
    status: String(row.status || '—'),
  };
}

function clientPaymentView(
  store: ConstructiongraphStore,
  row: ConstructionProgressPayment
): ConstructionPortalPayment {
  const site = store.sites.find((item) => item.id === row.site_id);
  return {
    id: row.id,
    siteCode: site?.code || '—',
    number: row.number,
    title: row.title,
    status: resolvePaymentStatus(row),
    plannedClaimDate: row.planned_claim_date || null,
    plannedPayDate: row.planned_pay_date || null,
    plannedAmount: money(row.planned_amount),
    claimedAmount: money(row.claimed_amount),
    certifiedAmount: money(row.certified_amount),
    paidAmount: money(row.paid_amount),
    claimedAt: row.claimed_at || null,
    certifiedAt: row.certified_at || null,
    paidAt: row.paid_at || null,
  };
}

function contractorPaymentView(
  store: ConstructiongraphStore,
  row: ConstructionProgressPayment
): ConstructionPortalPayment {
  const site = store.sites.find((item) => item.id === row.site_id);
  return {
    id: row.id,
    siteCode: site?.code || '—',
    number: row.number,
    title: row.title,
    status: resolvePaymentStatus(row),
    plannedClaimDate: row.planned_claim_date || null,
    plannedPayDate: row.planned_pay_date || null,
    plannedAmount: money(row.planned_amount),
    claimedAmount: money(row.claimed_amount),
    claimedAt: row.claimed_at || null,
  };
}

function buildPortalView(
  store: ConstructiongraphStore,
  portal: ConstructionPortal,
  companyName: string
): ConstructionPortalView | null {
  if (portal.kind === 'public') {
    return {
      kind: 'public',
      companyName,
      projects: store.sites.map((site) => {
        const report = projectReport(store, site.id);
        return {
          code: site.code,
          name: site.name,
          status: String(site.status || ''),
          plannedPct: report?.plannedPct || 0,
          actualPct: report?.actualPct || 0,
        };
      }),
    };
  }

  if (portal.kind === 'client') {
    if (!portal.client_id) return null;
    const client = clientById(store, portal.client_id);
    const sites = store.sites.filter((site) => site.client_id === portal.client_id);
    const siteIds = new Set(sites.map((site) => site.id));
    const projects: ClientPortalProject[] = [];
    for (const site of sites) {
      const report = projectReport(store, site.id);
      if (!report) continue;
      projects.push({
        siteId: site.id,
        code: site.code,
        name: site.name,
        clientName: client?.name || site.client || '',
        status: String(site.status || ''),
        plannedPct: report.plannedPct,
        actualPct: report.actualPct,
        openSnags: report.openSnags,
        variationsTotal: report.variations,
        contractValue: report.contractValue,
        certified: report.certified,
        paid: report.paidBillings,
        outstanding: report.outstandingBillings,
        overdueCount: report.overduePayments,
      });
    }
    return {
      kind: 'client',
      companyName,
      clientName: client?.name || '',
      projects,
      quotes: store.quotes
        .filter((quote) => quote.client_id === portal.client_id)
        .map((quote) => ({
          id: quote.id,
          number: quote.number,
          title: quote.title,
          status: String(quote.status || 'draft'),
          total: quoteBoqTotal(store, quote.id),
          projectCode: store.sites.find((site) => site.id === quote.site_id)?.code || '—',
        })),
      payments: store.payments
        .filter((row) => Boolean(row.site_id) && siteIds.has(String(row.site_id)))
        .map((row) => clientPaymentView(store, row)),
      activities: store.programme
        .filter((row) => Boolean(row.site_id) && siteIds.has(String(row.site_id)))
        .map((row) => activityView(store, row)),
    };
  }

  if (!portal.site_id) return null;
  const site = store.sites.find((item) => item.id === portal.site_id);
  const report = site ? projectReport(store, site.id) : null;
  return {
    kind: 'contractor',
    companyName,
    projectName: site?.name || '',
    projectCode: site?.code || '',
    status: String(site?.status || ''),
    projects: site
      ? [
          {
            siteId: site.id,
            code: site.code,
            name: site.name,
            status: String(site.status || ''),
            plannedPct: report?.plannedPct || 0,
            actualPct: report?.actualPct || 0,
            openSnags: report?.openSnags || 0,
          },
        ]
      : [],
    activities: store.programme
      .filter((row) => row.site_id === portal.site_id)
      .map((row) => activityView(store, row)),
    openSnags: store.snags
      .filter((row) => row.site_id === portal.site_id && row.status !== 'closed')
      .map((row) => ({
        item: row.item,
        location: row.location || '',
        status: String(row.status || 'open'),
      })),
    payments: store.payments
      .filter((row) => row.site_id === portal.site_id)
      .map((row) => contractorPaymentView(store, row)),
  };
}

export function portalViewForToken(
  store: ConstructiongraphStore,
  token: string,
  companyName: string
): ConstructionPortalView | null {
  const found = resolvePresentedPortal(store, token);
  if (!found) return null;
  if (portalDenial(found.portal)) return null;
  return buildPortalView(store, found.portal, companyName);
}

export function markPresentedTokenLegacy(
  store: ConstructiongraphStore,
  token: string
): ConstructiongraphStore {
  const hash = sha256Hex(token);
  const portals = store.portals.map((portal) => {
    const matchesPlain = portal.token === token;
    const matchesHash = Boolean(portal.token_hash && hexEqual(portal.token_hash, hash));
    if (!matchesPlain && !matchesHash) return portal;
    const id = portal.id && portal.id !== token ? portal.id : newPortalRowIdLocal();
    return {
      ...portal,
      id,
      token: undefined,
      token_hash: hash,
      token_hint: portal.token_hint || token.slice(-4),
      legacy: true,
    };
  });
  const settings = { ...store.settings };
  delete settings.public_token;
  return hydrateConstructiongraphStore(
    withPreserved({ ...store, portals, settings }, preservedOf(store))
  );
}

export function sanitiseConstructiongraphStore(
  store: ConstructiongraphStore
): ConstructiongraphStore {
  const settings = { ...(store.settings || {}) };
  delete settings.public_token;
  const portals = store.portals.map((portal) => {
    const plaintext = String(portal.token || '');
    const id = portal.id && portal.id !== plaintext ? portal.id : undefined;
    const row: ConstructionPortal = {
      id,
      kind: portal.kind,
      label: portal.label,
      client_id: portal.client_id ?? null,
      site_id: portal.site_id ?? null,
      token_hint: portal.token_hint,
      created_at: portal.created_at,
      expires_at: portal.expires_at ?? null,
      revoked_at: portal.revoked_at ?? null,
      legacy: Boolean(portal.legacy || plaintext),
    };
    return row;
  });
  return withPreserved(
    { ...store, settings, portals },
    preservedOf(store)
  );
}

/** Finite, greater than 0, at most 2 decimal places. Strings are rejected. */
export function parsePortalAmount(
  amount: unknown
): { ok: true; value: number } | { ok: false } {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false };
  }
  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 1e-6) return { ok: false };
  return { ok: true, value: cents / 100 };
}

export function portalAmountWithinRow(
  action: 'claim' | 'pay',
  row: ConstructionProgressPayment,
  amount: number
): boolean {
  if (action === 'claim') return amount <= money(row.planned_amount) + 1e-9;
  const certified = money(row.certified_amount);
  const cap = certified > 0 ? certified : money(row.claimed_amount);
  return amount <= cap + 1e-9;
}

function hashedPortal(
  spec: Omit<ConstructionPortal, 'token' | 'token_hash' | 'token_hint' | 'id'>,
  nowIso: string
): ConstructionPortal {
  const token = mintConstructionToken();
  return {
    ...spec,
    id: newPortalRowIdLocal(),
    token_hash: sha256Hex(token),
    token_hint: token.slice(-4),
    created_at: nowIso,
  };
}

export function constructiongraphSeedStore(
  nowIso = new Date().toISOString(),
  portals?: ConstructionPortal[]
): ConstructiongraphStore {
  const today = nowIso.slice(0, 10);
  const seededPortals = portals || [
    hashedPortal(
      { kind: 'public', label: 'Client & contractor PWA' },
      nowIso
    ),
    hashedPortal(
      { kind: 'client', client_id: 'cli_apex', label: 'Apex Developments' },
      nowIso
    ),
    hashedPortal(
      { kind: 'contractor', site_id: 'site_1', label: 'Podium site team' },
      nowIso
    ),
  ];
  return hydrateConstructiongraphStore({
    clients: [
      {
        id: 'cli_apex',
        name: 'Apex Developments',
        city: 'Sandton',
        contact: 'Lerato N.',
      },
      {
        id: 'cli_schools',
        name: 'Sandton Schools Trust',
        city: 'Sandton',
        contact: 'QS desk',
      },
    ],
    sites: [
      {
        id: 'site_1',
        code: 'PRJ-01',
        name: 'Sandton mixed-use podium',
        client_id: 'cli_apex',
        client: 'Apex Developments',
        quote_id: 'qt_1',
        contract_value: 48_500_000,
        address: '5th Street, Sandhurst',
        city: 'Sandton',
        province: 'Gauteng',
        start_date: today,
        end_date: null,
        status: 'on_site',
        contract_type: 'JBCC',
        notes: 'Podium + 4 levels. Principal building contractor.',
      },
      {
        id: 'site_2',
        code: 'PRJ-02',
        name: 'Apex basement parkade',
        client_id: 'cli_apex',
        client: 'Apex Developments',
        quote_id: 'qt_2',
        contract_value: 12_800_000,
        city: 'Sandton',
        province: 'Gauteng',
        start_date: today,
        status: 'awarded',
        contract_type: 'JBCC',
      },
      {
        id: 'site_3',
        code: 'PRJ-03',
        name: 'Sandton Schools hall',
        client_id: 'cli_schools',
        client: 'Sandton Schools Trust',
        contract_value: 6_400_000,
        city: 'Sandton',
        status: 'tender',
        contract_type: 'GCC',
      },
    ],
    quotes: [
      {
        id: 'qt_1',
        number: 'QT-20260910-POD',
        title: 'Podium structure — BOQ',
        client_id: 'cli_apex',
        site_id: 'site_1',
        status: 'accepted',
        issued_at: today,
        accepted_at: today,
      },
      {
        id: 'qt_2',
        number: 'QT-20260910-PRK',
        title: 'Parkade BOQ',
        client_id: 'cli_apex',
        site_id: 'site_2',
        status: 'accepted',
        issued_at: today,
        accepted_at: today,
      },
      {
        id: 'qt_3',
        number: 'QT-20260910-HAL',
        title: 'School hall tender',
        client_id: 'cli_schools',
        site_id: 'site_3',
        status: 'issued',
        issued_at: today,
      },
    ],
    drawings: [
      {
        id: 'drw_1',
        site_id: 'site_1',
        drawing_no: 'A-101',
        title: 'Ground floor GA',
        revision: 'C',
        discipline: 'architectural',
        status: 'for_construction',
      },
    ],
    boq: [
      {
        id: 'boq_1',
        site_id: 'site_1',
        quote_id: 'qt_1',
        item_no: '3.2.1',
        description: 'Reinforced concrete columns 25 MPa',
        uom: 'm³',
        qty: 420,
        rate: 2850,
        amount: 1_197_000,
        actual_qty: 180,
        actual_amount: 513_000,
      },
      {
        id: 'boq_2',
        site_id: 'site_2',
        quote_id: 'qt_2',
        item_no: '2.1.1',
        description: 'Basement excavation',
        uom: 'm³',
        qty: 2400,
        rate: 185,
        amount: 444_000,
      },
      {
        id: 'boq_3',
        site_id: 'site_3',
        quote_id: 'qt_3',
        item_no: '1.1',
        description: 'Hall superstructure',
        uom: 'sum',
        qty: 1,
        rate: 6_400_000,
        amount: 6_400_000,
      },
    ],
    costs: [
      {
        id: 'cost_1',
        site_id: 'site_1',
        boq_id: 'boq_1',
        kind: 'material',
        description: 'Ready-mix pour 1',
        amount: 410_000,
        date: today,
        cost_code: '3.2.1',
      },
      {
        id: 'cost_2',
        site_id: 'site_1',
        kind: 'labour',
        description: 'Steel-fixing week 1',
        amount: 96_000,
        date: today,
      },
    ],
    subcontractors: [
      {
        id: 'sub_1',
        name: 'Highveld Steel Fixers',
        trade: 'Reinforcing',
        site_id: 'site_1',
        contact: 'Thabo M.',
        status: 'appointed',
        contract_value: 2_400_000,
      },
    ],
    materials: [
      {
        id: 'mat_1',
        site_id: 'site_1',
        item: '25 MPa ready-mix',
        uom: 'm³',
        ordered_qty: 420,
        delivered_qty: 180,
        po_number: 'PO-8812',
      },
    ],
    plant: [
      {
        id: 'plt_1',
        site_id: 'site_1',
        plant_no: 'TC-12',
        description: 'Tower crane 8t',
        status: 'on_site',
        hired: true,
      },
    ],
    programme: [
      {
        id: 'prg_1',
        site_id: 'site_1',
        activity: 'Podium structure',
        start_date: today,
        planned_start: today,
        planned_end: addDaysIso(today, 90),
        actual_start: today,
        pct_complete: 32,
        planned_pct: 28,
        actual_pct: 32,
        status: 'in_progress',
      },
      {
        id: 'prg_2',
        site_id: 'site_2',
        activity: 'Parkade excavation',
        planned_start: today,
        planned_end: addDaysIso(today, 45),
        planned_pct: 10,
        actual_pct: 4,
        status: 'planned',
      },
    ],
    payments: [
      {
        id: 'pay_1',
        site_id: 'site_1',
        programme_id: 'prg_1',
        certificate_id: 'cert_1',
        number: 'PP-01',
        title: 'Podium month 1 — structure',
        planned_claim_date: today,
        planned_pay_date: addDaysIso(today, 21),
        planned_amount: 6_200_000,
        claimed_at: today,
        claimed_amount: 6_200_000,
        certified_at: today,
        certified_amount: 6_200_000,
        retention: 620_000,
        status: 'certified',
      },
      {
        id: 'pay_2',
        site_id: 'site_1',
        programme_id: 'prg_1',
        number: 'PP-02',
        title: 'Podium month 2 — structure',
        planned_claim_date: addDaysIso(today, 30),
        planned_pay_date: addDaysIso(today, 51),
        planned_amount: 5_800_000,
        status: 'planned',
      },
      {
        id: 'pay_3',
        site_id: 'site_2',
        programme_id: 'prg_2',
        number: 'PP-03',
        title: 'Parkade mobilisation',
        planned_claim_date: addDaysIso(today, 14),
        planned_pay_date: addDaysIso(today, 35),
        planned_amount: 1_200_000,
        status: 'planned',
      },
    ],
    safety: [
      {
        id: 'saf_1',
        site_id: 'site_1',
        kind: 'toolbox',
        title: 'Working at height',
        date: today,
        status: 'closed',
      },
    ],
    variations: [
      {
        id: 'var_1',
        site_id: 'site_1',
        number: 'VO-003',
        description: 'Additional lift-core walls',
        amount: 640_000,
        status: 'submitted',
      },
    ],
    certificates: [
      {
        id: 'cert_1',
        site_id: 'site_1',
        number: 'IPC-02',
        period: today.slice(0, 7),
        certified_amount: 6_200_000,
        retention: 620_000,
        issued_at: today,
        status: 'issued',
      },
    ],
    snags: [
      {
        id: 'snag_1',
        site_id: 'site_1',
        item: 'Basement waterproofing at grid C/4',
        location: 'B1',
        status: 'open',
        due_date: today,
      },
    ],
    portals: seededPortals,
    settings: {},
    updated_at: nowIso,
  });
}
