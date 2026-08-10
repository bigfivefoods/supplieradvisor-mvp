/**
 * Didit webhook — update person identity when session status changes.
 * Configure webhook URL in Didit console → this path.
 * Optional: DIDIT_WEBHOOK_SECRET for HMAC verification.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  mapDiditStatus,
  retrieveDiditDecision,
  verifyDiditWebhookSignature,
} from '@/lib/didit/client';
import {
  parseDiditVendorData,
  softNameMatch,
  type PersonIdentityVerification,
} from '@/lib/identity/person-verification';
import { resolveIdentityPersonByIds } from '@/lib/identity/service-person-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const sig =
      req.headers.get('x-signature-simple') ||
      req.headers.get('x-signature') ||
      req.headers.get('X-Signature-Simple');
    const okSig = await verifyDiditWebhookSignature(raw, sig);
    if (!okSig) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(raw || '{}') as Record<string, unknown>;
    const sessionId = String(
      body.session_id ||
        body.sessionId ||
        (body.session as { id?: string })?.id ||
        ''
    );
    const vendorData = String(
      body.vendor_data ||
        body.vendorData ||
        (body.session as { vendor_data?: string })?.vendor_data ||
        ''
    );
    const statusRaw = String(
      body.status || body.decision || (body.session as { status?: string })?.status || ''
    );

    const parsed = parseDiditVendorData(vendorData);
    if (!parsed) {
      // Not our vendor_data — acknowledge so Didit doesn't retry forever
      return NextResponse.json({ ok: true, ignored: true });
    }

    const resolved = await resolveIdentityPersonByIds(parsed);
    if (!resolved) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'person_not_found' });
    }

    let decisionStatus = statusRaw;
    let fullName: string | undefined;
    let dob: string | undefined;
    let documentNumber: string | undefined;

    if (sessionId) {
      const decision = await retrieveDiditDecision(sessionId);
      if (decision.ok) {
        decisionStatus = decision.status || decisionStatus;
        fullName = decision.fullName;
        dob = decision.dob;
        documentNumber = decision.documentNumber;
      }
    }

    const mapped = mapDiditStatus(decisionStatus);
    let status = mapped.identityStatus;
    if (
      status === 'verified' &&
      fullName &&
      !softNameMatch(resolved.person.name, fullName)
    ) {
      status = 'mismatch';
    }

    const next: PersonIdentityVerification = {
      ...(resolved.person.identity || { status: 'unverified' }),
      status,
      provider: 'didit',
      verified_at: status === 'verified' ? new Date().toISOString() : null,
      reference: sessionId || resolved.person.identity?.reference || null,
      verified_name: fullName || resolved.person.identity?.verified_name || null,
      verified_dob: dob || null,
      id_number:
        documentNumber ||
        resolved.person.identity?.id_number ||
        resolved.person.id_number ||
        null,
      status_text: mapped.statusText,
      last_checked_at: new Date().toISOString(),
      didit_session_id: sessionId || resolved.person.identity?.didit_session_id || null,
    };
    resolved.applyIdentity(next, {
      id_number: next.id_number || undefined,
    });
    await resolved.save();

    return NextResponse.json({ ok: true, status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Webhook failed' },
      { status: 500 }
    );
  }
}
