/**
 * Owner roster → PWA role.
 * Coaches on the desk open the coach app. Members open the member app.
 * A coach is not auto-created as a member unless the owner also listed them.
 */
import { emailsMatch, phonesMatch } from '@/lib/b2c/member-app';
import {
  coachEngagementIsLive,
  ensureClientPortalToken,
  ensureCoachPortalToken,
  findCoachForPortalSignIn,
  gymCheckinPath,
  newId,
  type FitClient,
  type FitCoach,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';

export type GymPwaRole = 'coach' | 'member';

export type GymPwaLink = {
  role: GymPwaRole;
  ref_id: string;
  ref_label: string;
  email?: string | null;
  phone?: string | null;
  portal_token: string;
  portal_path: string;
  checkin_path: string | null;
  capabilities: Array<
    'book' | 'checkin' | 'messages' | 'review' | 'track'
  >;
};

export function gymCoachPortalPath(token: string): string {
  return `/coach/fitgraph/${encodeURIComponent(token)}`;
}

export function gymMemberPortalPath(token: string): string {
  return `/member/fitgraph/${encodeURIComponent(token)}`;
}

export function isGymCoachPortalPath(path?: string | null): boolean {
  return String(path || '').includes('/coach/fitgraph/');
}

function personContactMatch(
  person: {
    email?: string | null;
    invite_email?: string | null;
    phone?: string | null;
    platform_user_id?: string | null;
  },
  opts: {
    email?: string | null;
    phone?: string | null;
    userId?: string | null;
  }
): boolean {
  if (opts.userId && person.platform_user_id === opts.userId) return true;
  if (opts.email && emailsMatch(person.email, opts.email)) return true;
  if (opts.email && emailsMatch(person.invite_email, opts.email)) return true;
  if (opts.phone && phonesMatch(person.phone, opts.phone)) return true;
  return false;
}

export function findGymCoachForWallet(
  store: FitgraphStore,
  opts: {
    email?: string | null;
    phone?: string | null;
    userId?: string | null;
    displayName?: string | null;
  }
): FitCoach | null {
  const email = String(opts.email || '').trim();
  if (email.includes('@')) {
    const hit = findCoachForPortalSignIn(store, {
      name: opts.displayName,
      email,
    });
    if (hit) return hit;
  }
  return (
    (store.coaches || []).find(
      (c) =>
        coachEngagementIsLive(c) &&
        personContactMatch(c, opts)
    ) || null
  );
}

export function findGymMemberForWallet(
  store: FitgraphStore,
  opts: {
    email?: string | null;
    phone?: string | null;
    userId?: string | null;
  }
): FitClient | null {
  return (
    (store.clients || []).find(
      (c) => c.active !== false && personContactMatch(c, opts)
    ) || null
  );
}

export function linkGymPersonToPwa(
  store: FitgraphStore,
  opts: {
    companyId: number;
    email?: string | null;
    phone?: string | null;
    userId?: string | null;
    displayName: string;
    createIfMissing?: boolean;
    now?: string;
  }
): { links: GymPwaLink[]; createdMember: boolean; changed: boolean } {
  const now = opts.now || new Date().toISOString();
  const checkin = store.settings?.public_token
    ? gymCheckinPath(store.settings.public_token)
    : null;
  let changed = false;
  let createdMember = false;

  const coach = findGymCoachForWallet(store, opts);
  let client = findGymMemberForWallet(store, opts);

  if (!coach && !client && opts.createIfMissing) {
    client = {
      id: newId('cli'),
      code: `M${Date.now().toString(36).slice(-5).toUpperCase()}`,
      name: opts.displayName,
      email: opts.email || undefined,
      phone: opts.phone || undefined,
      membership_status: 'active',
      start_date: now.slice(0, 10),
      active: true,
      created_at: now,
      updated_at: now,
    };
    store.clients = [...(store.clients || []), client];
    createdMember = true;
    changed = true;
  }

  const links: GymPwaLink[] = [];

  if (coach) {
    const before = String(coach.portal_token || '');
    const token = ensureCoachPortalToken(coach, opts.companyId);
    if (token !== before) changed = true;
    const idx = store.coaches.findIndex((c) => c.id === coach.id);
    if (idx >= 0) store.coaches[idx] = { ...store.coaches[idx], ...coach };
    links.push({
      role: 'coach',
      ref_id: coach.id,
      ref_label: coach.name,
      email: coach.email || opts.email,
      phone: coach.phone || opts.phone,
      portal_token: token,
      portal_path: gymCoachPortalPath(token),
      checkin_path: checkin,
      capabilities: ['checkin', 'messages', 'track'],
    });
  }

  if (client) {
    const before = String(client.portal_token || '');
    const token = ensureClientPortalToken(client, opts.companyId);
    if (token !== before) changed = true;
    if (opts.email && !client.email) {
      client.email = opts.email;
      changed = true;
    }
    if (opts.phone && !client.phone) {
      client.phone = opts.phone;
      changed = true;
    }
    const idx = store.clients.findIndex((c) => c.id === client.id);
    if (idx >= 0) store.clients[idx] = client;
    links.push({
      role: 'member',
      ref_id: client.id,
      ref_label: client.name,
      email: client.email || opts.email,
      phone: client.phone || opts.phone,
      portal_token: token,
      portal_path: gymMemberPortalPath(token),
      checkin_path: checkin,
      capabilities: ['book', 'checkin', 'messages', 'review', 'track'],
    });
  }

  return { links, createdMember, changed };
}

export function preferredGymPwaLink(links: GymPwaLink[]): GymPwaLink | null {
  return links.find((l) => l.role === 'coach') || links[0] || null;
}
