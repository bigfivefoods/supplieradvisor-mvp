/** Network / business_connections types — company-scoped edges */

export const CONNECTION_TYPES = ['supplier', 'customer', 'partner'] as const;
export type ConnectionType = (typeof CONNECTION_TYPES)[number] | string;

export const CONNECTION_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'cancelled',
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number] | string;

export type PeerProfile = {
  id: number;
  trading_name?: string | null;
  legal_name?: string | null;
  email?: string | null;
  city?: string | null;
  country?: string | null;
  industry?: string | null;
  verification_status?: string | null;
  is_verified?: boolean | null;
  wallet_address?: string | null;
  logo_url?: string | null;
  trust_score?: number | null;
};

/**
 * Normalized edge from the selected company's point of view.
 * connection_type conventions:
 *  - supplier: requester=buyer, requestee=supplier
 *  - customer: requester=seller, requestee=buyer
 *  - partner: mutual / generic
 */
export type NetworkEdge = {
  id: number;
  status: ConnectionStatus;
  connection_type: ConnectionType;
  message?: string | null;
  notes?: string | null;
  requested_at?: string | null;
  responded_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
  suspended: boolean;
  /** We initiated the request */
  direction: 'sent' | 'received';
  /** How the peer relates to us */
  role: 'supplier' | 'customer' | 'partner' | 'buyer' | 'seller';
  peer: PeerProfile;
  requester_profile_id: number;
  requestee_profile_id: number;
  /** Deep links into CRM / SRM / commerce */
  hrefs: {
    primary: string;
    po?: string;
    documents?: string;
    riad?: string;
    ratings?: string;
  };
};

export type NetworkSummary = {
  total: number;
  accepted: number;
  pendingIn: number;
  pendingOut: number;
  suppliers: number;
  customers: number;
  partners: number;
  suspended: number;
};

export function isSuspendedMeta(meta: unknown): boolean {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  const m = meta as Record<string, unknown>;
  return m.suspended === true || m.suspended === 'true';
}

/**
 * Resolve our role vs the peer for a connection row.
 */
export function resolveNetworkRole(
  companyId: number,
  requesterId: number,
  requesteeId: number,
  connectionType: string | null | undefined
): {
  direction: 'sent' | 'received';
  role: NetworkEdge['role'];
  peerId: number;
} {
  const direction: 'sent' | 'received' =
    requesterId === companyId ? 'sent' : 'received';
  const peerId = direction === 'sent' ? requesteeId : requesterId;
  const type = String(connectionType || 'partner').toLowerCase();

  let role: NetworkEdge['role'] = 'partner';
  if (type === 'supplier') {
    // requester=buyer, requestee=supplier
    role = direction === 'sent' ? 'supplier' : 'buyer';
  } else if (type === 'customer') {
    // requester=seller, requestee=buyer
    role = direction === 'sent' ? 'customer' : 'seller';
  }

  return { direction, role, peerId };
}

export function edgeHrefs(
  role: NetworkEdge['role'],
  peerId: number
): NetworkEdge['hrefs'] {
  if (role === 'supplier') {
    return {
      primary: '/dashboard/suppliers/network',
      po: `/dashboard/suppliers/po?supplierProfileId=${peerId}`,
      documents: '/dashboard/suppliers/documents',
      riad: '/dashboard/suppliers/riad-log',
      ratings: '/dashboard/suppliers/ratings',
    };
  }
  if (role === 'customer') {
    return {
      primary: '/dashboard/customers/profiles',
      po: '/dashboard/customers/orders',
      documents: '/dashboard/customers/quotes',
      riad: '/dashboard/customers/riad-log',
      ratings: '/dashboard/customers/reviews',
    };
  }
  if (role === 'buyer') {
    // They buy from us — CRM-ish from our view if they also appear as customers
    return {
      primary: '/dashboard/customers/profiles',
      documents: '/dashboard/customers/quotes',
      riad: '/dashboard/customers/riad-log',
    };
  }
  if (role === 'seller') {
    // They sell to us
    return {
      primary: '/dashboard/suppliers/network',
      po: `/dashboard/suppliers/po?supplierProfileId=${peerId}`,
      documents: '/dashboard/suppliers/documents',
      riad: '/dashboard/suppliers/riad-log',
    };
  }
  // Partner — either side can open trade surfaces
  return {
    primary: '/dashboard/connections',
    po: '/dashboard/suppliers/po',
    documents: '/dashboard/suppliers/documents',
    ratings: '/dashboard/suppliers/ratings',
    riad: '/dashboard/suppliers/riad-log',
  };
}

export function roleLabel(role: NetworkEdge['role']): string {
  switch (role) {
    case 'supplier':
      return 'Supplier';
    case 'customer':
      return 'Customer';
    case 'buyer':
      return 'Buyer (of us)';
    case 'seller':
      return 'Seller (to us)';
    default:
      return 'Partner';
  }
}

export function statusBadgeClass(status?: string | null, suspended?: boolean): string {
  if (suspended) return 'bg-amber-100 text-amber-900 border-amber-200';
  switch (String(status || '').toLowerCase()) {
    case 'accepted':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'pending':
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'declined':
    case 'cancelled':
      return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    default:
      return 'bg-neutral-100 text-neutral-600 border-neutral-200';
  }
}

export function roleBadgeClass(role?: string | null): string {
  switch (String(role || '').toLowerCase()) {
    case 'supplier':
    case 'seller':
      return 'bg-[#00b4d8]/10 text-[#0077b6] border-[#00b4d8]/25';
    case 'customer':
    case 'buyer':
      return 'bg-violet-100 text-violet-800 border-violet-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
