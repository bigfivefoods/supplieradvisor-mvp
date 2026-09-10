/**
 * Public storefront → seller CRM customer (e.g. Big Five Foods Customers).
 */

export type StorefrontBuyerProfile = {
  tradingName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  customerType?: 'business' | 'individual';
  legalName?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  vatNumber?: string | null;
  notes?: string | null;
  storeSlug?: string | null;
};

export type StorefrontCustomerHit = {
  id: number;
  trading_name: string;
  email: string | null;
  created: boolean;
};

function clean(raw: unknown): string | null {
  const s = String(raw || '').trim();
  return s || null;
}

export function storefrontCustomerInsertPayload(
  sellerId: number,
  buyer: StorefrontBuyerProfile,
  now: string
): Record<string, unknown> {
  const email = String(buyer.contactEmail || '')
    .toLowerCase()
    .trim();
  const tradingName =
    clean(buyer.tradingName) || clean(buyer.contactName) || 'Storefront buyer';
  const address = clean(buyer.address);
  const customerType =
    buyer.customerType === 'individual' ? 'individual' : 'business';
  return {
    profile_id: sellerId,
    trading_name: tradingName,
    legal_name: clean(buyer.legalName) || (customerType === 'business' ? tradingName : null),
    email,
    phone: clean(buyer.contactPhone),
    contact_name: clean(buyer.contactName),
    status: 'active',
    customer_type: customerType,
    billing_address: address,
    shipping_address: address,
    city: clean(buyer.city),
    country: clean(buyer.country) || 'South Africa',
    vat_number: clean(buyer.vatNumber),
    currency: 'ZAR',
    source: 'storefront',
    notes:
      clean(buyer.notes) ||
      `From storefront ${clean(buyer.storeSlug) || ''}`.trim(),
    metadata: {
      storefront: true,
      store_slug: clean(buyer.storeSlug),
      customer_type: customerType,
    },
    created_at: now,
    updated_at: now,
  };
}

export function storefrontCustomerPatch(
  existing: Record<string, unknown>,
  buyer: StorefrontBuyerProfile,
  now: string
): Record<string, unknown> {
  const patch: Record<string, unknown> = { updated_at: now };
  const phone = clean(buyer.contactPhone);
  const city = clean(buyer.city);
  const country = clean(buyer.country);
  const address = clean(buyer.address);
  const vat = clean(buyer.vatNumber);
  const contact = clean(buyer.contactName);
  const trading = clean(buyer.tradingName);
  if (contact) patch.contact_name = contact;
  if (phone) patch.phone = phone;
  if (city && !existing.city) patch.city = city;
  if (country && !existing.country) patch.country = country;
  if (address && !existing.shipping_address) patch.shipping_address = address;
  if (address && !existing.billing_address) patch.billing_address = address;
  if (vat && !existing.vat_number) patch.vat_number = vat;
  if (trading && !existing.trading_name) patch.trading_name = trading;
  if (!existing.source) patch.source = 'storefront';
  const meta =
    existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
      ? { ...(existing.metadata as Record<string, unknown>) }
      : {};
  meta.storefront = true;
  if (clean(buyer.storeSlug)) meta.store_slug = clean(buyer.storeSlug);
  patch.metadata = meta;
  return patch;
}

export async function upsertStorefrontCustomer(
  supabase: { from: (table: string) => any },
  sellerId: number,
  buyer: StorefrontBuyerProfile
): Promise<StorefrontCustomerHit | null> {
  const email = String(buyer.contactEmail || '')
    .toLowerCase()
    .trim();
  if (!email.includes('@') || !sellerId) return null;
  const now = new Date().toISOString();

  const { data: hits } = await supabase
    .from('customers')
    .select(
      'id, trading_name, email, contact_name, phone, city, country, billing_address, shipping_address, vat_number, source, metadata'
    )
    .eq('profile_id', sellerId)
    .ilike('email', email)
    .limit(1);

  const existing = (hits || [])[0] as Record<string, unknown> | undefined;
  if (existing?.id) {
    const patch = storefrontCustomerPatch(existing, buyer, now);
    const { data: updated } = await supabase
      .from('customers')
      .update(patch)
      .eq('id', Number(existing.id))
      .select('id, trading_name, email')
      .single();
    const row = (updated || existing) as Record<string, unknown>;
    return {
      id: Number(row.id),
      trading_name: String(row.trading_name || buyer.tradingName),
      email: row.email ? String(row.email) : email,
      created: false,
    };
  }

  const payload = storefrontCustomerInsertPayload(sellerId, buyer, now);
  let { data, error } = await supabase
    .from('customers')
    .insert(payload)
    .select('id, trading_name, email')
    .single();

  if (error) {
    const retry = await supabase
      .from('customers')
      .insert({
        profile_id: sellerId,
        trading_name: payload.trading_name,
        email,
        contact_name: payload.contact_name,
        phone: payload.phone,
        status: 'active',
        source: 'storefront',
        notes: payload.notes,
        created_at: now,
        updated_at: now,
      })
      .select('id, trading_name, email')
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data?.id) return null;
  return {
    id: Number(data.id),
    trading_name: String(data.trading_name || buyer.tradingName),
    email: data.email ? String(data.email) : email,
    created: true,
  };
}
