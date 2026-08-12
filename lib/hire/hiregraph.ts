/**
 * HireAdvisor® — hire / rental marketplace OS (B2C + suppliers).
 *
 * Parties: Core OS Suppliers (`srm_suppliers`) and Customers (`customers`).
 * Hire only stores catalogue items, bookings, handovers, and hire KYC cache
 * (keyed by CRM customer id). No local supplier/customer address books.
 *
 * Commercial model: 2.5% supplier + 2.5% customer commission on rental GMV
 * (see lib/hire/commercial.ts). Distinct from subscription-led Advisors.
 *
 * Stored on profiles.metadata.hiregraph (metadata-first, serverless-safe).
 */
import {
  computeHireCommissions,
  HIRE_CUSTOMER_COMMISSION_PCT,
  HIRE_SUPPLIER_COMMISSION_PCT,
} from '@/lib/hire/commercial';

export const HIREGRAPH_MODULE_ID = 'hiregraph' as const;
export const HIREGRAPH_META_KEY = 'hiregraph';

export {
  HIRE_CUSTOMER_COMMISSION_PCT,
  HIRE_SUPPLIER_COMMISSION_PCT,
  computeHireCommissions,
} from '@/lib/hire/commercial';

// ── Categories (each has different hire requirements) ────────────────────

export type HireRequirementKey =
  | 'id_document'
  | 'proof_of_address'
  | 'drivers_licence'
  | 'pdp_or_endorsement'
  | 'public_liability_insurance'
  | 'operator_certificate'
  | 'safety_induction'
  | 'site_access_permit'
  | 'age_18_plus'
  | 'age_21_plus'
  | 'credit_card_hold'
  | 'refundable_deposit'
  | 'delivery_address'
  | 'collection_vehicle'
  | 'supervisor_on_site'
  /** Kids party / jumping castle safety stack */
  | 'adult_supervision'
  | 'flat_level_ground'
  | 'power_access_220v'
  | 'soft_landing_area'
  | 'weather_safe_site'
  | 'max_child_age_weight';

export type HireCategoryDef = {
  id: string;
  name: string;
  short: string;
  description: string;
  /** Example catalogue items for suppliers */
  examples?: string[];
  /** Default deposit as % of rental (hint only) */
  defaultDepositPct?: number;
  /** Min hire unit */
  unit: 'hour' | 'day' | 'week' | 'weekend';
  requirements: HireRequirementKey[];
  /** Soft flags for UX */
  needsDelivery?: boolean;
  highValue?: boolean;
};

export const HIRE_REQUIREMENT_LABELS: Record<HireRequirementKey, string> = {
  id_document: 'Valid ID / passport',
  proof_of_address: 'Proof of address',
  drivers_licence: "Driver's licence (valid)",
  pdp_or_endorsement: 'PDP / vehicle endorsement',
  public_liability_insurance: 'Public liability insurance',
  operator_certificate: 'Operator / ticket certificate',
  safety_induction: 'Site safety induction',
  site_access_permit: 'Site access permit',
  age_18_plus: 'Age 18+ (hirer / responsible adult)',
  age_21_plus: 'Age 21+',
  credit_card_hold: 'Credit card authorisation hold',
  refundable_deposit: 'Refundable damage deposit',
  delivery_address: 'Delivery / site address',
  collection_vehicle: 'Suitable collection vehicle',
  supervisor_on_site: 'Competent supervisor on site',
  adult_supervision: 'Adult supervision while in use',
  flat_level_ground: 'Flat, level ground for setup',
  power_access_220v: '220V power access (blower / lights)',
  soft_landing_area: 'Clear soft-landing / safety perimeter',
  weather_safe_site: 'Weather-safe site (wind / rain rules)',
  max_child_age_weight: 'Age / weight limits for children observed',
};

/** Built-in hire categories — different compliance / KYC stacks */
export const HIRE_CATEGORIES: readonly HireCategoryDef[] = [
  {
    id: 'tools_equipment',
    name: 'Tools & small equipment',
    short: 'Tools',
    description: 'Power tools, ladders, hand tools, compressors under light duty.',
    defaultDepositPct: 20,
    unit: 'day',
    requirements: [
      'id_document',
      'age_18_plus',
      'refundable_deposit',
      'credit_card_hold',
    ],
  },
  {
    id: 'plant_machinery',
    name: 'Plant & machinery',
    short: 'Plant',
    description: 'Excavators, TLBs, rollers, cherry pickers — often operator + insurance.',
    defaultDepositPct: 30,
    unit: 'day',
    needsDelivery: true,
    highValue: true,
    requirements: [
      'id_document',
      'age_21_plus',
      'public_liability_insurance',
      'operator_certificate',
      'safety_induction',
      'delivery_address',
      'refundable_deposit',
      'credit_card_hold',
      'supervisor_on_site',
    ],
  },
  {
    id: 'vehicles',
    name: 'Vehicles & trailers',
    short: 'Vehicles',
    description: 'Bakkie, van, trailer, car — licence class and insurance checks.',
    defaultDepositPct: 25,
    unit: 'day',
    highValue: true,
    requirements: [
      'id_document',
      'age_21_plus',
      'drivers_licence',
      'pdp_or_endorsement',
      'proof_of_address',
      'refundable_deposit',
      'credit_card_hold',
    ],
  },
  {
    id: 'generators_power',
    name: 'Generators & power',
    short: 'Power',
    description: 'Generators, distribution boards, temporary power packs.',
    defaultDepositPct: 25,
    unit: 'day',
    needsDelivery: true,
    requirements: [
      'id_document',
      'age_18_plus',
      'delivery_address',
      'refundable_deposit',
      'credit_card_hold',
      'public_liability_insurance',
    ],
  },
  {
    id: 'construction_site',
    name: 'Construction site gear',
    short: 'Site',
    description: 'Scaffold, fencing, propping, site toilets, temporary works.',
    defaultDepositPct: 20,
    unit: 'week',
    needsDelivery: true,
    requirements: [
      'id_document',
      'site_access_permit',
      'safety_induction',
      'public_liability_insurance',
      'delivery_address',
      'refundable_deposit',
      'supervisor_on_site',
    ],
  },
  {
    id: 'kids_party',
    name: 'Kids party & play',
    short: 'Kids party',
    description:
      'Jumping castles, bounce houses, soft play, slides, ball pits, candy floss / popcorn machines and kids party packages for birthdays and school fairs.',
    examples: [
      'Jumping castle / bounce house',
      'Combo castle with slide',
      'Soft play set',
      'Ball pit',
      'Kids slide',
      'Candy floss machine',
      'Popcorn machine',
      'Face-paint / party package',
      'Obstacle course (kids)',
      'Water slide (kids)',
    ],
    defaultDepositPct: 20,
    unit: 'day',
    needsDelivery: true,
    highValue: true,
    requirements: [
      'id_document',
      'age_18_plus',
      'proof_of_address',
      'delivery_address',
      'flat_level_ground',
      'power_access_220v',
      'soft_landing_area',
      'adult_supervision',
      'max_child_age_weight',
      'weather_safe_site',
      'refundable_deposit',
      'credit_card_hold',
      'public_liability_insurance',
    ],
  },
  {
    id: 'party_events',
    name: 'Party & events',
    short: 'Events',
    description:
      'Tents, marquees, tables, chairs, PA, lighting and décor for private or corporate events. For jumping castles and kids play gear use Kids party & play.',
    examples: [
      'Marquee / gazebo',
      'Tables & chairs',
      'PA / speakers',
      'Lighting & décor',
      'Stage / dance floor',
    ],
    defaultDepositPct: 15,
    unit: 'weekend',
    needsDelivery: true,
    requirements: [
      'id_document',
      'age_18_plus',
      'proof_of_address',
      'delivery_address',
      'refundable_deposit',
      'credit_card_hold',
    ],
  },
  {
    id: 'audio_visual',
    name: 'Audio-visual & tech',
    short: 'AV',
    description: 'Projectors, screens, cameras, sound desks, conference kits.',
    defaultDepositPct: 25,
    unit: 'day',
    highValue: true,
    requirements: [
      'id_document',
      'age_18_plus',
      'proof_of_address',
      'refundable_deposit',
      'credit_card_hold',
    ],
  },
  {
    id: 'camping_outdoor',
    name: 'Camping & outdoor',
    short: 'Outdoor',
    description: 'Tents, trailers, outdoor kitchens, adventure gear.',
    defaultDepositPct: 15,
    unit: 'day',
    requirements: [
      'id_document',
      'age_18_plus',
      'refundable_deposit',
      'credit_card_hold',
    ],
  },
  {
    id: 'furniture_office',
    name: 'Furniture & office',
    short: 'Furniture',
    description: 'Temporary furniture, desks, display stands, modular fit-outs.',
    defaultDepositPct: 15,
    unit: 'week',
    needsDelivery: true,
    requirements: [
      'id_document',
      'proof_of_address',
      'delivery_address',
      'refundable_deposit',
    ],
  },
  {
    id: 'specialty_other',
    name: 'Specialty / other',
    short: 'Other',
    description: 'Custom hire categories — configure requirements per item.',
    defaultDepositPct: 20,
    unit: 'day',
    requirements: [
      'id_document',
      'age_18_plus',
      'refundable_deposit',
      'credit_card_hold',
    ],
  },
] as const;

export function getHireCategory(id: string | null | undefined) {
  return HIRE_CATEGORIES.find((c) => c.id === id) || null;
}

export function requirementsForCategory(categoryId: string): HireRequirementKey[] {
  return getHireCategory(categoryId)?.requirements || [
    'id_document',
    'refundable_deposit',
  ];
}

// ── Entity statuses ──────────────────────────────────────────────────────

export const SUPPLIER_STATUSES = [
  'pending',
  'active',
  'suspended',
  'offboarded',
] as const;

export const CUSTOMER_STATUSES = [
  'new',
  'verified',
  'blocked',
  'active',
] as const;

export const ITEM_STATUSES = [
  'draft',
  'listed',
  'paused',
  'hired_out',
  'maintenance',
  'retired',
] as const;

export const BOOKING_STATUSES = [
  'draft',
  'requested',
  'awaiting_requirements',
  'approved',
  'paid',
  'out',
  'returned',
  'completed',
  'cancelled',
  'disputed',
] as const;

export const HANDOVER_TYPES = ['out', 'return'] as const;

// ── Types ────────────────────────────────────────────────────────────────
// Suppliers & renters live in Core OS books (srm_suppliers + customers).
// HireAdvisor only stores hire items, bookings, handovers, and KYC cache.

/** Lightweight pointer used when denormalising names from core books */
export type HireCorePartyRef = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  status?: string | null;
  linked_profile_id?: number | null;
};

export type HireItem = {
  id: string;
  code: string;
  title: string;
  category_id: string;
  category_name?: string;
  /**
   * Core SRM book row id (`srm_suppliers.id`) — owner of the gear.
   * Prefer this over legacy local supplier_id.
   */
  srm_supplier_id?: number | null;
  /** @deprecated legacy local hire supplier id */
  supplier_id?: string | null;
  supplier_name?: string;
  description?: string;
  /** Day / hour / week rate in ZAR */
  rate_zar: number;
  rate_unit?: 'hour' | 'day' | 'week' | 'weekend' | string;
  qty_available?: number | null;
  deposit_zar?: number | null;
  /** Override category requirements when set */
  extra_requirements?: HireRequirementKey[];
  status?: (typeof ITEM_STATUSES)[number] | string;
  location?: string;
  photo_url?: string;
  notes?: string;
  active?: boolean;
  created_at: string;
  updated_at: string;
};

export type HireBooking = {
  id: string;
  code: string;
  item_id: string;
  item_title?: string;
  category_id?: string;
  srm_supplier_id?: number | null;
  /** @deprecated legacy local hire supplier id */
  supplier_id?: string | null;
  supplier_name?: string;
  /**
   * Core CRM customer id (`customers.id`) — person / company renting.
   * Prefer this over legacy local customer_id strings.
   */
  crm_customer_id?: number | null;
  /** @deprecated legacy local hire customer id */
  customer_id?: string | number | null;
  customer_name?: string;
  status?: (typeof BOOKING_STATUSES)[number] | string;
  start_date?: string | null;
  end_date?: string | null;
  /** Inclusive hire days (or hours if rate_unit hour) */
  units?: number | null;
  qty?: number | null;
  rate_zar?: number | null;
  rental_zar?: number | null;
  deposit_zar?: number | null;
  supplier_commission_pct?: number | null;
  customer_commission_pct?: number | null;
  supplier_commission_zar?: number | null;
  customer_commission_zar?: number | null;
  platform_total_zar?: number | null;
  supplier_net_zar?: number | null;
  customer_pays_zar?: number | null;
  /** Requirements still outstanding for this booking */
  requirements_pending?: HireRequirementKey[];
  requirements_met?: HireRequirementKey[];
  delivery_address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type HireHandover = {
  id: string;
  booking_id: string;
  booking_code?: string;
  type: 'out' | 'return' | string;
  at?: string | null;
  condition_notes?: string;
  photo_url?: string;
  signed_by?: string;
  damage_zar?: number | null;
  deposit_released?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type HiregraphStore = {
  /** v3: core SRM/CRM linked; no local supplier/customer books */
  version: 3;
  model: 'rental_marketplace';
  /**
   * Hire-specific KYC / requirements met, keyed by CRM `customers.id`.
   * Core CRM remains source of party identity; this is hire-only checklist state.
   */
  customer_kyc: Record<string, HireRequirementKey[]>;
  items: HireItem[];
  bookings: HireBooking[];
  handovers: HireHandover[];
};

export function emptyHiregraphStore(): HiregraphStore {
  return {
    version: 3,
    model: 'rental_marketplace',
    customer_kyc: {},
    items: [],
    bookings: [],
    handovers: [],
  };
}

export function newId(prefix = 'hg'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readHiregraphFromMetadata(
  meta: Record<string, unknown> | null | undefined
): HiregraphStore {
  const raw = meta?.[HIREGRAPH_META_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyHiregraphStore();
  }
  const s = raw as Partial<HiregraphStore> & Record<string, unknown>;
  // Migrate away from legacy staffing shape (clients/candidates/jobs…)
  if (s.model !== 'rental_marketplace' && (s.clients || s.candidates || s.jobs)) {
    return emptyHiregraphStore();
  }
  // Drop legacy local suppliers/customers arrays — core books own parties
  const customer_kyc =
    s.customer_kyc && typeof s.customer_kyc === 'object' && !Array.isArray(s.customer_kyc)
      ? (s.customer_kyc as Record<string, HireRequirementKey[]>)
      : {};
  return {
    version: 3,
    model: 'rental_marketplace',
    customer_kyc,
    items: Array.isArray(s.items) ? (s.items as HireItem[]) : [],
    bookings: Array.isArray(s.bookings) ? (s.bookings as HireBooking[]) : [],
    handovers: Array.isArray(s.handovers) ? (s.handovers as HireHandover[]) : [],
  };
}

export function writeHiregraphToMetadata(
  meta: Record<string, unknown>,
  store: HiregraphStore
): Record<string, unknown> {
  return {
    ...meta,
    [HIREGRAPH_META_KEY]: {
      version: 3,
      model: 'rental_marketplace',
      links_core_books: true,
      customer_kyc: store.customer_kyc || {},
      items: store.items,
      bookings: store.bookings,
      handovers: store.handovers,
      commercial: {
        supplier_commission_pct: HIRE_SUPPLIER_COMMISSION_PCT,
        customer_commission_pct: HIRE_CUSTOMER_COMMISSION_PCT,
      },
    },
  };
}

export type HireEntity = 'items' | 'bookings' | 'handovers';

export function listForEntity(
  store: HiregraphStore,
  entity: HireEntity
): Array<Record<string, unknown> & { id: string }> {
  return (store[entity] as Array<Record<string, unknown> & { id: string }>) || [];
}

export function upsertEntity(
  store: HiregraphStore,
  entity: HireEntity,
  record: Record<string, unknown>
): HiregraphStore {
  const now = new Date().toISOString();
  const list = [...listForEntity(store, entity)];
  const id =
    typeof record.id === 'string' && record.id.trim()
      ? record.id
      : newId(entity.slice(0, 3));
  const idx = list.findIndex((r) => r.id === id);
  const prev = idx >= 0 ? list[idx] : null;
  let next: Record<string, unknown> & { id: string } = {
    ...prev,
    ...record,
    id,
    created_at:
      (prev?.created_at as string) ||
      (typeof record.created_at === 'string' ? record.created_at : now),
    updated_at: now,
  };

  if (entity === 'bookings') {
    next = enrichBooking(store, next);
  }
  if (entity === 'items' && next.category_id) {
    const cat = getHireCategory(String(next.category_id));
    if (cat && !next.category_name) next.category_name = cat.name;
    if (cat && next.rate_unit == null) next.rate_unit = cat.unit;
  }

  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  return { ...store, [entity]: list } as HiregraphStore;
}

export function deleteEntity(
  store: HiregraphStore,
  entity: HireEntity,
  id: string
): HiregraphStore {
  const list = listForEntity(store, entity).filter((r) => r.id !== id);
  return { ...store, [entity]: list } as HiregraphStore;
}

/** Attach commercial split + requirement gaps when saving a booking */
function enrichBooking(
  store: HiregraphStore,
  raw: Record<string, unknown> & { id: string }
): Record<string, unknown> & { id: string } {
  const item = store.items.find((i) => i.id === raw.item_id);
  const crmId = Number(raw.crm_customer_id || raw.customer_id) || null;
  const srmId =
    Number(raw.srm_supplier_id || item?.srm_supplier_id) || null;
  const categoryId = String(
    raw.category_id || item?.category_id || 'specialty_other'
  );
  const cat = getHireCategory(categoryId);
  const units = Math.max(1, Number(raw.units) || 1);
  const qty = Math.max(1, Number(raw.qty) || 1);
  const rate = Number(raw.rate_zar ?? item?.rate_zar) || 0;
  const rentalZar =
    Number(raw.rental_zar) > 0 ? Number(raw.rental_zar) : rate * units * qty;
  const depositZar =
    Number(raw.deposit_zar) > 0
      ? Number(raw.deposit_zar)
      : Number(item?.deposit_zar) ||
        (cat?.defaultDepositPct
          ? Math.round((rentalZar * cat.defaultDepositPct) / 100)
          : 0);

  const fees = computeHireCommissions({
    rentalZar,
    depositZar,
    supplierPct:
      Number(raw.supplier_commission_pct) || HIRE_SUPPLIER_COMMISSION_PCT,
    customerPct:
      Number(raw.customer_commission_pct) || HIRE_CUSTOMER_COMMISSION_PCT,
  });

  const required = [
    ...requirementsForCategory(categoryId),
    ...((item?.extra_requirements || []) as HireRequirementKey[]),
  ];
  const uniqueReq = [...new Set(required)];
  const kycKey = crmId != null ? String(crmId) : '';
  const metFromKyc = new Set(
    kycKey ? store.customer_kyc[kycKey] || [] : []
  );
  const metFromBooking = new Set(
    (raw.requirements_met as HireRequirementKey[]) || []
  );
  const met = uniqueReq.filter(
    (r) => metFromKyc.has(r) || metFromBooking.has(r)
  );
  const pending = uniqueReq.filter((r) => !met.includes(r));

  // Persist booking-level met requirements back into customer KYC cache
  if (kycKey && met.length) {
    const prev = new Set(store.customer_kyc[kycKey] || []);
    for (const r of met) prev.add(r);
    store.customer_kyc[kycKey] = [...prev];
  }

  return {
    ...raw,
    item_title: raw.item_title || item?.title || '',
    category_id: categoryId,
    srm_supplier_id: srmId,
    supplier_name: raw.supplier_name || item?.supplier_name || '',
    crm_customer_id: crmId,
    customer_id: crmId,
    customer_name: raw.customer_name || '',
    units,
    qty,
    rate_zar: rate,
    rental_zar: fees.rentalZar,
    deposit_zar: fees.depositZar,
    supplier_commission_pct: fees.supplierCommissionPct,
    customer_commission_pct: fees.customerCommissionPct,
    supplier_commission_zar: fees.supplierCommissionZar,
    customer_commission_zar: fees.customerCommissionZar,
    platform_total_zar: fees.platformTotalZar,
    supplier_net_zar: fees.supplierNetZar,
    customer_pays_zar: fees.customerPaysZar,
    requirements_met: met,
    requirements_pending: pending,
  };
}

export function summariseHiregraph(
  store: HiregraphStore,
  opts?: { coreSupplierCount?: number; coreCustomerCount?: number }
) {
  const listed = store.items.filter(
    (i) => i.status === 'listed' || i.status === 'hired_out' || !i.status
  ).length;
  const openBookings = store.bookings.filter((b) =>
    ['requested', 'awaiting_requirements', 'approved', 'paid', 'out'].includes(
      String(b.status || '')
    )
  ).length;
  const outNow = store.bookings.filter((b) => b.status === 'out').length;
  const completed = store.bookings.filter(
    (b) => b.status === 'completed' || b.status === 'returned'
  );
  const gmv = completed.reduce((s, b) => s + (Number(b.rental_zar) || 0), 0);
  const platformFees = completed.reduce(
    (s, b) => s + (Number(b.platform_total_zar) || 0),
    0
  );
  const supplierFees = completed.reduce(
    (s, b) => s + (Number(b.supplier_commission_zar) || 0),
    0
  );
  const customerFees = completed.reduce(
    (s, b) => s + (Number(b.customer_commission_zar) || 0),
    0
  );
  const byCategory: Record<string, number> = {};
  for (const i of store.items) {
    const k = i.category_id || 'specialty_other';
    byCategory[k] = (byCategory[k] || 0) + 1;
  }
  const linkedSupplierIds = new Set(
    store.items
      .map((i) => Number(i.srm_supplier_id))
      .filter((n) => Number.isFinite(n) && n > 0)
  );
  const linkedCustomerIds = new Set(
    store.bookings
      .map((b) => Number(b.crm_customer_id || b.customer_id))
      .filter((n) => Number.isFinite(n) && n > 0)
  );

  return {
    /** From core SRM book when provided */
    supplierCount:
      opts?.coreSupplierCount ?? linkedSupplierIds.size,
    /** From core CRM book when provided */
    customerCount:
      opts?.coreCustomerCount ?? linkedCustomerIds.size,
    linkedSupplierCount: linkedSupplierIds.size,
    linkedCustomerCount: linkedCustomerIds.size,
    itemCount: store.items.length,
    listedItems: listed,
    bookingCount: store.bookings.length,
    openBookings,
    outNow,
    completedBookings: completed.length,
    gmvZar: gmv,
    platformFeesZar: platformFees,
    supplierCommissionZar: supplierFees,
    customerCommissionZar: customerFees,
    supplierCommissionPct: HIRE_SUPPLIER_COMMISSION_PCT,
    customerCommissionPct: HIRE_CUSTOMER_COMMISSION_PCT,
    categoryCounts: byCategory,
    handoverCount: store.handovers.length,
    linksCoreBooks: true,
  };
}

/** Effective requirements for an item (category + extras) */
export function itemRequirements(item: HireItem): HireRequirementKey[] {
  const base = requirementsForCategory(item.category_id);
  const extra = item.extra_requirements || [];
  return [...new Set([...base, ...extra])];
}
