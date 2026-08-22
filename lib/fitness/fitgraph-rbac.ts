/**
 * GymAdvisor® — Role-Based Access Control (RBAC)
 *
 * Architecture decision (B2C PWA):
 * - The gym **Owner** (company that subscribes to GymAdvisor) owns the tenant
 *   and pays the platform subscription. Only the owner opens SupplierAdvisor.
 * - **Coaches** (employed or contractor) use the B2C work PWA: scoped access
 *   only (own classes, assigned clients, roster, feedback). They do NOT get
 *   the company workspace. An owner who also coaches uses both.
 * - **Members** use the PWA / portal for personal schedule, booking, feedback.
 * - Optional **Desk** persona when has_front_desk is true (front-desk ops).
 *
 * Global SupplierAdvisor identity (Privy / platform user) is separate from the
 * gym-scoped role. One SA account can be Owner of gym A, Coach at gym B, and
 * Member at gym C.
 *
 * Data ownership always remains with the gym tenant (company profile metadata
 * fitgraph store). Coach and member access is revocable via portal tokens and
 * role links.
 */

import type { FitClient, FitCoach, FitgraphStore, FitSession } from '@/lib/fitness/fitgraph';

// ── Roles ───────────────────────────────────────────────────────────────────

export const FIT_ROLES = ['owner', 'coach', 'member', 'desk'] as const;
export type FitRole = (typeof FIT_ROLES)[number];

/** Human labels for UI */
export const FIT_ROLE_LABELS: Record<FitRole, string> = {
  owner: 'Gym owner / manager',
  coach: 'Coach',
  member: 'Member',
  desk: 'Front desk',
};

/**
 * Gym-scoped role binding for a platform user.
 * Stored conceptually against the company (or future gym_roles table).
 * Until a dedicated table exists, Owner = company admin; Coach/Member are
 * resolved via FitCoach.portal_token / FitClient.portal_token + platform_user_id.
 */
export type FitGymRoleBinding = {
  company_id: number;
  platform_user_id: string;
  role: FitRole;
  /** For coach role: link to FitCoach.id */
  coach_id?: string | null;
  /** For member role: link to FitClient.id */
  client_id?: string | null;
  /** Invited / active / revoked */
  status: 'invited' | 'active' | 'revoked';
  invited_at?: string | null;
  accepted_at?: string | null;
  revoked_at?: string | null;
};

// ── Actions (permission keys) ───────────────────────────────────────────────

export const FIT_ACTIONS = [
  // Tenant / billing
  'tenant.manage_subscription',
  'tenant.manage_settings',
  'tenant.manage_website',
  'tenant.view_reports',
  'tenant.export_data',

  // People
  'coaches.list',
  'coaches.create',
  'coaches.edit',
  'coaches.delete',
  'coaches.view_rates',
  'coaches.manage_contracts',
  'coaches.invite',

  'members.list_all',
  'members.list_assigned',
  'members.create',
  'members.edit',
  'members.delete',
  'members.invite',
  'members.view_health',
  'members.view_billing',

  // Classes & calendar
  'classes.manage_types',
  'calendar.view_all',
  'calendar.view_own',
  'calendar.create_session',
  'calendar.edit_own_session',
  'calendar.edit_any_session',
  'calendar.cancel_session',
  'calendar.publish',

  // Floor / bookings
  'bookings.desk',
  'bookings.book_for_member',
  'bookings.mark_attendance',
  'bookings.view_roster_own',
  'bookings.view_roster_all',
  'checkins.desk',
  'checkins.self',

  // Feedback & messaging
  'feedback.view_all',
  'feedback.view_own_sessions',
  'feedback.submit_coach',
  'feedback.submit_member',
  'messages.desk',
  'messages.coach',
  'messages.member',

  // Memberships / money (desk tracking + Paystack split to the gym)
  'memberships.manage_plans',
  'subscriptions.manage',
  'pt_packs.manage',
] as const;

export type FitAction = (typeof FIT_ACTIONS)[number];

/**
 * Static permission matrix.
 * Owner: full control of the gym tenant.
 * Coach: scoped to own sessions + assigned private clients; no billing admin.
 * Member: personal data and self-serve booking only.
 * Desk: floor ops when has_front_desk (no rates, no coach contracts, no export).
 */
export const FIT_PERMISSION_MATRIX: Record<FitRole, readonly FitAction[]> = {
  owner: [
    'tenant.manage_subscription',
    'tenant.manage_settings',
    'tenant.manage_website',
    'tenant.view_reports',
    'tenant.export_data',
    'coaches.list',
    'coaches.create',
    'coaches.edit',
    'coaches.delete',
    'coaches.view_rates',
    'coaches.manage_contracts',
    'coaches.invite',
    'members.list_all',
    'members.create',
    'members.edit',
    'members.delete',
    'members.invite',
    'members.view_health',
    'members.view_billing',
    'classes.manage_types',
    'calendar.view_all',
    'calendar.create_session',
    'calendar.edit_any_session',
    'calendar.cancel_session',
    'calendar.publish',
    'bookings.desk',
    'bookings.book_for_member',
    'bookings.mark_attendance',
    'bookings.view_roster_all',
    'checkins.desk',
    'feedback.view_all',
    'feedback.submit_coach',
    'messages.desk',
    'messages.coach',
    'memberships.manage_plans',
    'subscriptions.manage',
    'pt_packs.manage',
  ],
  coach: [
    'coaches.list', // peers only (names)
    'members.list_assigned',
    'members.view_health', // assigned / roster only
    'calendar.view_own',
    'calendar.create_session', // if can_manage_classes
    'calendar.edit_own_session',
    'calendar.cancel_session', // own only — enforced in can()
    'calendar.publish', // own sessions
    'bookings.book_for_member', // walk-ins on own classes
    'bookings.mark_attendance',
    'bookings.view_roster_own',
    'feedback.view_own_sessions',
    'feedback.submit_coach',
    'messages.coach',
    'messages.member',
  ],
  member: [
    'calendar.view_own', // public + own bookings via portal
    'checkins.self',
    'feedback.submit_member',
    'messages.member',
  ],
  desk: [
    'coaches.list',
    'members.list_all',
    'members.create',
    'members.edit',
    'members.invite',
    'members.view_health',
    'calendar.view_all',
    'bookings.desk',
    'bookings.book_for_member',
    'bookings.mark_attendance',
    'bookings.view_roster_all',
    'checkins.desk',
    'feedback.view_all',
    'messages.desk',
    'messages.coach',
    'messages.member',
  ],
};

// ── Helpers ─────────────────────────────────────────────────────────────────

export function roleHasAction(role: FitRole, action: FitAction): boolean {
  return FIT_PERMISSION_MATRIX[role]?.includes(action) ?? false;
}

export type FitAuthContext = {
  role: FitRole;
  company_id: number;
  platform_user_id?: string | null;
  coach_id?: string | null;
  client_id?: string | null;
  /** Coach flag: can create/edit own classes */
  can_manage_classes?: boolean;
  /** Gym setting */
  has_front_desk?: boolean;
};

/**
 * Evaluate whether the actor may perform `action`.
 * Resource scoping (own session / assigned client) is applied when provided.
 */
export function can(
  ctx: FitAuthContext,
  action: FitAction,
  resource?: {
    session?: Pick<FitSession, 'id' | 'coach_id'> | null;
    client?: Pick<FitClient, 'id' | 'coach_id'> | null;
    coach?: Pick<FitCoach, 'id'> | null;
  }
): boolean {
  if (!roleHasAction(ctx.role, action)) return false;

  // Coach scoping
  if (ctx.role === 'coach') {
    if (
      action === 'calendar.create_session' ||
      action === 'calendar.edit_own_session' ||
      action === 'calendar.cancel_session' ||
      action === 'calendar.publish'
    ) {
      if (ctx.can_manage_classes === false) return false;
      if (resource?.session && resource.session.coach_id !== ctx.coach_id) {
        return false;
      }
    }
    if (
      action === 'bookings.view_roster_own' ||
      action === 'bookings.mark_attendance' ||
      action === 'feedback.view_own_sessions'
    ) {
      if (resource?.session && resource.session.coach_id !== ctx.coach_id) {
        return false;
      }
    }
    if (action === 'members.list_assigned' || action === 'members.view_health') {
      if (
        resource?.client &&
        resource.client.coach_id != null &&
        resource.client.coach_id !== ctx.coach_id
      ) {
        // Allow if on this coach's session roster (caller should pass session too)
        if (!resource.session || resource.session.coach_id !== ctx.coach_id) {
          return false;
        }
      }
    }
  }

  // Member: only self
  if (ctx.role === 'member') {
    if (resource?.client && resource.client.id !== ctx.client_id) return false;
  }

  // Desk only meaningful when front desk is enabled
  if (ctx.role === 'desk' && ctx.has_front_desk === false) return false;

  return true;
}

/** Clients a coach may see: assigned private clients + anyone on their sessions */
export function clientsVisibleToCoach(
  store: FitgraphStore,
  coachId: string
): FitClient[] {
  const sessionIds = new Set(
    store.sessions.filter((s) => s.coach_id === coachId).map((s) => s.id)
  );
  const clientIdsOnRoster = new Set<
    string
  >();
  for (const b of store.bookings) {
    if (sessionIds.has(b.session_id) && b.status !== 'cancelled') {
      clientIdsOnRoster.add(b.client_id);
    }
  }
  return store.clients.filter(
    (c) =>
      c.active !== false &&
      (c.coach_id === coachId || clientIdsOnRoster.has(c.id))
  );
}

/** Resolve role from portal token or company admin context */
export function resolveFitRoleFromTokens(opts: {
  isCompanyAdmin: boolean;
  coach?: FitCoach | null;
  client?: FitClient | null;
  has_front_desk?: boolean;
  /** Explicit desk staff flag if modelled later */
  isDeskStaff?: boolean;
}): FitAuthContext | null {
  if (opts.isCompanyAdmin) {
    return {
      role: 'owner',
      company_id: 0, // caller fills
      has_front_desk: opts.has_front_desk !== false,
    };
  }
  if (opts.coach) {
    return {
      role: 'coach',
      company_id: 0,
      coach_id: opts.coach.id,
      can_manage_classes: opts.coach.can_manage_classes !== false,
      has_front_desk: opts.has_front_desk !== false,
    };
  }
  if (opts.client) {
    return {
      role: 'member',
      company_id: 0,
      client_id: opts.client.id,
      platform_user_id: opts.client.platform_user_id,
      has_front_desk: opts.has_front_desk !== false,
    };
  }
  if (opts.isDeskStaff && opts.has_front_desk !== false) {
    return {
      role: 'desk',
      company_id: 0,
      has_front_desk: true,
    };
  }
  return null;
}

// ── Invite / accept flows ───────────────────────────────────────────────────

export type FitInviteKind = 'coach' | 'member';

export type FitInvitePayload = {
  kind: FitInviteKind;
  company_id: number;
  /** FitCoach.id or FitClient.id */
  entity_id: string;
  email: string;
  token: string;
  expires_at: string;
  invited_by_platform_user_id?: string | null;
};

/**
 * High-level invite → accept flow (implementation lives in API routes):
 *
 * 1. Owner (or desk for members) creates/ensures FitCoach or FitClient row.
 * 2. Issue portal_token (coach_*) or invite_token + portal_token (member_*).
 * 3. Email magic link: /accept/fitgraph/{token} or /portal/fitgraph/{token}.
 * 4. Recipient signs in / up with SupplierAdvisor (Privy).
 * 5. On accept:
 *    - Link platform_user_id on FitClient (or future FitCoach.platform_user_id).
 *    - Set invite_status = 'accepted', invite_accepted_at = now.
 *    - Activate gym role binding (coach or member).
 * 6. Subsequent visits: resolve role from platform_user_id + company context
 *    or from portal token (legacy / PWA deep link).
 * 7. Revoke: clear portal_token, set status revoked, optional end_date on coach.
 */
export const FIT_INVITE_FLOW_NOTES = {
  coach: [
    'Owner creates coach row (rates, contracts stay owner-only).',
    'Issue portal_token via issueCoachPortalToken(companyId).',
    'Email link opens coach portal; on first SA login, bind platform_user_id.',
    'Coach never sees other coaches’ rates or full member export.',
    'Revoke by clearing portal_token and/or closeCoachEngagement.',
  ],
  member: [
    'Owner/desk creates client; optional membership plan + coach_id assignment.',
    'Issue invite_token + portal_token via issueClientPortalToken.',
    'Email invite; accept links platform_user_id on FitClient.',
    'Member PWA shows only own bookings, packs, messages, public calendar.',
    'Family members can be booked under parent client without separate accounts.',
  ],
} as const;

/** Screen → capability summary for product / UI gating */
export const FIT_SCREEN_ACCESS: Record<
  string,
  { owner: boolean; coach: boolean; member: boolean; desk: boolean; notes?: string }
> = {
  '/dashboard/fitgraph': {
    owner: true,
    coach: false,
    member: false,
    desk: true,
    notes: 'Owner hub; desk may use Today board subset',
  },
  '/dashboard/fitgraph/coaches': {
    owner: true,
    coach: false,
    member: false,
    desk: false,
    notes: 'Rates & contracts owner-only',
  },
  '/dashboard/fitgraph/coach-calendar': {
    owner: true,
    coach: true,
    member: false,
    desk: true,
    notes: 'Redirects to gym calendar',
  },
  '/dashboard/fitgraph/clients': {
    owner: true,
    coach: true,
    member: false,
    desk: true,
    notes: 'Coach: assigned + roster only',
  },
  '/dashboard/fitgraph/memberships': {
    owner: true,
    coach: false,
    member: false,
    desk: false,
  },
  '/dashboard/fitgraph/subscriptions': {
    owner: true,
    coach: false,
    member: false,
    desk: false,
  },
  '/dashboard/fitgraph/classes': {
    owner: true,
    coach: false,
    member: false,
    desk: false,
  },
  '/dashboard/fitgraph/calendar': {
    owner: true,
    coach: true,
    member: false,
    desk: true,
    notes: 'Single gym diary; coach: own sessions if can_manage_classes',
  },
  '/dashboard/fitgraph/bookings': {
    owner: true,
    coach: true,
    member: false,
    desk: true,
  },
  '/dashboard/fitgraph/checkins': {
    owner: true,
    coach: false,
    member: false,
    desk: true,
  },
  '/dashboard/fitgraph/feedback': {
    owner: true,
    coach: true,
    member: false,
    desk: true,
  },
  '/dashboard/fitgraph/messages': {
    owner: true,
    coach: true,
    member: true,
    desk: true,
  },
  '/dashboard/fitgraph/website': {
    owner: true,
    coach: false,
    member: false,
    desk: false,
  },
  '/dashboard/fitgraph/report': {
    owner: true,
    coach: false,
    member: false,
    desk: false,
  },
  'coach_portal': {
    owner: false,
    coach: true,
    member: false,
    desk: false,
  },
  'member_portal': {
    owner: false,
    coach: false,
    member: true,
    desk: false,
  },
};
