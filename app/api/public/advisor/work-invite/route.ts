/**
 * Public contractor work-app invite: preview + accept.
 */
import { NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  advisorWorkforceLabel,
  buildAdvisorWorkPortalPath,
  parseAdvisorWorkInviteToken,
} from '@/lib/services/advisor-workforce';
import { loadAdvisorWorkforce } from '@/lib/services/advisor-workforce-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rl = rateLimit({
      key: `work-invite:${clientIp(request)}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
    }
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }
    const parsed = parseAdvisorWorkInviteToken(token);
    if (!parsed.module || !parsed.companyId) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    const bundle = await loadAdvisorWorkforce(parsed.companyId, parsed.module);
    if (!bundle) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    const person = bundle.people.find((p) => p.work_invite_token === token);
    if (!person) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      invite: {
        module: parsed.module,
        module_label: advisorWorkforceLabel(parsed.module),
        business_name: bundle.brand,
        person: { name: person.name, email: person.email },
        invite_status: person.work_invite_status || 'pending',
        can_claim: person.work_invite_status !== 'revoked',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit({
      key: `work-invite-post:${clientIp(request)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
    }
    const body = await request.json();
    const token = String(body.token || '').trim();
    const parsed = parseAdvisorWorkInviteToken(token);
    if (!parsed.module || !parsed.companyId) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    const bundle = await loadAdvisorWorkforce(parsed.companyId, parsed.module);
    if (!bundle) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    const person = bundle.people.find((p) => p.work_invite_token === token);
    if (!person) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    if (person.work_invite_status === 'revoked') {
      return NextResponse.json({ error: 'This invitation was revoked' }, { status: 403 });
    }
    const portal = person.portal_token;
    if (!portal) {
      return NextResponse.json({ error: 'Portal is not ready' }, { status: 400 });
    }
    bundle.applyPerson(person.id, {
      work_invite_status: 'accepted',
      work_invite_accepted_at: new Date().toISOString(),
    });
    await bundle.persist();
    const path = buildAdvisorWorkPortalPath(parsed.module, portal);
    return NextResponse.json({
      success: true,
      portal_path: path,
      message: 'Invitation accepted',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
