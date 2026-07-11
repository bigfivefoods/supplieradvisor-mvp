/**
 * Tier-1 API authorization helpers.
 *
 * Usage in route handlers:
 *   const gate = await requireCompanyAccess(request, companyId);
 *   if (!gate.ok) return gate.response;
 *   // gate.userId is verified
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  allowLegacyPrivyId,
  extractAccessToken,
  isAuthStrict,
  verifyPrivyAccessToken,
} from '@/lib/auth/verify-privy';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { assertCompanyMember } from '@/lib/customers/access';
import {
  assertCompanyPermission,
  getCompanyMembership,
  type MembershipFail,
  type MembershipOk,
} from '@/lib/business/access';
import type {
  AccessLevel,
  PermissionResource,
  TeamRole,
} from '@/lib/business/permissions';
export { isPublicApiPath, PUBLIC_API_PREFIXES } from '@/lib/auth/public-paths';

export type AuthOk = {
  ok: true;
  userId: string;
  /** true when JWT verified; false only in legacy relaxed mode */
  verified: boolean;
};

export type AuthFail = {
  ok: false;
  response: NextResponse;
  error: string;
  status: number;
};

/**
 * Cron / webhook secret auth (Bearer CRON_SECRET or x-cron-secret).
 */
export function assertCronSecret(request: NextRequest): AuthOk | AuthFail {
  const secret = process.env.CRON_SECRET || process.env.CUSTOMER_INVITE_EXPIRE_SECRET || '';
  if (!secret) {
    return fail(503, 'CRON_SECRET not configured', 'NO_CRON_SECRET');
  }
  const auth = request.headers.get('authorization') || '';
  const header = request.headers.get('x-cron-secret') || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  if (bearer === secret || header === secret) {
    return { ok: true, userId: 'cron:system', verified: true };
  }
  return fail(401, 'Invalid cron secret', 'CRON_UNAUTHORIZED');
}

function fail(status: number, error: string, code?: string): AuthFail {
  return {
    ok: false,
    status,
    error,
    response: NextResponse.json({ error, code: code || 'AUTH_FAILED' }, { status }),
  };
}

/**
 * Resolve verified user id from Bearer/cookie token.
 * Optionally accepts legacy body/query privyUserId only when AUTH_ALLOW_LEGACY_PRIVY_ID and not strict.
 */
export async function requireVerifiedUser(
  request: NextRequest,
  opts?: { legacyPrivyUserId?: string | null }
): Promise<AuthOk | AuthFail> {
  const token = extractAccessToken(request.headers, request.headers.get('cookie'));
  const verified = await verifyPrivyAccessToken(token);

  if (verified.ok) {
    // If client also sent privyUserId, it must match token
    const legacy = getCanonicalUserId(opts?.legacyPrivyUserId);
    if (legacy) {
      const a = verified.user.userId.toLowerCase();
      const b = legacy.toLowerCase();
      const variantsOk =
        a === b ||
        a.replace(/^did:privy:/, '') === b.replace(/^did:privy:/, '') ||
        a.endsWith(b) ||
        b.endsWith(a.replace(/^did:privy:/, ''));
      if (!variantsOk && isAuthStrict()) {
        return fail(403, 'privyUserId does not match access token', 'USER_MISMATCH');
      }
    }
    return { ok: true, userId: verified.user.userId, verified: true };
  }

  // Strict mode: no token = 401
  if (isAuthStrict()) {
    return fail(
      401,
      'Authentication required. Send Authorization: Bearer <Privy access token>.',
      verified.code || 'UNAUTHORIZED'
    );
  }

  // Relaxed legacy path (local dev only)
  if (allowLegacyPrivyId()) {
    const legacy = getCanonicalUserId(opts?.legacyPrivyUserId);
    if (legacy) {
      console.warn('[auth] LEGACY privyUserId accepted (AUTH_STRICT=false)');
      return { ok: true, userId: legacy, verified: false };
    }
  }

  return fail(
    401,
    verified.error || 'Authentication required',
    verified.code || 'UNAUTHORIZED'
  );
}

/**
 * Verified user + active company membership.
 */
export async function requireCompanyAccess(
  request: NextRequest,
  companyId: number,
  opts?: { legacyPrivyUserId?: string | null }
): Promise<(AuthOk & { member: true }) | AuthFail> {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return fail(400, 'Valid companyId is required', 'BAD_COMPANY');
  }

  const auth = await requireVerifiedUser(request, opts);
  if (!auth.ok) return auth;

  const mem = await assertCompanyMember(auth.userId, companyId);
  if (!mem.ok) {
    return fail(mem.status, mem.error, 'NOT_MEMBER');
  }

  return { ok: true, userId: mem.userId, verified: auth.verified, member: true };
}

/**
 * Verified user + role permission on a resource.
 */
export async function requireCompanyPermission(
  request: NextRequest,
  companyId: number,
  resource: PermissionResource,
  need: AccessLevel = 'view',
  opts?: { legacyPrivyUserId?: string | null }
): Promise<(AuthOk & MembershipOk) | AuthFail> {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return fail(400, 'Valid companyId is required', 'BAD_COMPANY');
  }

  const auth = await requireVerifiedUser(request, opts);
  if (!auth.ok) return auth;

  const mem = await assertCompanyPermission(auth.userId, companyId, resource, need);
  if (!mem.ok) {
    return fail(mem.status, mem.error, 'FORBIDDEN');
  }

  return {
    ok: true,
    userId: mem.userId,
    verified: auth.verified,
    memberId: mem.memberId,
    role: mem.role,
    status: mem.status,
    email: mem.email,
    name: mem.name,
  };
}

/**
 * Verified member whose role is in an explicit allow-list.
 * Use for critical actions (period lock, escrow release, team owner invites).
 */
export async function requireCompanyRoles(
  request: NextRequest,
  companyId: number,
  allowedRoles: TeamRole[],
  opts?: { legacyPrivyUserId?: string | null }
): Promise<(AuthOk & MembershipOk) | AuthFail> {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return fail(400, 'Valid companyId is required', 'BAD_COMPANY');
  }

  const auth = await requireVerifiedUser(request, opts);
  if (!auth.ok) return auth;

  const mem = await getCompanyMembership(auth.userId, companyId);
  if (!mem.ok) {
    return fail(mem.status, mem.error, 'NOT_MEMBER');
  }

  if (!allowedRoles.includes(mem.role)) {
    return fail(
      403,
      `Your role (${mem.role}) cannot perform this action. Allowed: ${allowedRoles.join(', ')}.`,
      'ROLE_FORBIDDEN'
    );
  }

  return {
    ok: true,
    userId: mem.userId,
    verified: auth.verified,
    memberId: mem.memberId,
    role: mem.role,
    status: mem.status,
    email: mem.email,
    name: mem.name,
  };
}

/** Common role sets for sensitive writes */
export const ROLES_FINANCE_CRITICAL: TeamRole[] = ['owner', 'admin', 'finance'];
export const ROLES_OPS_CRITICAL: TeamRole[] = ['owner', 'admin', 'operations'];
export const ROLES_MONEY_OR_OPS: TeamRole[] = [
  'owner',
  'admin',
  'finance',
  'operations',
];

/** Parse companyId from query or JSON body (does not consume body twice — pass body if already read) */
export function companyIdFromQuery(request: NextRequest): number {
  return Number(request.nextUrl.searchParams.get('companyId'));
}

export function companyIdFromBody(body: Record<string, unknown>): number {
  return Number(body.companyId ?? body.buyerCompanyId ?? body.profile_id);
}

export function legacyPrivyFrom(
  request: NextRequest,
  body?: Record<string, unknown>
): string | null {
  const q = request.nextUrl.searchParams.get('privyUserId');
  if (q) return q;
  if (body?.privyUserId != null) return String(body.privyUserId);
  return null;
}

export type { MembershipOk, MembershipFail };
