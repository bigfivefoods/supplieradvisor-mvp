/**
 * B2C consumer identity — one personal wallet (Privy user_id).
 *
 * Dual-life:
 *   - This profile is the person's wallet. They link it to any business on
 *     the platform to manage that account: book, shop, subscriptions,
 *     medical records, hire. Never keyed by selectedCompanyId.
 *   - Each linked business is one wallet account. Advisor desks at that
 *     company (dentist, gym, hire) hang off the same account.
 *   - Operating a B2B/B2G company lives on business_users and is switched
 *     separately via /dashboard/select-company.
 */

export type B2cMembershipKind =
  | 'hire'
  | 'gym'
  | 'physio'
  | 'dental'
  | 'medical'
  | 'psychiatry'
  | 'account'
  | 'other';

export type B2cCapability =
  | 'order'
  | 'book'
  | 'checkin'
  | 'review'
  | 'kyc'
  | 'messages'
  | 'track';

export type B2cMembership = {
  id: string;
  kind: B2cMembershipKind;
  company_id: number;
  company_name: string;
  brand?: string | null;
  /** Opaque portal token for deep links */
  portal_token?: string | null;
  /** Path on this app, e.g. /hire/… or /member/fitgraph/… */
  portal_path: string;
  /** Optional gym door check-in path */
  checkin_path?: string | null;
  /** CRM customer id / fit client id / patient id */
  ref_id: string;
  ref_label?: string | null;
  email?: string | null;
  capabilities: B2cCapability[];
  linked_at: string;
  last_used_at?: string | null;
  active?: boolean;
};

export type B2cProfile = {
  user_id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  city?: string | null;
  id_number?: string | null;
  memberships: B2cMembership[];
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export function newMembershipId(kind: string): string {
  return `b2c_${kind}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
