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
import { applyDateUnits, busyDatesForItem } from '@/lib/hire/availability';
import {
  normalizeAnnouncements,
  publishedAnnouncements,
} from '@/lib/services/member-announcements';
import type { MemberAnnouncement } from '@/lib/services/member-announcements';
import { logoUrlFromSettings } from '@/lib/business/company-logo';
import { isPortalSectionOn } from '@/lib/advisors/portal-sections';
import { compactWorkingHours } from '@/lib/schedule/working-hours';
import { hireCommandBookingMetrics } from '@/lib/advisors/command-booking-metrics';

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
  /** What the hirer receives (kit contents) */
  includes?: string;
  /** Not included / hirer must supply */
  excludes?: string;
  specs?: string;
  condition_notes?: string;
  min_units?: number | null;
  fulfillment?: 'collect' | 'delivery' | 'both' | string;
  delivery_fee_zar?: number | null;
  delivery_radius_km?: number | null;
  collect_hours?: string;
  replacement_value_zar?: number | null;
  setup_minutes?: number | null;
  fuel_or_power?: string;
  age_or_weight_limit?: string;
  operator_included?: boolean;
  cancellation_note?: string;
  /** Core inventory product this hire SKU is drawn from */
  inventory_product_id?: number | null;
  /** marketplace_listings.id when published for hire */
  marketplace_listing_id?: number | null;
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

/**
 * B2C customer portal record — one per Core CRM customer.
 * Parties stay in CRM; this only holds portal access + preferences.
 */
export type HireCustomerPortal = {
  crm_customer_id: number;
  portal_token: string;
  issued_at: string;
  last_seen_at?: string | null;
  invite_email?: string | null;
  invite_sent_at?: string | null;
  /** Portal-side contact overrides (desk still owns CRM book) */
  preferred_phone?: string | null;
  preferred_email?: string | null;
  delivery_default?: string | null;
  notes?: string | null;
  active?: boolean;
};

/** Marketplace brand / portal settings for the hire company */
export type HirePublicSettings = {
  brand_name?: string;
  public_bio?: string;
  contact_email?: string;
  contact_phone?: string;
  city?: string;
  website_url?: string;
  /** Publish the public catalogue embed */
  enabled?: boolean;
  /** Company-wide website token (not a customer portal token) */
  public_token?: string;
  /** Allow customers to request hire from portal (default true) */
  allow_portal_booking?: boolean;
  portal_sections?: Record<string, boolean>;
  primary_color?: string;
  timezone?: string;
  has_front_desk?: boolean;
  desk_name?: string;
  desk_email?: string | null;
  desk_invite_status?: string | null;
  desk_invite_sent_at?: string | null;
  desk_invite_accepted_at?: string | null;
  desk_team_member_id?: number | null;
  desk_last_invited_email?: string | null;
  pwa_enabled?: boolean;
  pwa_name?: string;
  pwa_short_name?: string;
  pwa_description?: string;
  pwa_theme_color?: string;
  pwa_background_color?: string;
  pwa_icon_url?: string | null;
  company_logo_url?: string | null;
  working_hours?: import('@/lib/schedule/working-hours').WorkingHours;
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
  /**
   * B2C portal access keyed by CRM `customers.id`.
   */
  customer_portals: Record<string, HireCustomerPortal>;
  settings?: HirePublicSettings;
  announcements?: MemberAnnouncement[];
  items: HireItem[];
  bookings: HireBooking[];
  handovers: HireHandover[];
};

export function emptyHiregraphStore(): HiregraphStore {
  return {
    version: 3,
    model: 'rental_marketplace',
    customer_kyc: {},
    customer_portals: {},
    settings: defaultHirePublicSettings(),
    announcements: [],
    items: [],
    bookings: [],
    handovers: [],
  };
}

export function defaultHirePublicSettings(): HirePublicSettings {
  return {
    allow_portal_booking: true,
    primary_color: '#0891b2',
    timezone: 'Africa/Johannesburg',
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
  const customer_portals =
    s.customer_portals &&
    typeof s.customer_portals === 'object' &&
    !Array.isArray(s.customer_portals)
      ? (s.customer_portals as Record<string, HireCustomerPortal>)
      : {};
  const settings: HirePublicSettings = {
    ...defaultHirePublicSettings(),
    ...(s.settings && typeof s.settings === 'object' && !Array.isArray(s.settings)
      ? (s.settings as HirePublicSettings)
      : {}),
  };
  return {
    version: 3,
    model: 'rental_marketplace',
    customer_kyc,
    customer_portals,
    settings,
    announcements: normalizeAnnouncements(s.announcements),
    items: Array.isArray(s.items) ? (s.items as HireItem[]) : [],
    bookings: Array.isArray(s.bookings) ? (s.bookings as HireBooking[]) : [],
    handovers: Array.isArray(s.handovers) ? (s.handovers as HireHandover[]) : [],
  };
}

/** Root metadata index: portal_token → CRM customer id (fast public resolve) */
export const HIREGRAPH_CUSTOMER_TOKENS_KEY = 'hiregraph_customer_tokens';
/** Root metadata index for the public catalogue embed */
export const HIREGRAPH_PUBLIC_TOKEN_KEY = 'hiregraph_public_token';

export function writeHiregraphToMetadata(
  meta: Record<string, unknown>,
  store: HiregraphStore
): Record<string, unknown> {
  const customerTokens: Record<string, number> = {};
  for (const p of Object.values(store.customer_portals || {})) {
    if (p?.portal_token && p.active !== false && p.crm_customer_id) {
      customerTokens[String(p.portal_token)] = Number(p.crm_customer_id);
    }
  }
  return {
    ...meta,
    [HIREGRAPH_META_KEY]: {
      version: 3,
      model: 'rental_marketplace',
      links_core_books: true,
      customer_kyc: store.customer_kyc || {},
      customer_portals: store.customer_portals || {},
      settings: store.settings || defaultHirePublicSettings(),
      announcements: normalizeAnnouncements(store.announcements),
      items: store.items,
      bookings: store.bookings,
      handovers: store.handovers,
      commercial: {
        supplier_commission_pct: HIRE_SUPPLIER_COMMISSION_PCT,
        customer_commission_pct: HIRE_CUSTOMER_COMMISSION_PCT,
      },
    },
    [HIREGRAPH_CUSTOMER_TOKENS_KEY]: customerTokens,
    [HIREGRAPH_PUBLIC_TOKEN_KEY]: store.settings?.public_token || null,
  };
}

export function issueHirePublicToken(companyId: number): string {
  return `hire_pub_${companyId}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function parseCompanyIdFromHirePublicToken(
  token: string
): number | null {
  const m = /^hire_pub_(\d+)_/.exec(String(token || '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function ensureHirePublicToken(
  store: HiregraphStore,
  companyId: number
): HiregraphStore {
  if (store.settings?.public_token) return store;
  return {
    ...store,
    settings: {
      ...defaultHirePublicSettings(),
      ...(store.settings || {}),
      public_token: issueHirePublicToken(companyId),
    },
  };
}

export function hirePublicEmbedPath(token: string): string {
  return `/embed/hire/${encodeURIComponent(token)}`;
}

/** Issue B2C portal token (embeds company id for fast resolve). */
export function issueHireCustomerPortalToken(companyId: number): string {
  return `hire_cust_${companyId}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

export function parseCompanyIdFromHireCustomerToken(
  token: string
): number | null {
  const m = /^hire_cust_(\d+)_/.exec(String(token || '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function hireCustomerPortalPath(portalToken: string): string {
  return `/hire/${encodeURIComponent(portalToken)}`;
}

export function hireCustomerPortalUrl(
  origin: string,
  portalToken: string
): string {
  return `${origin.replace(/\/$/, '')}${hireCustomerPortalPath(portalToken)}`;
}

/** Issue or re-issue portal access for a Core CRM customer. */
export function issueCustomerPortal(
  store: HiregraphStore,
  crmCustomerId: number,
  opts?: { invite_email?: string | null; companyId: number }
): { store: HiregraphStore; portal: HireCustomerPortal } {
  const key = String(crmCustomerId);
  const now = new Date().toISOString();
  const companyId = opts?.companyId ?? 0;
  const prev = store.customer_portals?.[key];
  const existing = String(prev?.portal_token || '').trim();
  const portal: HireCustomerPortal = {
    crm_customer_id: crmCustomerId,
    portal_token:
      prev?.active !== false && existing
        ? existing
        : issueHireCustomerPortalToken(companyId || crmCustomerId),
    issued_at: now,
    last_seen_at: prev?.last_seen_at || null,
    invite_email: opts?.invite_email ?? prev?.invite_email ?? null,
    invite_sent_at: opts?.invite_email ? now : prev?.invite_sent_at || null,
    preferred_phone: prev?.preferred_phone || null,
    preferred_email: prev?.preferred_email || null,
    delivery_default: prev?.delivery_default || null,
    notes: prev?.notes || null,
    active: true,
  };
  return {
    store: {
      ...store,
      customer_portals: {
        ...(store.customer_portals || {}),
        [key]: portal,
      },
    },
    portal,
  };
}

export function findPortalByToken(
  store: HiregraphStore,
  token: string
): HireCustomerPortal | null {
  const clean = String(token || '').trim();
  if (!clean) return null;
  for (const p of Object.values(store.customer_portals || {})) {
    if (p?.portal_token === clean && p.active !== false) return p;
  }
  return null;
}

export function bookingStatusLabel(status: string | null | undefined): string {
  const s = String(status || 'requested');
  const map: Record<string, string> = {
    draft: 'Draft',
    requested: 'Requested',
    awaiting_requirements: 'Needs documents',
    approved: 'Approved',
    paid: 'Paid',
    out: 'Out on hire',
    returned: 'Returned',
    completed: 'Completed',
    cancelled: 'Cancelled',
    disputed: 'Disputed',
  };
  return map[s] || s;
}

const STATUS_STEPS = [
  'requested',
  'awaiting_requirements',
  'approved',
  'paid',
  'out',
  'returned',
  'completed',
] as const;

export function bookingStatusTimeline(
  status: string | null | undefined
): Array<{ id: string; label: string; done: boolean; current: boolean }> {
  const cur = String(status || 'requested');
  if (cur === 'cancelled' || cur === 'disputed') {
    return [
      ...STATUS_STEPS.map((step) => ({
        id: step as string,
        label: bookingStatusLabel(step),
        done: false,
        current: false,
      })),
      {
        id: cur,
        label: bookingStatusLabel(cur),
        done: true,
        current: true,
      },
    ];
  }
  const idx = STATUS_STEPS.indexOf(cur as (typeof STATUS_STEPS)[number]);
  const activeIdx = idx >= 0 ? idx : 0;
  return STATUS_STEPS.map((step, i) => ({
    id: step as string,
    label: bookingStatusLabel(step),
    done: i < activeIdx,
    current: i === activeIdx,
  }));
}

/**
 * Customer portal payload — catalogue, my bookings, KYC, handovers, quotes.
 * Safe for public token auth (no other customers' PII).
 */
export function buildHireCustomerPortalPayload(
  store: HiregraphStore,
  portal: HireCustomerPortal,
  customer: HireCorePartyRef,
  opts?: { companyName?: string | null }
) {
  const crmId = portal.crm_customer_id;
  const kyc = store.customer_kyc?.[String(crmId)] || [];
  const kycSet = new Set(kyc);
  const settings = {
    ...defaultHirePublicSettings(),
    ...(store.settings || {}),
  };
  const brand =
    settings.brand_name ||
    opts?.companyName ||
    'Hire marketplace';

  const catalogue = (store.items || [])
    .filter(
      (i) =>
        i.active !== false &&
        (i.status === 'listed' || i.status === 'hired_out' || !i.status)
    )
    .map((item) => {
      const reqs = itemRequirements(item);
      const pending = reqs.filter((r) => !kycSet.has(r));
      const cat = getHireCategory(item.category_id);
      return {
        id: item.id,
        code: item.code,
        title: item.title,
        description: item.description || '',
        category_id: item.category_id,
        category_name: item.category_name || cat?.name || item.category_id,
        category_short: cat?.short || '',
        rate_zar: Number(item.rate_zar) || 0,
        rate_unit: item.rate_unit || cat?.unit || 'day',
        deposit_zar: item.deposit_zar != null ? Number(item.deposit_zar) : null,
        default_deposit_pct: cat?.defaultDepositPct ?? null,
        qty_available: item.qty_available ?? null,
        location: item.location || '',
        photo_url: item.photo_url || null,
        supplier_name: item.supplier_name || '',
        status: item.status || 'listed',
        needs_delivery: Boolean(cat?.needsDelivery),
        high_value: Boolean(cat?.highValue),
        requirements: reqs.map((r) => ({
          key: r,
          label: HIRE_REQUIREMENT_LABELS[r] || r,
          met: kycSet.has(r),
        })),
        requirements_pending: pending,
        requirements_ready: pending.length === 0,
        examples: cat?.examples || [],
        busy_dates: busyDatesForItem(store, item.id),
        ...hireListingDetails(item),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const my_bookings = (store.bookings || [])
    .filter((b) => Number(b.crm_customer_id || b.customer_id) === crmId)
    .map((b) => {
      const item = store.items.find((i) => i.id === b.item_id);
      const handovers = (store.handovers || [])
        .filter((h) => h.booking_id === b.id)
        .map((h) => ({
          id: h.id,
          type: h.type,
          at: h.at || h.created_at,
          condition_notes: h.condition_notes || '',
          signed_by: h.signed_by || '',
          damage_zar: h.damage_zar ?? null,
          deposit_released: Boolean(h.deposit_released),
        }))
        .sort((a, b2) => String(b2.at).localeCompare(String(a.at)));
      const pending = (b.requirements_pending || []) as HireRequirementKey[];
      return {
        id: b.id,
        code: b.code,
        item_id: b.item_id,
        item_title: b.item_title || item?.title || b.item_id,
        category_id: b.category_id || item?.category_id,
        supplier_name: b.supplier_name || item?.supplier_name || '',
        status: b.status || 'requested',
        status_label: bookingStatusLabel(b.status),
        timeline: bookingStatusTimeline(b.status),
        start_date: b.start_date || null,
        end_date: b.end_date || null,
        duration_label: `${b.units || 1} ${(item?.rate_unit || 'day')}${
          Number(b.units || 1) === 1 ? '' : 's'
        }`,
        can_extend: ['approved', 'paid', 'out'].includes(String(b.status || '')),
        units: b.units ?? null,
        qty: b.qty ?? null,
        rate_zar: b.rate_zar ?? null,
        rental_zar: b.rental_zar ?? null,
        deposit_zar: b.deposit_zar ?? null,
        customer_commission_pct: b.customer_commission_pct ?? HIRE_CUSTOMER_COMMISSION_PCT,
        customer_commission_zar: b.customer_commission_zar ?? null,
        customer_pays_zar: b.customer_pays_zar ?? null,
        delivery_address: b.delivery_address || '',
        notes: b.notes || '',
        requirements_pending: pending.map((r) => ({
          key: r,
          label: HIRE_REQUIREMENT_LABELS[r] || r,
        })),
        requirements_met: ((b.requirements_met || []) as HireRequirementKey[]).map(
          (r) => ({
            key: r,
            label: HIRE_REQUIREMENT_LABELS[r] || r,
          })
        ),
        handovers,
        created_at: b.created_at,
        can_cancel: ['requested', 'awaiting_requirements', 'approved'].includes(
          String(b.status || '')
        ),
      };
    })
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const open = my_bookings.filter((b) =>
    ['requested', 'awaiting_requirements', 'approved', 'paid', 'out'].includes(
      String(b.status)
    )
  );
  const needsDocs = my_bookings.filter(
    (b) =>
      b.status === 'awaiting_requirements' || b.requirements_pending.length > 0
  );

  const categories = HIRE_CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    short: c.short,
    description: c.description,
    unit: c.unit,
    item_count: catalogue.filter((i) => i.category_id === c.id).length,
  })).filter((c) => c.item_count > 0);

  const allReqKeys = [
    ...new Set(catalogue.flatMap((i) => i.requirements.map((r) => r.key))),
  ] as HireRequirementKey[];

  return {
    brand,
    public_token: settings.public_token || null,
    logo_url: logoUrlFromSettings(
      settings as { company_logo_url?: string | null }
    ),
    bio: settings.public_bio || '',
    contact_email: settings.contact_email || customer.email || null,
    contact_phone: settings.contact_phone || customer.phone || null,
    city: settings.city || customer.city || null,
    primary_color: settings.primary_color || '#0891b2',
    timezone: settings.timezone || 'Africa/Johannesburg',
    allow_booking: settings.allow_portal_booking !== false,
    commercial: {
      customer_commission_pct: HIRE_CUSTOMER_COMMISSION_PCT,
      supplier_commission_pct: HIRE_SUPPLIER_COMMISSION_PCT,
      note: HIRE_CUSTOMER_COMMISSION_PCT
        ? `You pay rental + ${HIRE_CUSTOMER_COMMISSION_PCT}% platform fee + refundable deposit. Deposits are not commissionable.`
        : 'You pay the hire rental and any refundable deposit. No platform fee — SA Member is free.',
    },
    customer: {
      id: customer.id,
      name: customer.name,
      email: portal.preferred_email || customer.email || null,
      phone: portal.preferred_phone || customer.phone || null,
      city: customer.city || null,
      delivery_default: portal.delivery_default || null,
      crm_id: crmId,
    },
    kyc: {
      met: kyc.map((r) => ({
        key: r,
        label: HIRE_REQUIREMENT_LABELS[r] || r,
      })),
      available: allReqKeys.map((r) => ({
        key: r,
        label: HIRE_REQUIREMENT_LABELS[r] || r,
        met: kycSet.has(r),
      })),
      common: (
        [
          'id_document',
          'proof_of_address',
          'drivers_licence',
          'age_18_plus',
          'age_21_plus',
          'credit_card_hold',
          'adult_supervision',
          'flat_level_ground',
          'power_access_220v',
          'delivery_address',
        ] as HireRequirementKey[]
      ).map((r) => ({
        key: r,
        label: HIRE_REQUIREMENT_LABELS[r] || r,
        met: kycSet.has(r),
      })),
    },
    announcements: publishedAnnouncements(store.announcements),
    categories,
    catalogue,
    catalogue_count: catalogue.length,
    my_bookings,
    open_bookings: open,
    needs_docs_count: needsDocs.length,
    open_count: open.length,
    stats: {
      catalogue: catalogue.length,
      my_hires: my_bookings.length,
      open: open.length,
      needs_docs: needsDocs.length,
      kyc_met: kyc.length,
    },
  };
}

/** Quote a hire without persisting — for portal live preview */
export function quoteHireBooking(
  store: HiregraphStore,
  opts: {
    item_id: string;
    units?: number;
    qty?: number;
    crm_customer_id?: number;
    start_date?: string | null;
    end_date?: string | null;
  }
) {
  const item = store.items.find((i) => i.id === opts.item_id);
  if (!item) return null;
  const dated = applyDateUnits(
    {
      start_date: opts.start_date,
      end_date: opts.end_date,
      units: opts.units,
    },
    item.rate_unit
  );
  const units = dated.units;
  const qty = Math.max(1, Number(opts.qty) || 1);
  const rate = Number(item.rate_zar) || 0;
  const rental = rate * units * qty;
  const cat = getHireCategory(item.category_id);
  const deposit =
    Number(item.deposit_zar) ||
    (cat?.defaultDepositPct
      ? Math.round((rental * cat.defaultDepositPct) / 100)
      : 0);
  const fees = computeHireCommissions({ rentalZar: rental, depositZar: deposit });
  const reqs = itemRequirements(item);
  const kycKey =
    opts.crm_customer_id != null ? String(opts.crm_customer_id) : '';
  const met = new Set(kycKey ? store.customer_kyc[kycKey] || [] : []);
  const pending = reqs.filter((r) => !met.has(r));
  return {
    item_id: item.id,
    item_title: item.title,
    rate_zar: rate,
    rate_unit: item.rate_unit || cat?.unit || 'day',
    units,
    qty,
    start_date: dated.start_date,
    end_date: dated.end_date,
    duration_label: `${units} ${item.rate_unit || 'day'}${units === 1 ? '' : 's'}`,
    fees,
    requirements: reqs.map((r) => ({
      key: r,
      label: HIRE_REQUIREMENT_LABELS[r] || r,
      met: met.has(r),
    })),
    pending: pending.map((r) => ({
      key: r,
      label: HIRE_REQUIREMENT_LABELS[r] || r,
    })),
    ready: pending.length === 0,
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
  const dated = applyDateUnits(
    {
      start_date: raw.start_date as string | null,
      end_date: raw.end_date as string | null,
      units: raw.units as number | null,
    },
    String(raw.rate_unit || item?.rate_unit || cat?.unit || 'day')
  );
  const units = dated.units;
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
    start_date: dated.start_date,
    end_date: dated.end_date,
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
    customerPortalCount: Object.values(store.customer_portals || {}).filter(
      (p) => p?.active !== false && p?.portal_token
    ).length,
    websiteEnabled: store.settings?.enabled === true,
    publicTokenIssued: Boolean(store.settings?.public_token),
    liveAnnouncements: publishedAnnouncements(store.announcements).length,
    ...hireCommandBookingMetrics(store),
    inventoryProductIds: store.items
      .map((i) => Number(i.inventory_product_id))
      .filter((n) => Number.isFinite(n) && n > 0),
  };
}

export function buildHirePublicWebsitePayload(
  store: HiregraphStore,
  opts?: { companyName?: string | null }
) {
  const settings = {
    ...defaultHirePublicSettings(),
    ...(store.settings || {}),
  };
  const brand =
    settings.brand_name || opts?.companyName || 'Hire marketplace';
  const catalogue = (store.items || [])
    .filter(
      (i) =>
        i.active !== false &&
        (i.status === 'listed' || i.status === 'hired_out' || !i.status)
    )
    .map((item) => {
      const cat = getHireCategory(item.category_id);
      return {
        id: item.id,
        title: item.title,
        description: item.description || '',
        category_name: item.category_name || cat?.name || item.category_id,
        rate_zar: Number(item.rate_zar) || 0,
        rate_unit: item.rate_unit || cat?.unit || 'day',
        deposit_zar: item.deposit_zar != null ? Number(item.deposit_zar) : null,
        location: item.location || '',
        photo_url: item.photo_url || null,
        qty_available: item.qty_available ?? null,
        ...hireListingDetails(item),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
  return {
    brand,
    bio: settings.public_bio || '',
    contact_email: settings.contact_email || null,
    contact_phone: settings.contact_phone || null,
    city: settings.city || null,
    website_url: settings.website_url || null,
    logo_url: logoUrlFromSettings(
      settings as { company_logo_url?: string | null }
    ),
    primary_color: settings.primary_color || '#0891b2',
    allow_booking: settings.allow_portal_booking !== false,
    enabled: settings.enabled === true,
    announcements: isPortalSectionOn(settings, 'news')
      ? publishedAnnouncements(store.announcements)
      : [],
    catalogue: isPortalSectionOn(settings, 'catalogue') ? catalogue : [],
    hours: isPortalSectionOn(settings, 'hours')
      ? compactWorkingHours(settings.working_hours)
      : [],
    sections: {
      news: isPortalSectionOn(settings, 'news'),
      catalogue: isPortalSectionOn(settings, 'catalogue'),
      hours: isPortalSectionOn(settings, 'hours'),
      contact: isPortalSectionOn(settings, 'contact'),
    },
  };
}

/** Public listing facts a hirer needs before requesting an item. */
export function hireListingDetails(item: HireItem) {
  const cat = getHireCategory(item.category_id);
  const fulfillment =
    item.fulfillment ||
    (cat?.needsDelivery ? 'delivery' : 'collect');
  return {
    includes: item.includes || '',
    excludes: item.excludes || '',
    specs: item.specs || '',
    condition_notes: item.condition_notes || '',
    min_units: item.min_units != null ? Number(item.min_units) : 1,
    fulfillment,
    fulfillment_label:
      fulfillment === 'delivery'
        ? 'Delivered to you'
        : fulfillment === 'both'
          ? 'Collect or delivery'
          : 'Collect from desk',
    delivery_fee_zar:
      item.delivery_fee_zar != null ? Number(item.delivery_fee_zar) : null,
    delivery_radius_km:
      item.delivery_radius_km != null ? Number(item.delivery_radius_km) : null,
    collect_hours: item.collect_hours || '',
    replacement_value_zar:
      item.replacement_value_zar != null
        ? Number(item.replacement_value_zar)
        : null,
    setup_minutes:
      item.setup_minutes != null ? Number(item.setup_minutes) : null,
    fuel_or_power: item.fuel_or_power || '',
    age_or_weight_limit: item.age_or_weight_limit || '',
    operator_included: item.operator_included === true,
    cancellation_note: item.cancellation_note || '',
  };
}

/** Effective requirements for an item (category + extras) */
export function itemRequirements(item: HireItem): HireRequirementKey[] {
  const base = requirementsForCategory(item.category_id);
  const extra = item.extra_requirements || [];
  return [...new Set([...base, ...extra])];
}
