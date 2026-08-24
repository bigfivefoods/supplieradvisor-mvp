/**
 * Who is acting on a customer/supplier portal: the host company (logged in)
 * or the guest on the access token.
 */
import type { PublicPortalPayload } from '@/lib/portals/trade-portal';

export type PortalActorRole = 'host' | 'guest';

export type PortalActorView = {
  role: PortalActorRole;
  name: string;
  email: string | null;
};

export type PortalHostIdentity = {
  userId: string;
  name: string;
  email: string | null;
  memberId: number;
};

export type PortalActionStamp = {
  isHost: boolean;
  name: string;
  createdBy: string;
  noteTag: string;
  messageAuthor: 'host' | 'guest';
};

/** Guest-only writes — host must not rate the host as if they were the customer. */
export const GUEST_ONLY_PORTAL_ACTIONS = new Set(['rate']);

export function isGuestOnlyPortalAction(action: string): boolean {
  return GUEST_ONLY_PORTAL_ACTIONS.has(String(action || '').trim());
}

export function guestOnlyActionMessage(
  action: string,
  kind: 'customer' | 'supplier'
): string {
  if (action === 'rate') {
    return 'Ratings in this portal are from the customer or supplier, not from the host company.';
  }
  return 'That action is only for the guest on this portal.';
}

export function portalActionStamp(
  host: { userId: string; name: string } | null,
  viewer: { id: number; name: string }
): PortalActionStamp {
  if (host) {
    return {
      isHost: true,
      name: host.name,
      createdBy: `host:${host.userId}`,
      noteTag: host.name,
      messageAuthor: 'host',
    };
  }
  return {
    isHost: false,
    name: viewer.name,
    createdBy: `portal:${viewer.id}`,
    noteTag: viewer.name,
    messageAuthor: 'guest',
  };
}

export function attachPortalActor(
  payload: PublicPortalPayload,
  host: { name: string; email: string | null; memberId?: number } | null
): PublicPortalPayload {
  if (host) {
    return {
      ...payload,
      actor: {
        role: 'host',
        name: host.name,
        email: host.email,
      },
      people: (payload.people || []).map((p) => ({
        ...p,
        you: p.side === 'host' && host.memberId != null && p.id === host.memberId,
      })),
    };
  }
  const viewer = payload.viewer;
  return {
    ...payload,
    actor: viewer
      ? {
          role: 'guest',
          name: viewer.name,
          email: viewer.email,
        }
      : { role: 'guest', name: 'Guest', email: null },
    people: (payload.people || []).map((p) => ({
      ...p,
      you: p.side === 'host' ? false : p.you,
    })),
  };
}

export function hostDisplayName(opts: {
  memberName?: string | null;
  memberEmail?: string | null;
  contactName?: string | null;
  companyName?: string | null;
}): string {
  const member = String(opts.memberName || '').trim();
  if (member) return member;
  const contact = String(opts.contactName || '').trim();
  if (contact) return contact;
  const company = String(opts.companyName || '').trim();
  if (company) return company;
  const email = String(opts.memberEmail || '').trim();
  if (email.includes('@')) return email.split('@')[0];
  return 'Host';
}
