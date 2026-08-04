/** Public storefront types — Big Five Foods & multi-tenant sellers */

export type StoreChannel = 'retail' | 'wholesale' | 'institutional';

export type StoreAttribution = {
  source?: string | null;
  ref?: string | null;
  product?: string | null;
  sku?: string | null;
  name?: string | null;
  channel?: StoreChannel | string | null;
};

export type StoreProduct = {
  id: number | string;
  sku: string | null;
  name: string;
  description: string | null;
  packSize: string | null;
  uom: string | null;
  imageUrl: string | null;
  badges: string[];
  channels: StoreChannel[];
  /** retail/wholesale list price; null = price on request */
  price: number | null;
  currency: string;
  priceOnRequest: boolean;
  /** marketing site externalRef e.g. porridge-chocolate */
  externalRef: string | null;
  quoteFirst: boolean;
  active: boolean;
  category?: string | null;
};

export type StoreCompany = {
  id: number;
  slug: string;
  tradingName: string;
  legalName: string | null;
  logoUrl: string | null;
  shortDescription: string | null;
  verificationStatus: string | null;
  city: string | null;
  country: string | null;
  tagline: string;
};

export type StorefrontQuoteLine = {
  sku?: string | null;
  externalRef?: string | null;
  productId?: number | null;
  name: string;
  quantity: number;
  unitPrice?: number | null;
  notes?: string | null;
};
