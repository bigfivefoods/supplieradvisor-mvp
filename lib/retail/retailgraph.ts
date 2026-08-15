/**
 * RetailAdvisor® — B2C retail till OS.
 * Stored on profiles.metadata.retailgraph.
 */
import type { TillSession } from '@/lib/till/types';

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

export type RetailgraphStore = {
  settings: {
    brand_name?: string;
    public_token?: string;
  };
  skus: RetailSku[];
  customers: RetailCustomer[];
  sales: RetailSale[];
};

export function emptyRetailgraphStore(): RetailgraphStore {
  return {
    settings: {},
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
    skus: Array.isArray(o.skus) ? o.skus : [],
    customers: Array.isArray(o.customers) ? o.customers : [],
    sales: Array.isArray(o.sales) ? o.sales : [],
  };
}

export function writeRetailgraphToMetadata(
  meta: Record<string, unknown>,
  store: RetailgraphStore
): Record<string, unknown> {
  return { ...meta, [RETAILGRAPH_META_KEY]: store };
}

export function ensureRetailPublicToken(store: RetailgraphStore): RetailgraphStore {
  if (store.settings.public_token) return store;
  return {
    ...store,
    settings: {
      ...store.settings,
      public_token: `rtl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    },
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
