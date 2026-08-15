/**
 * B2C consumer wallet API.
 * GET  — profile + memberships (auth required)
 * POST { action: update_profile | unlink }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireVerifiedUser,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  ensureB2cProfile,
  loadB2cProfile,
  removeMembership,
  removeMembershipsForCompany,
  saveB2cProfile,
} from '@/lib/b2c/profile-store';
import { kindLabel } from '@/lib/b2c/link-token';
import { discoverAndAttachMemberships } from '@/lib/b2c/discover-memberships';
import { buildB2cActivity } from '@/lib/b2c/activity';
import {
  loadBusinessWorkspaceSummary,
  operatorCompanyIds,
} from '@/lib/b2c/workspace';
import { buildHireJourneys } from '@/lib/b2c/hire-journeys';
import { verificationView } from '@/lib/b2c/identity';
import { isWalletVisibleMembership } from '@/lib/b2c/company-modules';
import {
  applySnapshotToProfile,
  pushHouseholdToLinkedDesks,
  refreshWalletHousehold,
  snapshotFromProfile,
} from '@/lib/b2c/wallet-household';
import {
  portalFamilyView,
  removeFamilyMember,
  upsertFamilyMember,
} from '@/lib/services/family-members';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!auth.ok) return auth.response;
    const userId = getCanonicalUserId(auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const qEmail = request.nextUrl.searchParams.get('email');
    const qPhone = request.nextUrl.searchParams.get('phone');
    const qName = request.nextUrl.searchParams.get('name');

    let profile =
      (await loadB2cProfile(userId)) ||
      (await ensureB2cProfile(userId, {
        email: qEmail,
        phone: qPhone,
        full_name: qName,
      }));

    if (qEmail && !profile.email) profile.email = qEmail;
    if (qPhone && !profile.phone) profile.phone = qPhone;
    if (qName && !profile.full_name) profile.full_name = qName;

    let business = {
      has_business: false,
      business_count: 0,
      businesses: [] as Array<{ id: number; name: string; role?: string | null }>,
    };
    try {
      business = await loadBusinessWorkspaceSummary(userId);
    } catch {
      /* operator check is optional */
    }
    const ownedIds = operatorCompanyIds(business);

    // Auto-attach hire/gym/clinic books that already have this email or phone
    try {
      const found = await discoverAndAttachMemberships(profile, {
        email: profile.email || qEmail,
        phone: profile.phone || qPhone,
        platformUserId: userId,
        skipCompanyIds: ownedIds,
      });
      if (found.attached > 0) {
        profile = found.profile;
        await saveB2cProfile(profile);
      }
    } catch {
      /* discover is best-effort */
    }

    // Companies you operate stay in Switch to business. Keep a wallet card
    // only when you are also a gym / clinic / hire customer there.
    const ownedSet = new Set(ownedIds);
    const hadOwnerShopCard = (profile.memberships || []).some(
      (m) =>
        m.active !== false &&
        ownedSet.has(m.company_id) &&
        !isWalletVisibleMembership(m, ownedSet)
    );
    if (hadOwnerShopCard) {
      profile = {
        ...profile,
        memberships: (profile.memberships || []).map((m) =>
          ownedSet.has(m.company_id) && !isWalletVisibleMembership(m, ownedSet)
            ? { ...m, active: false }
            : m
        ),
      };
      await saveB2cProfile(profile);
    }

    try {
      profile = await refreshWalletHousehold(profile, {
        extraCompanyIds: ownedIds,
        push: true,
      });
    } catch {
      /* household sync is best-effort */
    }

    const memberships = (profile.memberships || [])
      .filter((m) => isWalletVisibleMembership(m, ownedSet))
      .map((m) => ({
        ...m,
        kind_label: kindLabel(m.kind),
        you_operate: ownedSet.has(m.company_id),
      }));

    let activity: Awaited<ReturnType<typeof buildB2cActivity>> = [];
    try {
      activity = await buildB2cActivity(memberships);
    } catch {
      activity = [];
    }

    const docs = activity.filter((a) => a.tone === 'docs' || a.tone === 'alert');

    let journeys: Awaited<ReturnType<typeof buildHireJourneys>> = [];
    try {
      journeys = await buildHireJourneys(memberships);
    } catch {
      journeys = [];
    }

    const verification = verificationView(profile);

    return NextResponse.json({
      success: true,
      identity: {
        kind: 'personal',
        company_id: null,
        note: 'Personal wallet is never bound to a selected company workspace',
      },
      workspace: {
        kind: 'personal',
        ...business,
      },
      has_business: business.has_business,
      business_count: business.business_count,
      businesses: business.businesses,
      profile: {
        ...profile,
        memberships,
        city: profile.city || null,
        id_number: profile.id_number || null,
        family: portalFamilyView(profile.family),
      },
      verification,
      journeys,
      activity,
      stats: {
        memberships: memberships.length,
        hire: memberships.filter((m) => m.kind === 'hire').length,
        gym: memberships.filter((m) => m.kind === 'gym').length,
        clinic: memberships.filter((m) =>
          ['physio', 'dental', 'medical', 'psychiatry'].includes(m.kind)
        ).length,
        needs_attention: docs.length,
        open_hires: journeys.filter((j) => j.open).length,
        verified: verification.is_verified,
        profile_score: verification.completeness.score,
        profile_max: verification.completeness.max,
      },
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
    const body = await request.json().catch(() => ({}));
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId:
        body.privyUserId || body.userId || legacyPrivyFrom(request, body),
    });
    if (!auth.ok) return auth.response;
    const userId = getCanonicalUserId(auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const action = String(body.action || 'update_profile');
    let profile = (await loadB2cProfile(userId)) || (await ensureB2cProfile(userId));

    if (action === 'unlink' || action === 'remove_membership') {
      const mid = String(body.membership_id || body.id || '');
      if (!mid) {
        return NextResponse.json(
          { error: 'membership_id required' },
          { status: 400 }
        );
      }
      profile = removeMembership(profile, mid);
      await saveB2cProfile(profile);
      return NextResponse.json({
        success: true,
        profile,
        message: 'Removed from your wallet',
      });
    }

    if (action === 'family_upsert' || action === 'family_save') {
      const patch = (body.member || body.record || body) as Record<
        string,
        unknown
      >;
      const { list, member, error } = upsertFamilyMember(
        snapshotFromProfile(profile).family,
        patch
      );
      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }
      profile = applySnapshotToProfile(profile, {
        ...snapshotFromProfile(profile),
        family: list,
      });
      await saveB2cProfile(profile);
      try {
        await pushHouseholdToLinkedDesks(profile);
      } catch {
        /* desk push is best-effort */
      }
      return NextResponse.json({
        success: true,
        member,
        profile: {
          ...profile,
          family: portalFamilyView(profile.family),
        },
        message: patch.id
          ? 'Family member updated on your wallet'
          : 'Family member saved — linked gyms and clinics will use this list',
      });
    }

    if (action === 'family_remove' || action === 'family_delete') {
      const famId = String(body.member_id || body.id || '');
      if (!famId) {
        return NextResponse.json(
          { error: 'member_id required' },
          { status: 400 }
        );
      }
      profile = applySnapshotToProfile(profile, {
        ...snapshotFromProfile(profile),
        family: removeFamilyMember(snapshotFromProfile(profile).family, famId),
      });
      await saveB2cProfile(profile);
      try {
        await pushHouseholdToLinkedDesks(profile);
      } catch {
        /* desk push is best-effort */
      }
      return NextResponse.json({
        success: true,
        profile: {
          ...profile,
          family: portalFamilyView(profile.family),
        },
        message: 'Family member removed from your wallet',
      });
    }

    if (action === 'unlink_company') {
      const companyId = Number(body.company_id || body.company);
      if (!Number.isFinite(companyId) || companyId <= 0) {
        return NextResponse.json(
          { error: 'company_id required' },
          { status: 400 }
        );
      }
      profile = removeMembershipsForCompany(profile, companyId);
      await saveB2cProfile(profile);
      return NextResponse.json({
        success: true,
        profile,
        message: 'Business removed from your wallet',
      });
    }

    // update_profile
    if (body.email != null) profile.email = String(body.email).trim() || null;
    if (body.full_name != null || body.name != null) {
      profile.full_name = String(body.full_name || body.name || '').trim() || null;
    }
    if (body.phone != null) profile.phone = String(body.phone).trim() || null;
    if (body.city != null) profile.city = String(body.city).trim() || null;
    if (body.id_number != null) {
      profile.id_number = String(body.id_number).replace(/\s/g, '') || null;
    }
    if (body.photo_url != null) {
      profile.photo_url = String(body.photo_url).trim() || null;
    }
    await saveB2cProfile(profile);
    try {
      await pushHouseholdToLinkedDesks(profile);
    } catch {
      /* desk push is best-effort */
    }
    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        family: portalFamilyView(profile.family),
      },
      message: 'Profile saved — linked gyms and clinics are up to date',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
