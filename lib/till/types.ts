/**
 * Shared till-pay sessions — RetailAdvisor POS and every Advisor desk.
 * Token encodes company id so public lookup does not need a global index.
 */

export const TILL_MODULES = [
  'retailgraph',
  'fitgraph',
  'physiograph',
  'dentalgraph',
  'medicalgraph',
  'psychiatrygraph',
  'vetgraph',
  'hiregraph',
] as const;

export type TillModule = (typeof TILL_MODULES)[number];

export type TillSessionKind = 'sale' | 'bill' | 'wallet';
export type TillSessionStatus =
  | 'open'
  | 'pending'
  | 'paid'
  | 'cancelled'
  | 'expired';

export type TillLine = {
  sku?: string;
  name: string;
  qty: number;
  unit_zar: number;
};

export type TillSession = {
  token: string;
  company_id: number;
  module: TillModule;
  kind: TillSessionKind;
  status: TillSessionStatus;
  amount_zar: number;
  currency: 'ZAR';
  label: string;
  brand?: string | null;
  lines?: TillLine[];
  charge_ids?: string[];
  created_at: string;
  expires_at: string;
  paid_at?: string | null;
  paid_via?: 'paystack' | 'cash' | 'pop' | null;
  paystack_ref?: string | null;
  paid_by_user_id?: string | null;
};

export const TILL_META_KEY = 'till_sessions';
export const TILL_SESSION_CAP = 80;
export const TILL_TTL_MS = 20 * 60 * 1000;

export function isTillModule(v: unknown): v is TillModule {
  return TILL_MODULES.includes(String(v) as TillModule);
}
