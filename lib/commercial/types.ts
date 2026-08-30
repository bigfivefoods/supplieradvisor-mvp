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
  primary_image_url?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  lead_time_days?: number | null;
  moq?: number | null;
  specs_sheet_url?: string | null;
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

export const KENYA_CUSTOMER_ID = 3;
export const KENYA_BUYER_PROFILE_ID = 123;
