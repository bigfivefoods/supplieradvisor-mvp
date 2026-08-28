/**
 * RetailAdvisor® — B2C retail till OS.
 * Stored on profiles.metadata.retailgraph.
 */
import type { TillSession } from '@/lib/till/types';
import {
  normalizeAnnouncements,
  publishedAnnouncements,
} from '@/lib/services/member-announcements';
import type { MemberAnnouncement } from '@/lib/services/member-announcements';
import { logoUrlFromSettings } from '@/lib/business/company-logo';
import { isPortalSectionOn } from '@/lib/advisors/portal-sections';
import { compactWorkingHours } from '@/lib/schedule/working-hours';
import { retailCommandBookingMetrics } from '@/lib/advisors/command-booking-metrics';

export const RETAILGRAPH_MODULE_ID = 'retailgraph' as const;
export const RETAILGRAPH_META_KEY = 'retailgraph';

export type RetailSku = {
  id: string;
  name: string;
  sku?: string;
  price_zar: number;
  active?: boolean;
};

export type RetailCustomer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  portal_token?: string | null;
  crm_customer_id?: number | null;
  updated_at?: string;
};

export type RetailSale = {
  id: string;
  created_at: string;
  lines: Array<{ name: string; qty: number; unit_zar: number }>;
  total_zar: number;
  status: 'open' | 'paid' | 'void';
  paid_via?: 'paystack' | 'cash' | 'pop' | null;
  till_token?: string | null;
  customer_id?: string | null;
};

export type RetailPublicSettings = {
  brand_name?: string;
  public_token?: string;
  enabled?: boolean;
  public_bio?: string;
  website_url?: string;
  contact_email?: string;
  contact_phone?: string;
  city?: string;
  embed_primary_color?: string;
  portal_sections?: Record<string, boolean>;
  show_pricing?: boolean;
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
  working_hours?: import('@/lib/schedule/working-hours').WorkingHours;
};

export type RetailgraphStore = {
  settings: RetailPublicSettings;
  announcements?: MemberAnnouncement[];
  skus: RetailSku[];
  customers: RetailCustomer[];
  sales: RetailSale[];
};

export function emptyRetailgraphStore(): RetailgraphStore {
  return {
    settings: {},
    announcements: [],
    skus: [],
    customers: [],
    sales: [],
  };
}

export function readRetailgraphFromMetadata(
  meta: Record<string, unknown> | null | undefined
): RetailgraphStore {
  const raw = meta?.[RETAILGRAPH_META_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyRetailgraphStore();
  }
  const o = raw as Partial<RetailgraphStore>;
  return {
    settings: o.settings && typeof o.settings === 'object' ? o.settings : {},
    announcements: normalizeAnnouncements(
      (o as { announcements?: unknown }).announcements
    ),
    skus: Array.isArray(o.skus) ? o.skus : [],
    customers: Array.isArray(o.customers) ? o.customers : [],
    sales: Array.isArray(o.sales) ? o.sales : [],
  };
}

export const RETAILGRAPH_PUBLIC_TOKEN_KEY = 'retailgraph_public_token';
export const RETAILGRAPH_CUSTOMER_TOKENS_KEY = 'retailgraph_customer_tokens';

export function writeRetailgraphToMetadata(
  meta: Record<string, unknown>,
  store: RetailgraphStore
): Record<string, unknown> {
  const customerTokens: Record<string, string> = {};
  for (const c of store.customers || []) {
    const token = String(c.portal_token || '').trim();
    if (token) customerTokens[token] = c.id;
  }
  return {
    ...meta,
    [RETAILGRAPH_META_KEY]: {
      ...store,
      announcements: normalizeAnnouncements(store.announcements),
    },
    [RETAILGRAPH_PUBLIC_TOKEN_KEY]: store.settings?.public_token || null,
    [RETAILGRAPH_CUSTOMER_TOKENS_KEY]: customerTokens,
  };
}

export function issueRetailPublicToken(companyId: number): string {
  return `rtl_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function parseCompanyIdFromRetailPublicToken(
  token: string
): number | null {
  const m = /^rtl_(\d+)_/.exec(String(token || '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function ensureRetailPublicToken(
  store: RetailgraphStore,
  companyId?: number
): RetailgraphStore {
  if (store.settings.public_token) return store;
  return {
    ...store,
    settings: {
      ...store.settings,
      public_token: companyId
        ? issueRetailPublicToken(companyId)
        : `rtl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    },
  };
}

export function buildRetailPublicWebsitePayload(
  store: RetailgraphStore,
  opts?: { companyName?: string | null }
) {
  return {
    brand: store.settings.brand_name || opts?.companyName || 'Store',
    bio: store.settings.public_bio || '',
    contact_email: store.settings.contact_email || null,
    contact_phone: store.settings.contact_phone || null,
    website_url: store.settings.website_url || null,
    logo_url: logoUrlFromSettings(
      store.settings as { company_logo_url?: string | null }
    ),
    primary_color: store.settings.embed_primary_color || '#ea580c',
    enabled: store.settings.enabled === true,
    announcements: isPortalSectionOn(store.settings, 'news')
      ? publishedAnnouncements(store.announcements)
      : [],
    skus: isPortalSectionOn(store.settings, 'shop')
      ? (store.skus || [])
      .filter((s) => s.active !== false)
      .map((s) => ({
        id: s.id,
        name: s.name,
        sku: s.sku || '',
        price_zar: Number(s.price_zar) || 0,
      }))
      : [],
    hours: isPortalSectionOn(store.settings, 'hours')
      ? compactWorkingHours(store.settings.working_hours)
      : [],
    sections: {
      news: isPortalSectionOn(store.settings, 'news'),
      shop: isPortalSectionOn(store.settings, 'shop'),
      hours: isPortalSectionOn(store.settings, 'hours'),
      contact: isPortalSectionOn(store.settings, 'contact'),
    },
  };
}

export function newRetailId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function issueRetailCustomerPortalToken(companyId: number): string {
  return `rtl_cus_${companyId}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

export function parseCompanyIdFromRetailCustomerToken(
  token: string
): number | null {
  const m = /^rtl_cus_(\d+)_/.exec(String(token || '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function retailCustomerPortalPath(portalToken: string): string {
  return `/member/retailgraph/${encodeURIComponent(portalToken)}`;
}

export function findRetailCustomerByPortalToken(
  store: RetailgraphStore,
  token: string
): RetailCustomer | null {
  const t = String(token || '').trim();
  if (!t) return null;
  return (
    (store.customers || []).find(
      (c) => String(c.portal_token || '').trim() === t
    ) || null
  );
}

/** Issue or reuse a member-app portal token for a shop customer. */
export function issueRetailCustomerPortal(
  store: RetailgraphStore,
  customerId: string,
  opts: { companyId: number }
): { store: RetailgraphStore; customer: RetailCustomer } {
  const customers = [...(store.customers || [])];
  const idx = customers.findIndex((c) => c.id === customerId);
  if (idx < 0) {
    throw new Error('Customer not found');
  }
  const prev = customers[idx];
  const token =
    String(prev.portal_token || '').trim() ||
    issueRetailCustomerPortalToken(opts.companyId);
  const customer: RetailCustomer = {
    ...prev,
    portal_token: token,
    updated_at: new Date().toISOString(),
  };
  customers[idx] = customer;
  return { store: { ...store, customers }, customer };
}

export function buildRetailCustomerPortalPayload(
  store: RetailgraphStore,
  customer: RetailCustomer,
  opts?: { companyName?: string | null }
) {
  const site = buildRetailPublicWebsitePayload(store, opts);
  const orders = (store.sales || []).filter(
    (s) => s.customer_id === customer.id && s.status !== 'void'
  );
  return {
    brand: site.brand,
    public_token: store.settings.public_token || '',
    bio: site.bio,
    contact_email: site.contact_email,
    contact_phone: site.contact_phone,
    website_url: site.website_url,
    logo_url: site.logo_url,
    primary_color: site.primary_color,
    enabled: site.enabled,
    announcements: site.announcements,
    skus: site.skus,
    sections: site.sections,
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email || null,
      phone: customer.phone || null,
      photo_url: customer.photo_url || null,
    },
    orders: orders.map((s) => ({
      id: s.id,
      created_at: s.created_at,
      total_zar: Number(s.total_zar) || 0,
      status: s.status,
      lines: (s.lines || []).map((l) => ({
        name: l.name,
        qty: l.qty,
        unit_zar: l.unit_zar,
      })),
    })),
  };
}

export function summariseRetailgraph(
  store: RetailgraphStore,
  sessions: TillSession[] = []
): {
  skuCount: number;
  customerCount: number;
  salesToday: number;
  takingsTodayZar: number;
  openTills: number;
  bookedToday: number;
  bookedWeek: number;
  bookedMonth: number;
  fillRateTodayPct: number | null;
  fillRateWeekPct: number | null;
  fillRateMonthPct: number | null;
  monthIncomeZar: number;
  monthPotentialZar: number;
} {
  const today = new Date().toISOString().slice(0, 10);
  const todays = store.sales.filter(
    (s) => s.status === 'paid' && String(s.created_at).slice(0, 10) === today
  );
  const booking = retailCommandBookingMetrics(store);
  return {
    skuCount: store.skus.filter((s) => s.active !== false).length,
    customerCount: store.customers.length,
    salesToday: todays.length,
    takingsTodayZar: todays.reduce((n, s) => n + (Number(s.total_zar) || 0), 0),
    openTills: sessions.filter((s) => s.status === 'open' || s.status === 'pending')
      .length,
    ...booking,
  };
}
