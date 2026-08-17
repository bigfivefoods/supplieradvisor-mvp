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
  embed_primary_color?: string;
  has_front_desk?: boolean;
  desk_name?: string;
  desk_email?: string | null;
  desk_invite_status?: string | null;
  desk_invite_sent_at?: string | null;
  desk_invite_accepted_at?: string | null;
  desk_team_member_id?: number | null;
  desk_last_invited_email?: string | null;
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

export function writeRetailgraphToMetadata(
  meta: Record<string, unknown>,
  store: RetailgraphStore
): Record<string, unknown> {
  return {
    ...meta,
    [RETAILGRAPH_META_KEY]: {
      ...store,
      announcements: normalizeAnnouncements(store.announcements),
    },
    [RETAILGRAPH_PUBLIC_TOKEN_KEY]: store.settings?.public_token || null,
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
    announcements: publishedAnnouncements(store.announcements),
    skus: (store.skus || [])
      .filter((s) => s.active !== false)
      .map((s) => ({
        id: s.id,
        name: s.name,
        sku: s.sku || '',
        price_zar: Number(s.price_zar) || 0,
      })),
  };
}

export function newRetailId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
} {
  const today = new Date().toISOString().slice(0, 10);
  const todays = store.sales.filter(
    (s) => s.status === 'paid' && String(s.created_at).slice(0, 10) === today
  );
  return {
    skuCount: store.skus.filter((s) => s.active !== false).length,
    customerCount: store.customers.length,
    salesToday: todays.length,
    takingsTodayZar: todays.reduce((n, s) => n + (Number(s.total_zar) || 0), 0),
    openTills: sessions.filter((s) => s.status === 'open' || s.status === 'pending')
      .length,
  };
}
