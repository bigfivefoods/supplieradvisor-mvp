/**
 * If the request is a logged-in member of the host company, they act as host
 * — never as the customer/supplier on the portal token.
 */
import type { NextRequest } from 'next/server';
import { requireVerifiedUser } from '@/lib/auth/api-auth';
import { getCompanyMembership } from '@/lib/business/access';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  hostDisplayName,
  type PortalHostIdentity,
} from '@/lib/portals/portal-actor';

export async function tryPortalHostActor(
  request: NextRequest,
  hostCompanyId: number,
  opts?: { legacyPrivyUserId?: string | null }
): Promise<PortalHostIdentity | null> {
  if (!Number.isFinite(hostCompanyId) || hostCompanyId <= 0) return null;
  const auth = await requireVerifiedUser(request, opts);
  if (!auth.ok) return null;
  const mem = await getCompanyMembership(auth.userId, hostCompanyId);
  if (!mem.ok) return null;

  let contactName: string | null = null;
  let companyName: string | null = null;
  let companyEmail: string | null = null;
  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from('profiles')
      .select('trading_name, legal_name, contact_name, email')
      .eq('id', hostCompanyId)
      .maybeSingle();
    if (data) {
      contactName = data.contact_name != null ? String(data.contact_name) : null;
      companyName = String(data.trading_name || data.legal_name || '').trim() || null;
      companyEmail = data.email != null ? String(data.email) : null;
    }
  } catch {
    /* profile fallback is optional */
  }

  const name = hostDisplayName({
    memberName: mem.name,
    memberEmail: mem.email,
    contactName,
    companyName,
  });
  const email = mem.email || companyEmail || null;
  return {
    userId: mem.userId,
    name,
    email,
    memberId: mem.memberId,
  };
}

export {
  attachPortalActor,
  guestOnlyActionMessage,
  isGuestOnlyPortalAction,
  portalActionStamp,
} from '@/lib/portals/portal-actor';
