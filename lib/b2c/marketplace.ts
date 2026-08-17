/**
 * Unified B2C marketplace feed types — sale · hire · Advisor brands.
 */

export type B2cMarketChannel = 'sale' | 'hire' | 'advisor';

export type B2cMarketItem = {
  id: string;
  channel: B2cMarketChannel;
  title: string;
  subtitle?: string | null;
  price_label?: string | null;
  image_url?: string | null;
  href: string;
  city?: string | null;
  brand?: string | null;
  company_id?: number;
  kind?: string;
  verified?: boolean;
  badge: string;
};

export const MARKET_CHANNELS: Array<{
  id: B2cMarketChannel | 'all';
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'sale', label: 'For sale' },
  { id: 'hire', label: 'For hire' },
  { id: 'advisor', label: 'Advisors' },
];

export function channelBadge(channel: B2cMarketChannel): string {
  if (channel === 'hire') return 'Hire';
  if (channel === 'advisor') return 'Book';
  return 'Sale';
}

export function formatMoney(
  amount: number | null | undefined,
  currency = 'ZAR'
): string | null {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  const n = Number(amount);
  return `${currency} ${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}
