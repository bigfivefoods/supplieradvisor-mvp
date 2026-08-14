/**
 * Desk API for member profile shares.
 * GET  ?companyId=&personId=&kind=
 * POST { action: request, companyId, personId, kind, toCompanyId, toKind, note }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  findMemberForDeskPerson,
  isAdvisorShareKind,
  listAcceptedAdvisorPeers,
  listIncomingShares,
  requestProfileShare,
  sharesForPerson,
} from '@/lib/b2c/profile-shares';
import { notifyLinkedMember } from '@/lib/b2c/member-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const peers = await listAcceptedAdvisorPeers(companyId);
    const incoming = await listIncomingShares(companyId);

    const personId = request.nextUrl.searchParams.get('personId');
    const kindRaw = request.nextUrl.searchParams.get('kind');
    const kind = isAdvisorShareKind(kindRaw) ? kindRaw : null;
    const email = request.nextUrl.searchParams.get('email');
    const platformUserId = request.nextUrl.searchParams.get('platformUserId');

    let outgoing = [] as ReturnType<typeof sharesForPerson>;
    let memberLinked = false;
    if (personId && kind) {
      const profile = await findMemberForDeskPerson({
        companyId,
        kind,
        refId: personId,
        platformUserId,
        email,
      });
      memberLinked = Boolean(profile);
      if (profile) outgoing = sharesForPerson(profile, companyId, personId);
    }

    return NextResponse.json({
      success: true,
      peers,
      incoming: incoming.filter((r) => r.status === 'active'),
      pending_in: incoming.filter((r) => r.status === 'pending'),
      outgoing,
      member_linked: memberLinked,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const action = String(body.action || 'request');
    if (action !== 'request') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const kind = body.kind;
    const toKind = body.to_kind || body.toKind;
    if (!isAdvisorShareKind(kind) || !isAdvisorShareKind(toKind)) {
      return NextResponse.json({ error: 'Pick Advisor desks to share' }, { status: 400 });
    }
    const personId = String(body.personId || body.person_id || '');
    const toCompanyId = Number(body.toCompanyId || body.to_company_id);
    if (!personId || !Number.isFinite(toCompanyId)) {
      return NextResponse.json({ error: 'person and destination required' }, { status: 400 });
    }

    const profile = await findMemberForDeskPerson({
      companyId,
      kind,
      refId: personId,
      platformUserId: body.platformUserId ? String(body.platformUserId) : null,
      email: body.email ? String(body.email) : null,
    });
    if (!profile) {
      return NextResponse.json(
        {
          error:
            'This person is not on SA Member yet. Invite them first — they must consent from the app.',
        },
        { status: 400 }
      );
    }

    const result = await requestProfileShare({
      profile,
      fromCompanyId: companyId,
      fromKind: kind,
      fromRefId: personId,
      toCompanyId,
      toKind,
      requestedBy: 'desk',
      note: body.note ? String(body.note) : null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    void notifyLinkedMember({
      platformUserId: profile.user_id,
      title: 'Consent needed to share your profile',
      body: `${result.share.from_company_name} wants to share your ${result.share.from_kind} profile with ${result.share.to_company_name}.`,
      url: '/me',
      tag: `share-${result.share.id}`,
      topic: 'care',
    });

    return NextResponse.json({
      success: true,
      share: result.share,
      message: `Asked ${profile.full_name || 'the member'} to consent before ${result.share.to_company_name} can see this profile`,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
