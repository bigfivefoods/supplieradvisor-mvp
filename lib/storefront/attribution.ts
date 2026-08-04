import type { StoreAttribution, StoreChannel } from './types';

const CHANNELS = new Set(['retail', 'wholesale', 'institutional']);

export function parseStoreAttribution(
  sp: URLSearchParams | { get(name: string): string | null }
): StoreAttribution {
  const channelRaw = String(sp.get('channel') || '')
    .toLowerCase()
    .trim();
  const channel = CHANNELS.has(channelRaw)
    ? (channelRaw as StoreChannel)
    : channelRaw || null;

  return {
    source: sp.get('source') || null,
    ref: sp.get('ref') || null,
    product: sp.get('product') || null,
    sku: sp.get('sku') || null,
    name: sp.get('name') || null,
    channel,
  };
}

export function attributionToQuery(a: StoreAttribution): string {
  const p = new URLSearchParams();
  if (a.source) p.set('source', a.source);
  if (a.ref) p.set('ref', a.ref);
  if (a.product) p.set('product', a.product);
  if (a.sku) p.set('sku', a.sku);
  if (a.name) p.set('name', a.name);
  if (a.channel) p.set('channel', String(a.channel));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function storePath(
  companySlug: string,
  productKey?: string | null,
  attr?: StoreAttribution
): string {
  const base = productKey
    ? `/store/${encodeURIComponent(companySlug)}/products/${encodeURIComponent(productKey)}`
    : `/store/${encodeURIComponent(companySlug)}`;
  return `${base}${attr ? attributionToQuery(attr) : ''}`;
}

export function loginWithReturn(returnPath: string): string {
  const next = returnPath.startsWith('/') ? returnPath : `/${returnPath}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

export function onboardingWithPartner(opts: {
  partner?: string;
  intent?: string;
  source?: string | null;
  product?: string | null;
  sku?: string | null;
  channel?: string | null;
}): string {
  const p = new URLSearchParams();
  p.set('type', 'business');
  if (opts.partner) p.set('partner', opts.partner);
  if (opts.intent) p.set('intent', opts.intent);
  if (opts.source) p.set('source', opts.source);
  if (opts.product) p.set('product', opts.product);
  if (opts.sku) p.set('sku', opts.sku);
  if (opts.channel) p.set('channel', opts.channel);
  return `/onboarding?${p.toString()}`;
}
