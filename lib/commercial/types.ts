/** Party catalogue — one price record per host × product × SRM/CRM party. */

export const PARTY_KINDS = ['supplier', 'customer'] as const;
export type PartyKind = (typeof PARTY_KINDS)[number];

export const PRICE_ACTORS = ['host', 'party'] as const;
export type PriceActor = (typeof PRICE_ACTORS)[number];

export const LINE_STATUSES = ['active', 'paused'] as const;
export type CatalogueLineStatus = (typeof LINE_STATUSES)[number];

export const REVISION_STATUSES = [
  'proposed',
  'accepted',
  'rejected',
  'superseded',
] as const;
export type RevisionStatus = (typeof REVISION_STATUSES)[number];

export type PartyCatalogueLine = {
  id: number;
  profile_id: number;
  party_kind: PartyKind;
  supplier_id: number | null;
  customer_id: number | null;
  product_id: number;
  currency: string;
  uom: string | null;
  accepted_price: number;
  accepted_at: string | null;
  pending_price: number | null;
  pending_proposed_at: string | null;
  pending_proposed_by: PriceActor | null;
  status: CatalogueLineStatus;
  product_name?: string | null;
  product_type?: string | null;
  sku?: string | null;
  qty_on_hand?: number | null;
  family?: string;
};

export type PriceRevision = {
  id: number;
  line_id: number;
  old_price: number | null;
  new_price: number;
  currency: string;
  proposed_by: PriceActor;
  status: RevisionStatus;
  accepted_by: string | null;
  accepted_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  note: string | null;
  created_at: string;
};

export const KELPACK_SUPPLIER_ID = 12;
export const BIG_FIVE_PROFILE_ID = 102;

/** Buy prices we pay Kelpack (ZAR). Films + 8 FG + 4 NSNP. */
export const KELPACK_SEED_PRICES: ReadonlyArray<{
  product_id: number;
  accepted_price: number;
}> = [
  { product_id: 2, accepted_price: 28 },
  { product_id: 3, accepted_price: 28 },
  { product_id: 4, accepted_price: 28 },
  { product_id: 5, accepted_price: 28 },
  { product_id: 6, accepted_price: 28 },
  { product_id: 7, accepted_price: 35 },
  { product_id: 8, accepted_price: 28 },
  { product_id: 9, accepted_price: 28 },
  { product_id: 42, accepted_price: 99 },
  { product_id: 44, accepted_price: 500 },
  { product_id: 45, accepted_price: 685.75 },
  { product_id: 46, accepted_price: 100 },
  { product_id: 49, accepted_price: 1.35 },
  { product_id: 50, accepted_price: 1.35 },
  { product_id: 51, accepted_price: 1.35 },
  { product_id: 52, accepted_price: 1.35 },
];

export const KENYA_CUSTOMER_ID = 3;
export const KENYA_BUYER_PROFILE_ID = 123;
