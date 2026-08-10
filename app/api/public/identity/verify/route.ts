/**
 * Public portal identity verification (token auth).
 *
 * POST {
 *   module: fitgraph | physiograph | dentalgraph | medicalgraph | psychiatrygraph
 *   role: member | patient | coach
 *   token: portal token
 *   action: status | verifynow | didit_start | didit_refresh
 *   id_number?: string   // SA ID for VerifyNow
 *   consent?: boolean    // required for verifynow / didit_start
 * }
 *
 * SA residents: VerifyNow said_verification (instant).
 * International: Didit hosted KYC session (redirect URL).
 */
import { NextRequest, NextResponse } from 'next/server';
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
  buildDiditVendorData,
  portalIdentityView,
  softNameMatch,
  type PersonIdentityVerification,
  type ServiceIdentityModule,
  type ServiceIdentityRole,
} from '@/lib/identity/person-verification';
import { resolveIdentityPerson } from '@/lib/identity/service-person-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MODULES: ServiceIdentityModule[] = [
  'fitgraph',
  'physiograph',
  'dentalgraph',
  'medicalgraph',
  'psychiatrygraph',
];
const ROLES: ServiceIdentityRole[] = ['member', 'patient', 'coach'];

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

function providersAvailable() {
  return {
    verifynow: Boolean(process.env.VERIFYNOW_API_KEY?.trim()),
    didit: diditConfigured(),
  };
}

export async function GET(req: NextRequest) {
  // Capability probe (no auth) — UI can show which options exist
  return NextResponse.json({
    providers: providersAvailable(),
    message:
      'POST with portal token to verify. SA → VerifyNow, international → Didit.',
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit({
      key: `identity-verify:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Try again shortly.' },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const module = String(body.module || '') as ServiceIdentityModule;
    const role = String(body.role || '') as ServiceIdentityRole;
    const token = String(body.token || '');
    const action = String(body.action || 'status');

    if (!MODULES.includes(module) || !ROLES.includes(role) || !token) {
      return NextResponse.json(
        { error: 'module, role, and token are required' },
        { status: 400 }
      );
    }
    if (role === 'coach' && module !== 'fitgraph') {
      return NextResponse.json(
        { error: 'Coach verification is only available on FitAdvisor' },
        { status: 400 }
      );
    }
    if (role === 'member' && module !== 'fitgraph') {
      return NextResponse.json(
        { error: 'Member role is only for FitAdvisor' },
        { status: 400 }
      );
    }
    if (role === 'patient' && module === 'fitgraph') {
      return NextResponse.json(
        { error: 'Use role=member for FitAdvisor clients' },
        { status: 400 }
      );
    }

    const resolved = await resolveIdentityPerson({ module, role, token });
    if (!resolved) {
      return NextResponse.json(
        { error: 'Portal not found or inactive' },
        { status: 404 }
      );
    }

    const providers = providersAvailable();
    const identityView = () =>
      portalIdentityView(resolved.person.identity || { status: 'unverified' });

    if (action === 'status') {
      return NextResponse.json({
        success: true,
        identity: identityView(),
        id_number: resolved.person.id_number || null,
        providers,
      });
    }

    // ── VerifyNow (SA ID) ─────────────────────────────────
    if (action === 'verifynow') {
      if (!body.consent) {
        return NextResponse.json(
          {
            error:
              'Consent is required before running an identity check (POPIA / privacy).',
          },
          { status: 400 }
        );
      }
      if (!providers.verifynow) {
        return NextResponse.json(
          {
            error: 'VerifyNow is not configured on this server',
            hint: 'Set VERIFYNOW_API_KEY',
          },
          { status: 503 }
        );
      }

      const idNumber = String(
        body.id_number || body.idNumber || resolved.person.id_number || ''
      ).replace(/\s/g, '');
      if (!idNumber) {
        return NextResponse.json(
          { error: 'South African ID number is required for VerifyNow' },
          { status: 400 }
        );
      }
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
        ...(resolved.person.identity || { status: 'unverified' }),
        status: 'pending',
        provider: 'verifynow',
        id_number: idNumber,
        consent_at: now,
        last_checked_at: now,
        status_text: 'Checking with VerifyNow…',
      };
      resolved.applyIdentity(pending, { id_number: idNumber });
      await resolved.save();

      const vn = await callVerifyNowSaid({ idNumber });
      if (!vn.ok) {
        const failed: PersonIdentityVerification = {
          ...pending,
          status: 'failed',
          status_text: vn.error || 'VerifyNow failed',
          summary: { error: vn.error },
          last_checked_at: new Date().toISOString(),
        };
        resolved.applyIdentity(failed, { id_number: idNumber });
        await resolved.save();
        return NextResponse.json(
          {
            error: vn.error || 'VerifyNow verification failed',
            identity: portalIdentityView(failed),
            hint:
              vn.status === 503
                ? 'Set VERIFYNOW_API_KEY'
                : vn.status === 402
                  ? 'Top up VerifyNow credits at verifynow.co.za'
                  : undefined,
          },
          { status: vn.status >= 400 ? vn.status : 502 }
        );
      }

      const parsed = parseVerifyNowSaidResult(vn.data);
      let status: PersonIdentityVerification['status'] = parsed.ok
        ? 'verified'
        : 'failed';
      if (
        parsed.ok &&
        !softNameMatch(resolved.person.name, parsed.fullName)
      ) {
        status = 'mismatch';
      }
      const done: PersonIdentityVerification = {
        status,
        provider: 'verifynow',
        verified_at: parsed.ok ? new Date().toISOString() : null,
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
        didit_session_id: null,
        didit_url: null,
      };
      resolved.applyIdentity(done, { id_number: idNumber });
      await resolved.save();

      return NextResponse.json({
        success: true,
        identity: portalIdentityView(done),
        verifiedName: parsed.fullName,
        message:
          status === 'verified'
            ? `Verified via VerifyNow: ${parsed.fullName || idNumber}`
            : status === 'mismatch'
              ? `VerifyNow returned ${parsed.fullName}, which may not match your profile name`
              : `Verification did not pass: ${parsed.statusText}`,
        providers,
      });
    }

    // ── Didit start (international) ───────────────────────
    if (action === 'didit_start') {
      if (!body.consent) {
        return NextResponse.json(
          {
            error:
              'Consent is required before starting identity verification.',
          },
          { status: 400 }
        );
      }
      if (!providers.didit) {
        return NextResponse.json(
          {
            error: 'Didit is not configured on this server',
            hint: 'Set DIDIT_API_KEY and DIDIT_WORKFLOW_ID',
          },
          { status: 503 }
        );
      }

      const origin = siteOrigin(req);
      const callbackUrl = `${origin}/api/public/identity/didit/callback?module=${encodeURIComponent(module)}&role=${encodeURIComponent(role)}&token=${encodeURIComponent(token)}`;
      const vendorData = buildDiditVendorData({
        module,
        role,
        companyId: resolved.companyId,
        personId: resolved.person.id,
      });

      const nameParts = String(resolved.person.name || '')
        .trim()
        .split(/\s+/);
      const firstName = nameParts[0] || undefined;
      const lastName =
        nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

      const session = await createDiditSession({
        vendorData,
        callbackUrl,
        email: resolved.person.email,
        phone: resolved.person.phone,
        firstName,
        lastName,
        metadata: {
          module,
          role,
          companyId: resolved.companyId,
          personId: resolved.person.id,
        },
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
        id_number: resolved.person.id_number || null,
      };
      resolved.applyIdentity(pending);
      await resolved.save();

      return NextResponse.json({
        success: true,
        identity: portalIdentityView(pending),
        didit: {
          session_id: session.session_id,
          url: session.url,
          status: session.status,
        },
        message: 'Open the Didit link to complete identity verification',
        providers,
      });
    }

    // ── Didit refresh / poll decision ─────────────────────
    if (action === 'didit_refresh') {
      const sessionId = String(
        body.session_id ||
          body.sessionId ||
          resolved.person.identity?.didit_session_id ||
          ''
      );
      if (!sessionId) {
        return NextResponse.json(
          { error: 'No Didit session to refresh — start verification first' },
          { status: 400 }
        );
      }

      const decision = await retrieveDiditDecision(sessionId);
      if (!decision.ok) {
        return NextResponse.json(
          { error: decision.error, identity: identityView() },
          { status: decision.status >= 400 ? decision.status : 502 }
        );
      }

      const mapped = mapDiditStatus(decision.status);
      let status = mapped.identityStatus;
      if (
        status === 'verified' &&
        decision.fullName &&
        !softNameMatch(resolved.person.name, decision.fullName)
      ) {
        status = 'mismatch';
      }

      const next: PersonIdentityVerification = {
        ...(resolved.person.identity || { status: 'unverified' }),
        status,
        provider: 'didit',
        verified_at:
          status === 'verified' ? new Date().toISOString() : null,
        reference: sessionId,
        verified_name: decision.fullName || null,
        verified_dob: decision.dob || null,
        id_number:
          decision.documentNumber ||
          resolved.person.identity?.id_number ||
          resolved.person.id_number ||
          null,
        status_text: mapped.statusText,
        last_checked_at: new Date().toISOString(),
        didit_session_id: sessionId,
        summary: {
          nationality: decision.nationality,
          documentNumber: decision.documentNumber,
        },
      };
      resolved.applyIdentity(next, {
        id_number: next.id_number || undefined,
      });
      await resolved.save();

      return NextResponse.json({
        success: true,
        identity: portalIdentityView(next),
        message:
          status === 'verified'
            ? `Verified via Didit: ${decision.fullName || 'OK'}`
            : status === 'pending'
              ? 'Verification still in progress — finish on Didit or check again'
              : `Didit status: ${mapped.statusText}`,
        providers,
      });
    }

    return NextResponse.json(
      {
        error:
          'Unknown action. Use status | verifynow | didit_start | didit_refresh',
      },
      { status: 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
