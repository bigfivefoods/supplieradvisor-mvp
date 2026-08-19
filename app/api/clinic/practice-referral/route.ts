/**
 * Consented practice-to-practice patient referral.
 * GET  ?companyId=  — inbound referrals for this desk
 * POST { companyId, personId, fromKind, toCompanyId, toKind, scopes, note, consented }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { notifyLinkedMember } from '@/lib/b2c/member-push';
import {
  companiesAreAssociated,
  findMemberForDeskPerson,
  isAdvisorShareKind,
  requestProfileShare,
} from '@/lib/b2c/profile-shares';
import {
  loadWalletCompany,
  saveWalletCompanyMeta,
} from '@/lib/b2c/load-company';
import {
  buildPracticeReferralSnapshot,
  isClinicShareKind,
  readInboundReferrals,
  writeInboundReferral,
  type PracticeReferralInbound,
} from '@/lib/clinic/practice-referral';
import type { ClinicalShareScope } from '@/lib/services/advisor-b2c-relationship';
import { CLINICAL_SHARE_SCOPE_LABEL } from '@/lib/services/advisor-b2c-relationship';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCOPE_KEYS = new Set(Object.keys(CLINICAL_SHARE_SCOPE_LABEL));

function parseScopes(raw: unknown): ClinicalShareScope[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => String(s))
    .filter((s): s is ClinicalShareScope => SCOPE_KEYS.has(s));
}

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
    const dest = await loadWalletCompany(companyId);
    const inbound = dest
      ? readInboundReferrals(dest.meta).filter((r) => r.status === 'active')
      : [];
    return NextResponse.json({ success: true, inbound });
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

    const fromKind = body.fromKind || body.from_kind || 'medical';
    const toKind = body.toKind || body.to_kind;
    if (!isClinicShareKind(fromKind) || !isAdvisorShareKind(toKind)) {
      return NextResponse.json(
        { error: 'Pick a clinic desk to refer from and an Advisor desk to refer to' },
        { status: 400 }
      );
    }
    const personId = String(body.personId || body.person_id || '');
    const toCompanyId = Number(body.toCompanyId || body.to_company_id);
    if (!personId || !Number.isFinite(toCompanyId)) {
      return NextResponse.json(
        { error: 'Patient and destination practice required' },
        { status: 400 }
      );
    }
    if (toCompanyId === companyId) {
      return NextResponse.json(
        { error: 'Pick a different practice' },
        { status: 400 }
      );
    }
    if (body.consented !== true) {
      return NextResponse.json(
        { error: 'The patient must consent before this referral is sent' },
        { status: 400 }
      );
    }
    const scopes = parseScopes(body.scopes);
    if (!scopes.length) {
      return NextResponse.json(
        { error: 'Select at least one piece of information to share' },
        { status: 400 }
      );
    }

    const associated = await companiesAreAssociated(companyId, toCompanyId);
    if (!associated) {
      return NextResponse.json(
        {
          error:
            'Connect with that practice in Network first, then you can refer this patient.',
        },
        { status: 400 }
      );
    }

    const fromCo = await loadWalletCompany(companyId);
    const toCo = await loadWalletCompany(toCompanyId);
    if (!fromCo || !toCo) {
      return NextResponse.json({ error: 'Practice not found' }, { status: 404 });
    }

    const snapshot = buildPracticeReferralSnapshot({
      companyName: fromCo.name,
      kind: fromKind,
      meta: fromCo.meta,
      patientId: personId,
      scopes,
      referralReason: body.note ? String(body.note) : null,
      referringPractitionerName: body.referring_practitioner
        ? String(body.referring_practitioner)
        : null,
    });
    if (!snapshot) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const inbound: PracticeReferralInbound = {
      id: `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      from_company_id: companyId,
      from_company_name: snapshot.practice?.brand || fromCo.name,
      from_kind: fromKind,
      from_ref_id: personId,
      to_kind: toKind,
      patient_name: snapshot.name,
      scopes,
      note: body.note ? String(body.note) : null,
      status: 'active',
      created_at: new Date().toISOString(),
      snapshot,
    };
    await saveWalletCompanyMeta(
      toCompanyId,
      writeInboundReferral(toCo.meta, inbound)
    );

    const member = await findMemberForDeskPerson({
      companyId,
      kind: fromKind,
      refId: personId,
      platformUserId: body.platformUserId
        ? String(body.platformUserId)
        : null,
      email: body.email ? String(body.email) : null,
    });
    if (member) {
      const share = await requestProfileShare({
        profile: member,
        fromCompanyId: companyId,
        fromKind,
        fromRefId: personId,
        toCompanyId,
        toKind,
        requestedBy: 'member',
        note: body.note ? String(body.note) : null,
      });
      if (share.ok) {
        void notifyLinkedMember({
          platformUserId: member.user_id,
          title: `Your record was shared with ${toCo.name}`,
          body: `${fromCo.name} referred you to ${toCo.name} with the details you agreed to share.`,
          url: '/me',
          tag: `referral-${inbound.id}`,
          topic: 'care',
        });
      }
    }

    return NextResponse.json({
      success: true,
      referral: inbound,
      message: `Shared ${snapshot.name} with ${toCo.name}`,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Send failed' },
      { status: 500 }
    );
  }
}
