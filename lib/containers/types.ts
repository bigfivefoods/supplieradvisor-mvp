export type ContainerRecord = {
  id: number;
  profile_id?: number | null;
  container_code: string;
  name: string;
  type?: string | null;
  status?: string | null;
  container_type?: string | null;
  country?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  deployed_date?: string | null;
  purchase_date?: string | null;
  cost?: number | null;
  assigned_contractor?: string | null;
  contractor_id?: number | null;
  tags?: string[] | string | null;
  photo_url?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
  wifi_portal_url?: string | null;
  capacity_units?: number | null;
  monthly_target?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type ContractorRecord = {
  id: number;
  profile_id?: number | null;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  id_number?: string | null;
  status?: string | null;
  training_status?: string | null;
  bank_details?: Record<string, unknown> | null;
  /** Portal identity (set after invite + contract accept) */
  user_id?: string | null;
  portal_status?: 'draft' | 'invited' | 'active' | 'suspended' | string | null;
  contract_accepted_at?: string | null;
  contract_version?: string | null;
  invited_at?: string | null;
  invite_token?: string | null;
  /** VerifyNow + ID document */
  id_document_url?: string | null;
  id_document_name?: string | null;
  id_document_uploaded_at?: string | null;
  verification_status?:
    | 'unverified'
    | 'pending'
    | 'verified'
    | 'failed'
    | 'mismatch'
    | string
    | null;
  verified_at?: string | null;
  verification_provider?: string | null;
  verification_reference?: string | null;
  verification_data?: Record<string, unknown> | null;
  verified_first_names?: string | null;
  verified_last_name?: string | null;
  verified_dob?: string | null;
  consent_identity_check?: boolean | null;
  consent_identity_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ContainerInventoryItem = {
  id: number;
  profile_id?: number | null;
  container_id: number;
  product_id?: number | null;
  product_name: string;
  sku?: string | null;
  qty_on_hand: number;
  unit?: string | null;
  reorder_level?: number | null;
  unit_cost?: number | null;
  last_received_at?: string | null;
  notes?: string | null;
};

/** Catalogue product for container stock/order pickers */
export type CatalogueProductOption = {
  id: number;
  name: string;
  sku?: string | null;
  uom?: string | null;
  unit?: string | null;
  product_type?: string | null;
  category?: string | null;
  reorder_level?: number | null;
  cost_price?: number | null;
  sell_price?: number | null;
  qty_on_hand?: number | null;
  status?: string | null;
};

export type ContainerOrder = {
  id: number;
  profile_id?: number | null;
  container_id: number;
  order_number?: string | null;
  status: string;
  items: Array<{
    product_name: string;
    sku?: string;
    quantity: number;
    unit?: string;
  }>;
  notes?: string | null;
  ordered_at?: string | null;
  received_at?: string | null;
  created_at?: string;
};

export function normalizeTags(tags: string[] | string | null | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean);
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
