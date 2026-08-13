/**
 * Wallet-level identity verification for SA Member (Privy auth).
 * SA → VerifyNow · International → Didit.
 *
 * GET  — providers + current verification
 * POST { action: status | verifynow | didit_start | didit_refresh, id_number?, consent? }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireVerifiedUser,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  callVerifyNowSaid,
  isValidSaIdNumber,
  parseVerifyNowSaidResult,
} from '@/lib/verifynow/client';
import {
  createDiditSession,
  diditConfigured,
  mapDiditStatus,
  retrieveDiditDecision,
} from '@/lib/didit/client';
import {
  portalIdentityView,
  softNameMatch,
  type PersonIdentityVerification,
} from '@/lib/identity/person-verification';
import {
  applyIdentityToProfile,
  identityFromProfile,
} from '@/lib/b2c/identity';
import {
  ensureB2cProfile,
  loadB2cProfile,
  saveB2cProfile,
} from '@/lib/b2c/profile-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function providersAvailable() {
  return {
    verifynow: Boolean(process.env.VERIFYNOW_API_KEY?.trim()),
    didit: diditConfigured(),
  };
}

function siteOrigin(req: NextRequest): string {
  const env =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (env) {
    const u = env.startsWith('http') ? env : `https://${env}`;
    return u.replace(/\/$/, '');
  }
  try {
    return new URL(req.url).origin;
  } catch {
    return 'https://supplieradvisor.com';
  }
}

async function authUser(request: NextRequest, body?: Record<string, unknown>) {
  const auth = await requireVerifiedUser(request, {
    legacyPrivyUserId: body
      ? String(body.privyUserId || body.userId || '') ||
        legacyPrivyFrom(request, body)
      : legacyPrivyFrom(request),
  });
  if (!auth.ok) return { ok: false as const, response: auth.response };
  const userId = getCanonicalUserId(auth.userId);
  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true as const, userId };
}

export async function GET(request: NextRequest) {
  const gate = await authUser(request);
  if (!gate.ok) return gate.response;
  const profile =
    (await loadB2cProfile(gate.userId)) ||
    (await ensureB2cProfile(gate.userId));
  return NextResponse.json({
    success: true,
    providers: providersAvailable(),
    identity: portalIdentityView(identityFromProfile(profile)),
  });
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `b2c-identity:${ip}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Try again shortly.' },
        { status: 429 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const gate = await authUser(request, body);
    if (!gate.ok) return gate.response;

    const action = String(body.action || 'status');
    const providers = providersAvailable();
    let profile =
      (await loadB2cProfile(gate.userId)) ||
      (await ensureB2cProfile(gate.userId));

    if (action === 'status') {
      return NextResponse.json({
        success: true,
        providers,
        identity: portalIdentityView(identityFromProfile(profile)),
      });
    }

    if (action === 'verifynow') {
      if (!body.consent) {
        return NextResponse.json(
          { error: 'Consent is required before identity verification.' },
          { status: 400 }
        );
      }
      if (!providers.verifynow) {
        return NextResponse.json(
          { error: 'VerifyNow is not configured', hint: 'Set VERIFYNOW_API_KEY' },
          { status: 503 }
        );
      }
      const idNumber = String(body.id_number || profile.id_number || '').replace(
        /\s/g,
        ''
      );
      if (!isValidSaIdNumber(idNumber)) {
        return NextResponse.json(
          {
            error:
              'Invalid South African ID number (expect 13 digits with valid checksum)',
          },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const pending: PersonIdentityVerification = {
        ...identityFromProfile(profile),
        status: 'pending',
        provider: 'verifynow',
        id_number: idNumber,
        consent_at: now,
        last_checked_at: now,
        status_text: 'Checking with VerifyNow…',
      };
      profile = applyIdentityToProfile(profile, pending, { id_number: idNumber });
      await saveB2cProfile(profile);

      const vn = await callVerifyNowSaid({ idNumber });
      if (!vn.ok) {
        const failed: PersonIdentityVerification = {
          ...pending,
          status: 'failed',
          status_text: vn.error || 'VerifyNow failed',
          last_checked_at: new Date().toISOString(),
        };
        profile = applyIdentityToProfile(profile, failed, { id_number: idNumber });
        await saveB2cProfile(profile);
        return NextResponse.json(
          {
            error: vn.error || 'VerifyNow verification failed',
            identity: portalIdentityView(failed),
          },
          { status: vn.status >= 400 ? vn.status : 502 }
        );
      }

      const parsed = parseVerifyNowSaidResult(vn.data);
      let status: PersonIdentityVerification['status'] = parsed.ok
        ? 'verified'
        : 'failed';
      if (parsed.ok && !softNameMatch(profile.full_name, parsed.fullName)) {
        status = 'mismatch';
      }
      const done: PersonIdentityVerification = {
        status,
        provider: 'verifynow',
        verified_at: parsed.ok ? now : null,
        reference: parsed.requestId || parsed.transactionId || null,
        verified_name: parsed.fullName || null,
        verified_dob: parsed.dob || null,
        id_number: idNumber,
        consent_at: now,
        status_text: parsed.statusText,
        last_checked_at: new Date().toISOString(),
        summary: {
          firstNames: parsed.firstNames,
          lastName: parsed.lastName,
          dob: parsed.dob,
        },
      };
      if (status === 'verified' && parsed.fullName && !profile.full_name) {
        profile.full_name = parsed.fullName;
      }
      profile = applyIdentityToProfile(profile, done, { id_number: idNumber });
      await saveB2cProfile(profile);
      return NextResponse.json({
        success: true,
        identity: portalIdentityView(done),
        message:
          status === 'verified'
            ? `Verified via VerifyNow: ${parsed.fullName || idNumber}`
            : status === 'mismatch'
              ? `VerifyNow returned ${parsed.fullName}, which may not match your profile name`
              : `Verification did not pass: ${parsed.statusText}`,
        providers,
      });
    }

    if (action === 'didit_start') {
      if (!body.consent) {
        return NextResponse.json(
          { error: 'Consent is required before identity verification.' },
          { status: 400 }
        );
      }
      if (!providers.didit) {
        return NextResponse.json(
          {
            error: 'Didit is not configured',
            hint: 'Set DIDIT_API_KEY and DIDIT_WORKFLOW_ID',
          },
          { status: 503 }
        );
      }
      const origin = siteOrigin(request);
      const callbackUrl = `${origin}/api/public/identity/didit/callback?module=b2c&user=${encodeURIComponent(gate.userId)}`;
      const nameParts = String(profile.full_name || '')
        .trim()
        .split(/\s+/);
      const session = await createDiditSession({
        vendorData: `sa:b2c:member:0:${gate.userId}`,
        callbackUrl,
        email: profile.email || undefined,
        phone: profile.phone || undefined,
        firstName: nameParts[0] || undefined,
        lastName:
          nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined,
        metadata: { module: 'b2c', userId: gate.userId },
      });
      if (!session.ok) {
        return NextResponse.json(
          { error: session.error, providers },
          { status: session.status >= 400 ? session.status : 502 }
        );
      }
      const now = new Date().toISOString();
      const pending: PersonIdentityVerification = {
        status: 'pending',
        provider: 'didit',
        consent_at: now,
        last_checked_at: now,
        status_text: session.status || 'Not Started',
        didit_session_id: session.session_id,
        didit_url: session.url,
        reference: session.session_id,
        id_number: profile.id_number || null,
      };
      profile = applyIdentityToProfile(profile, pending);
      await saveB2cProfile(profile);
      return NextResponse.json({
        success: true,
        identity: portalIdentityView(pending),
        didit: { session_id: session.session_id, url: session.url },
        message: 'Continue verification on Didit',
        providers,
      });
    }

    if (action === 'didit_refresh') {
      const current = identityFromProfile(profile);
      const sessionId = current.didit_session_id || current.reference;
      if (!sessionId) {
        return NextResponse.json(
          { error: 'No Didit session to refresh' },
          { status: 400 }
        );
      }
      const decision = await retrieveDiditDecision(sessionId);
      if (!decision.ok) {
        return NextResponse.json(
          { error: decision.error, identity: portalIdentityView(current) },
          { status: 502 }
        );
      }
      const mapped = mapDiditStatus(decision.status);
      let status = mapped.identityStatus;
      if (
        status === 'verified' &&
        decision.fullName &&
        !softNameMatch(profile.full_name, decision.fullName)
      ) {
        status = 'mismatch';
      }
      const next: PersonIdentityVerification = {
        ...current,
        status,
        provider: 'didit',
        verified_at: status === 'verified' ? new Date().toISOString() : null,
        reference: sessionId,
        verified_name: decision.fullName || current.verified_name || null,
        verified_dob: decision.dob || current.verified_dob || null,
        status_text: mapped.statusText,
        last_checked_at: new Date().toISOString(),
        didit_session_id: sessionId,
      };
      if (status === 'verified' && decision.fullName && !profile.full_name) {
        profile.full_name = decision.fullName;
      }
      profile = applyIdentityToProfile(profile, next);
      await saveB2cProfile(profile);
      return NextResponse.json({
        success: true,
        identity: portalIdentityView(next),
        message: 'Status updated',
        providers,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
