/**
 * GET /api/fitness/fitgraph/portal-redirect?companyId=X
 *
 * Called by FitgraphRequired when the signed-in user is NOT the gym owner.
 * Returns the URL they should be redirected to:
 *   - /coach/fitgraph/[token]  — if they are a live coach at this gym
 *   - /member/fitgraph/[token] — if they are a live member at this gym
 *   - /dashboard               — fallback (no gym role)
 *
 * This is not a sensitive data endpoint — it returns only a URL string.
 * Auth required (verified user); no owner role needed.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireVerifiedUser,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { loadFitgraphMerged, saveFitgraphMerged } from '@/lib/fitness/fitgraph-io';
import {
  findCoachForPortalSignIn,
  ensureCoachPortalToken,
  ensureClientPortalToken,
} from '@/lib/fitness/fitgraph';
import type { FitClient } from '@/lib/fitness/fitgraph';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ redirect: '/dashboard' });
    }

    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!auth.ok) return NextResponse.json({ redirect: '/dashboard' });

    const emails: string[] = (auth.emails || [])
      .map((e: string) => String(e).trim().toLowerCase())
      .filter((e: string) => e.includes('@'));

    if (!emails.length) {
      return NextResponse.json({ redirect: '/dashboard' });
    }

    const { store } = await loadFitgraphMerged(companyId);

    // Check for coach role first
    for (const email of emails) {
      const coach = findCoachForPortalSignIn(store, { email });
      if (coach) {
        const hadToken = Boolean(coach.portal_token);
        const token = ensureCoachPortalToken(coach, companyId);
        if (!hadToken) await saveFitgraphMerged(companyId, store);
        return NextResponse.json({ redirect: `/coach/fitgraph/${token}` });
      }
    }

    // Check for member role
    const client: FitClient | undefined = (store.clients || []).find((c) => {
      if (c.active === false) return false;
      const clientEmails = [c.email, c.invite_email]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter((v) => v.includes('@'));
      return emails.some((e) => clientEmails.includes(e));
    });

    if (client) {
      const hadToken = Boolean(client.portal_token);
      ensureClientPortalToken(client, companyId);
      if (!hadToken) await saveFitgraphMerged(companyId, store);
      return NextResponse.json({ redirect: `/member/fitgraph/${client.portal_token}` });
    }

    return NextResponse.json({ redirect: '/dashboard' });
  } catch {
    return NextResponse.json({ redirect: '/dashboard' });
  }
}
