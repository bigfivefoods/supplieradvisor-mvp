import { NextRequest, NextResponse } from 'next/server';
import { withRequestTiming } from '@/lib/observability/request-timing-server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { loadMyCompanies } from '@/lib/business/me-companies';

/**
 * POST /api/me/companies
 * Reliable company membership lookup for Privy-authenticated clients.
 * Uses service role so RLS never hides rows when there is no Supabase session
 * (auth is Privy-only). Also matches by email for legacy / cross-device rows.
 *
 * Body: { privyUserId?: string, includeDeleted?: boolean }
 * Identity and owner emails come from the verified Privy JWT only.
 */
export async function POST(request: NextRequest) {
  return withRequestTiming('/api/me/companies', request, () => meCompaniesPost(request));
}

async function meCompaniesPost(request: NextRequest) {
  try {
    const body = await request.json();

    const _auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request),
    });
    if (!_auth.ok) return _auth.response;
    const userId = getCanonicalUserId(_auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const result = await loadMyCompanies({
      supabase: getSupabaseAdmin(),
      userId,
      jwtEmails: _auth.emails || [],
      includeDeleted: Boolean(body.includeDeleted),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('me/companies error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
