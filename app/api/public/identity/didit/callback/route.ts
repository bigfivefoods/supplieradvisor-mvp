/**
 * Didit redirects here after the hosted verification flow.
 * Query: verificationSessionId, status, module, role, token
 * We refresh the decision, then bounce the user back to their portal profile.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  mapDiditStatus,
  retrieveDiditDecision,
} from '@/lib/didit/client';
import {
  softNameMatch,
  type PersonIdentityVerification,
  type ServiceIdentityModule,
  type ServiceIdentityRole,
} from '@/lib/identity/person-verification';
import { resolveIdentityPerson } from '@/lib/identity/service-person-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function portalPath(
  module: string,
  role: string,
  token: string
): string {
  if (module === 'fitgraph' && role === 'coach') {
    return `/coach/fitgraph/${encodeURIComponent(token)}`;
  }
  if (module === 'fitgraph') {
    return `/member/fitgraph/${encodeURIComponent(token)}`;
  }
  return `/member/${encodeURIComponent(module)}/${encodeURIComponent(token)}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sessionId = String(
    url.searchParams.get('verificationSessionId') ||
      url.searchParams.get('session_id') ||
      ''
  );
  const module = String(url.searchParams.get('module') || '') as ServiceIdentityModule;
  const role = String(url.searchParams.get('role') || '') as ServiceIdentityRole;
  const token = String(url.searchParams.get('token') || '');
  const statusHint = String(url.searchParams.get('status') || '');

  const back = token
    ? `${portalPath(module, role, token)}?tab=profile&identity=1`
    : '/';

  try {
    if (sessionId && module && role && token) {
      const resolved = await resolveIdentityPerson({ module, role, token });
      if (resolved) {
        const decision = await retrieveDiditDecision(sessionId);
        if (decision.ok) {
          const mapped = mapDiditStatus(decision.status || statusHint);
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
              null,
            status_text: mapped.statusText,
            last_checked_at: new Date().toISOString(),
            didit_session_id: sessionId,
          };
          resolved.applyIdentity(next, {
            id_number: next.id_number || undefined,
          });
          await resolved.save();
        }
      }
    }
  } catch {
    // still redirect home
  }

  return NextResponse.redirect(new URL(back, url.origin));
}
