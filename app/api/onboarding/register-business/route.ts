import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { requireVerifiedUser } from '@/lib/auth/api-auth';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
  addDays,
} from '@/lib/billing/company-subscription';
import {
  PROFILE_SUBSCRIPTION_COLUMNS,
  buildSubscriptionPatch,
  ensureTrialForClaimedProfile,
  insertProfileTolerant,
  trialWindow,
  updateProfileTolerant,
  writeRegistrationAfterCreate,
} from '@/lib/onboarding/profile-writes';
import {
  FOUNDING_FREE_COMPANY_LIMIT,
  isFounderLifetimeCompany,
  LIFETIME_PLAN_FOUNDER,
  LIFETIME_PLAN_FOUNDING,
} from '@/lib/billing/lifetime';
import {
  resolveReferrerFromCode,
  resolveReferrerWithRoot,
} from '@/lib/billing/supply-chain-referral';
import {
  detectSelfReferral,
  recordReferralAttribution,
} from '@/lib/billing/referral-controls';
import { isMissingRelation } from '@/lib/business/company-data';
import { registrationProfileFacts } from '@/lib/onboarding/register-profile';

/**
 * POST /api/onboarding/register-business
 * Self-serve business registration after Privy authentication.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      privyUserId,
      trading_name,
      legal_name,
      registration_number,
      industry,
      business_type,
      country,
      city,
      website,
      contact_name,
      contact_email,
      contact_phone,
      short_description,
      // Supply-chain referral: code or company id of inviting company
      referralCode,
      referredBy,
      ref,
      // Directory claim: attach ownership of existing public profile
      claimProfileId,
      claim,
      // Core OS packaging
      os_entity_type,
      legal_form,
      join_lane,
      requires_approval,
      os_sector,
      os_industry,
      os_industries,
      os_business_type_id,
      os_business_type_ids,
      industry_packs,
      industry_modules,
      industries: industriesBody,
      catalogue_industries,
      sub_industries,
      vat_number,
      province,
      continent,
      street,
      postal_code,
      primary_currency,
      payment_terms,
    } = body;

    const _auth = await requireVerifiedUser(request, { legacyPrivyUserId: privyUserId });
    if (!_auth.ok) return _auth.response;
    const userId = getCanonicalUserId(_auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'You must be signed in to register a business.' }, { status: 401 });
    }

    // ── Claim existing directory listing (no second company) ──────────────
    const claimId = Number(claimProfileId || claim || 0);
    if (Number.isFinite(claimId) && claimId > 0) {
      const supabaseClaim = getSupabaseAdmin();
      const nowClaim = new Date().toISOString();
      const { data: existing } = await supabaseClaim
        .from('profiles')
        .select('id, trading_name, user_id')
        .eq('id', claimId)
        .maybeSingle();
      if (!existing) {
        return NextResponse.json(
          { error: 'Claim listing not found' },
          { status: 404 }
        );
      }
      const { data: owners } = await supabaseClaim
        .from('business_users')
        .select('user_id, role, status')
        .eq('profile_id', claimId)
        .eq('status', 'active')
        .in('role', ['owner', 'admin'])
        .limit(5);
      const ownedByOther = (owners || []).some(
        (o) => o.user_id && String(o.user_id) !== String(userId)
      );
      if (ownedByOther) {
        return NextResponse.json(
          {
            error:
              'This listing already has an owner. Connect as a partner instead.',
            code: 'ALREADY_CLAIMED',
            profileId: claimId,
          },
          { status: 409 }
        );
      }
      const emailClaim = String(contact_email || '')
        .toLowerCase()
        .trim();
      if (!emailClaim.includes('@')) {
        return NextResponse.json(
          { error: 'Contact email is required to claim.' },
          { status: 400 }
        );
      }
      const { error: memInsErr } = await supabaseClaim
        .from('business_users')
        .insert({
          user_id: userId,
          profile_id: claimId,
          role: 'owner',
          status: 'active',
          name: contact_name || null,
          email: emailClaim,
          joined_at: nowClaim,
          created_at: nowClaim,
        });
      if (memInsErr && !/duplicate|unique/i.test(memInsErr.message || '')) {
        // promote existing membership row
        await supabaseClaim
          .from('business_users')
          .update({
            role: 'owner',
            status: 'active',
            joined_at: nowClaim,
          })
          .eq('profile_id', claimId)
          .eq('user_id', userId);
      }
      const claimPatch: Record<string, unknown> = {
        user_id: userId,
        claimed_at: nowClaim,
        supplier_status: 'active',
        is_discoverable: true,
        email: emailClaim,
        updated_at: nowClaim,
      };
      if (trading_name) claimPatch.trading_name = String(trading_name).trim();
      if (contact_name) claimPatch.contact_name = String(contact_name);
      if (contact_phone) claimPatch.contact_phone = String(contact_phone);
      if (legal_name) claimPatch.legal_name = String(legal_name);
      if (industry) claimPatch.industry = String(industry);
      if (city) claimPatch.city = String(city);
      if (country) claimPatch.country = String(country);
      if (website) claimPatch.website = String(website);
      if (short_description) claimPatch.short_description = String(short_description);
      if (registration_number)
        claimPatch.registration_number = String(registration_number);
      const claimFacts = registrationProfileFacts({
        catalogueIndustries: catalogue_industries,
        subIndustries: sub_industries,
        fallbackIndustries: industriesBody,
        vatNumber: vat_number,
        website,
        shortDescription: short_description,
        country,
        city,
        province,
        continent,
        street,
        postalCode: postal_code,
        currency: primary_currency,
        paymentTerms: payment_terms,
      });
      for (const [key, value] of Object.entries(claimFacts)) {
        if (value == null) continue;
        if (Array.isArray(value) && value.length === 0) continue;
        claimPatch[key] = value;
      }
      const claimWindow = trialWindow(nowClaim);
      const claimWrite = await updateProfileTolerant(
        supabaseClaim,
        claimId,
        claimPatch,
        { protect: [] }
      );
      const claimWarnings: string[] = [];
      if (claimWrite.dropped.length) {
        console.warn('[register-business] profile columns skipped', {
          profileId: claimId,
          columns: claimWrite.dropped,
        });
        claimWarnings.push(
          `profile_columns_skipped:${claimWrite.dropped.join(',')}`
        );
      }
      if (!claimWrite.ok) {
        console.error('[register-business] claim profile update failed', {
          profileId: claimId,
          code: claimWrite.error?.code,
          message: claimWrite.error?.message,
        });
        claimWarnings.push('claim_profile_not_updated');
      }
      const claimTrial = await ensureTrialForClaimedProfile(
        supabaseClaim,
        claimId,
        claimWindow
      );
      if (claimTrial.error) {
        console.error('[register-business] TRIAL_WRITE_FAILED', {
          profileId: claimId,
          code: claimTrial.error.code,
          message: claimTrial.error.message,
        });
        claimWarnings.push('trial_not_started');
      }

      return NextResponse.json({
        success: true,
        claimed: true,
        profileId: claimId,
        tradingName: trading_name || existing.trading_name,
        message: 'Listing claimed — you own this company workspace.',
        lifetime: null,
        trial: claimTrial.started
          ? {
              status: 'trial',
              days: COMPANY_TRIAL_DAYS,
              endsAt: claimWindow.trialEnds,
              monthlyZarAfterTrial: COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
            }
          : null,
        trialPersisted: claimTrial.started,
        warnings: claimWarnings,
      });
    }

    if (!trading_name || !String(trading_name).trim()) {
      return NextResponse.json({ error: 'Trading name is required.' }, { status: 400 });
    }

    if (!contact_email || !String(contact_email).trim()) {
      return NextResponse.json({ error: 'Contact email is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const trialEnds = addDays(nowDate, COMPANY_TRIAL_DAYS).toISOString();
    const jwtEmail =
      (_auth.emails || []).find((e) => String(e).includes('@')) || null;
    const email = String(jwtEmail || contact_email).toLowerCase().trim();
    const tradingNameTrim = String(trading_name).trim();
    const legalNameTrim = legal_name
      ? String(legal_name).trim()
      : tradingNameTrim;

    // Founder names or remaining founding-25 slots → lifetime free
    let lifetimePlan: string | null = null;
    if (
      isFounderLifetimeCompany({
        tradingName: tradingNameTrim,
        legalName: legalNameTrim,
      })
    ) {
      lifetimePlan = LIFETIME_PLAN_FOUNDER;
    } else {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      if ((count ?? 999) < FOUNDING_FREE_COMPANY_LIMIT) {
        lifetimePlan = LIFETIME_PLAN_FOUNDING;
      }
    }

    // Supply-chain referrer: explicit ref/code only (unless REFERRAL_DEFAULT_ROOT=true)
    const refRaw = String(referralCode || referredBy || ref || '').trim();
    let explicitReferrer: number | null = null;
    if (refRaw) {
      explicitReferrer = await resolveReferrerFromCode(refRaw);
    }
    const isBffRootName =
      /^big\s*five\s*foods$/i.test(tradingNameTrim) ||
      /^big\s*five\s*foods$/i.test(legalNameTrim);
    let referredByProfileId = isBffRootName
      ? null
      : resolveReferrerWithRoot(explicitReferrer);

    if (referredByProfileId) {
      const selfCheck = await detectSelfReferral({
        referrerProfileId: referredByProfileId,
        childUserId: userId,
        childEmail: email,
      });
      if (selfCheck.blocked) {
        // Strip illegal self-referral; do not fail registration
        referredByProfileId = null;
      }
    }

    const { resolveEntityKind } = await import('@/lib/entities/entity-kinds');
    // Prefer packaging entity type → business_type
    const packEntityType = os_entity_type
      ? String(os_entity_type)
      : null;
    const entityKind = resolveEntityKind(
      packEntityType || business_type || 'business'
    );
    const packIds = Array.isArray(industry_packs)
      ? industry_packs.map(String)
      : [];
    const moduleIds = Array.isArray(industry_modules)
      ? industry_modules.map(String)
      : [];

    const subscriptionPatch = buildSubscriptionPatch({
      lifetimePlan,
      now,
      trialEnds,
    });

    const facts = registrationProfileFacts({
      catalogueIndustries: catalogue_industries,
      subIndustries: sub_industries,
      fallbackIndustries: Array.isArray(industriesBody)
        ? industriesBody
        : industry
          ? [industry]
          : [],
      vatNumber: vat_number,
      website,
      shortDescription: short_description,
      country,
      city,
      province,
      continent,
      street,
      postalCode: postal_code,
      currency: primary_currency,
      paymentTerms: payment_terms,
    });
    const industriesList = facts.industries || [];

    const baseInsert: Record<string, unknown> = {
      trading_name: tradingNameTrim,
      legal_name: legalNameTrim,
      registration_number: registration_number || null,
      industry: industriesList[0] || industry || entityKind.group || null,
      industries: industriesList.length ? industriesList : null,
      sub_industries: facts.sub_industries,
      sub_industry: facts.sub_industry,
      vat_number: facts.vat_number,
      province: facts.province,
      region: facts.region,
      continent: facts.continent,
      street: facts.street,
      address: facts.address,
      postal_code: facts.postal_code,
      description: facts.description,
      primary_currency: facts.primary_currency,
      settings: facts.settings,
      business_type: entityKind.business_type,
      org_type: entityKind.org_type,
      country: facts.country,
      city: facts.city,
      website: facts.website,
      contact_name: contact_name || null,
      contact_phone: contact_phone || null,
      email,
      short_description: facts.short_description,
      supplier_status: 'active',
      relationship_type:
        entityKind.id === 'supplier'
          ? 'supplier'
          : entityKind.id === 'nsnp_isp'
            ? 'supplier'
            : entityKind.id === 'consumer'
              ? 'consumer'
              : entityKind.group === 'education' ||
                  entityKind.group === 'health' ||
                  entityKind.group === 'government'
                ? 'programme'
                : 'business',
      is_discoverable: true,
      user_id: userId,
      created_at: now,
      claimed_at: now,
      ...(referredByProfileId
        ? {
            referred_by_profile_id: referredByProfileId,
            referred_at: now,
            referral_source: refRaw ? 'ref_link' : 'default_root',
          }
        : {}),
      ...subscriptionPatch,
    };

    const detailsPatch: Record<string, unknown> = { ...baseInsert };
    delete detailsPatch.user_id;
    delete detailsPatch.created_at;
    for (const key of PROFILE_SUBSCRIPTION_COLUMNS) delete detailsPatch[key];

    let profile: { id: number; trading_name: string } | null = null;
    let createdViaRpc = false;
    let registrationWrite: Awaited<
      ReturnType<typeof writeRegistrationAfterCreate>
    > | null = null;

    const rpc = await supabase.rpc('sa_register_company_with_owner', {
      p_user_id: userId,
      p_email: email,
      p_name: contact_name ? String(contact_name) : null,
      p_profile: {
        trading_name: tradingNameTrim,
        legal_name: legalNameTrim,
        country: facts.country,
        city: facts.city,
        website: facts.website,
        contact_name: contact_name || null,
        contact_phone: contact_phone || null,
        industry: industriesList[0] || industry || entityKind.group || null,
        business_type: entityKind.business_type,
        org_type: entityKind.org_type,
        short_description: facts.short_description,
        registration_number: registration_number || null,
      },
    });

    if (!rpc.error && rpc.data && typeof rpc.data === 'object') {
      const pid = Number((rpc.data as { profile_id?: unknown }).profile_id);
      if (Number.isFinite(pid) && pid > 0) {
        createdViaRpc = true;
        profile = { id: pid, trading_name: tradingNameTrim };
        registrationWrite = await writeRegistrationAfterCreate(supabase, pid, {
          subscriptionPatch,
          detailsPatch,
        });
      }
    } else if (rpc.error && !isMissingRelation(rpc.error)) {
      console.error('Register business RPC error:', rpc.error);
      return NextResponse.json(
        {
          error: 'Failed to create company profile.',
          details: rpc.error.message,
        },
        { status: 500 }
      );
    }

    if (!profile) {
      const coreInsert: Record<string, unknown> = { ...baseInsert };
      for (const key of PROFILE_SUBSCRIPTION_COLUMNS) delete coreInsert[key];
      const inserted = await insertProfileTolerant(supabase, coreInsert, {
        protect: PROFILE_SUBSCRIPTION_COLUMNS,
      });
      if (!inserted.ok || !inserted.data?.id) {
        console.error('[register-business] profile insert failed', {
          code: inserted.error?.code,
          message: inserted.error?.message,
        });
        return NextResponse.json(
          {
            error: 'Failed to create company profile.',
            details: inserted.error?.message,
          },
          { status: 500 }
        );
      }
      profile = {
        id: Number(inserted.data.id),
        trading_name: String(inserted.data.trading_name || tradingNameTrim),
      };
      registrationWrite = await writeRegistrationAfterCreate(
        supabase,
        profile.id,
        { subscriptionPatch, detailsPatch }
      );
      if (inserted.dropped.length) {
        console.warn('[register-business] profile columns skipped', {
          profileId: profile.id,
          columns: inserted.dropped,
        });
        const already = new Set(registrationWrite.dropped);
        const mergedDropped = [
          ...inserted.dropped.filter((column) => !already.has(column)),
          ...registrationWrite.dropped,
        ];
        const warnings = registrationWrite.warnings.filter(
          (warning) => !warning.startsWith('profile_columns_skipped:')
        );
        if (mergedDropped.length) {
          warnings.unshift(`profile_columns_skipped:${mergedDropped.join(',')}`);
        }
        registrationWrite = {
          ...registrationWrite,
          dropped: mergedDropped,
          warnings,
        };
      }
    }

    // Immutable attribution log (first-touch) when referrer was set
    if (referredByProfileId && profile.id) {
      await recordReferralAttribution({
        childProfileId: Number(profile.id),
        referrerProfileId: referredByProfileId,
        source: refRaw ? 'ref_link' : 'default_root',
        actorUserId: userId,
        metadata: { registration: true, ref: refRaw || null },
      });
    }

    if (!createdViaRpc) {
      const { error: membershipError } = await supabase.from('business_users').insert({
        user_id: userId,
        profile_id: profile.id,
        role: 'owner',
        status: 'active',
        name: contact_name || null,
        email,
        joined_at: now,
        created_at: now,
      });

      if (membershipError) {
        console.error('Register business membership error:', membershipError);
        await supabase.from('profiles').delete().eq('id', profile.id).eq('user_id', userId);
        return NextResponse.json(
          {
            error: 'Failed to create company ownership.',
            details: membershipError.message,
          },
          { status: 500 }
        );
      }
    }

    // Provision school / DBE / SP domain rows + module presets + packaging
    let homePath = '/dashboard';
    let entityId = entityKind.id;
    let setupStatus: string | undefined;
    try {
      const { provisionEntityWorkspace } = await import(
        '@/lib/entities/provision'
      );
      const provisioned = await provisionEntityWorkspace(supabase, {
        profileId: Number(profile.id),
        businessType: entityKind.business_type,
        tradingName: profile.trading_name || tradingNameTrim,
        contactName: contact_name ? String(contact_name) : null,
        contactEmail: email,
        contactPhone: contact_phone ? String(contact_phone) : null,
        city: city ? String(city) : null,
        userId,
        packaging: {
          entityTypeId:
            packEntityType ||
            (entityKind.id === 'school'
              ? 'school'
              : entityKind.id === 'municipal_government'
                ? 'municipal'
                : entityKind.id === 'provincial_government'
                  ? 'provincial'
                  : entityKind.id === 'national_government'
                    ? 'national'
                    : entityKind.id === 'consumer_org'
                      ? 'npo'
                      : 'private_company'),
          sectorId: os_sector ? String(os_sector) : null,
          industryId: os_industry ? String(os_industry) : null,
          industryIds: Array.isArray(os_industries)
            ? os_industries.map(String)
            : os_industry
              ? [String(os_industry)]
              : [],
          businessTypeId: os_business_type_id
            ? String(os_business_type_id)
            : null,
          businessTypeIds: Array.isArray(os_business_type_ids)
            ? os_business_type_ids.map(String)
            : os_business_type_id
              ? [String(os_business_type_id)]
              : [],
          packIds,
          moduleIds,
        },
      });
      homePath = provisioned.homePath;
      entityId = provisioned.entity.id;
      setupStatus = provisioned.setupStatus;
    } catch (e) {
      console.warn('entity provision soft-fail', e);
    }

    const wantApproval =
      requires_approval === true ||
      String(join_lane || '').toLowerCase() === 'b2g';
    if (wantApproval) {
      setupStatus = 'pending_approval';
      homePath = '/dashboard/my-business/billing?setup=pending_approval';
      try {
        const { data: existingMeta } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', profile.id)
          .maybeSingle();
        const prev =
          existingMeta?.metadata && typeof existingMeta.metadata === 'object'
            ? (existingMeta.metadata as Record<string, unknown>)
            : {};
        await supabase
          .from('profiles')
          .update({
            metadata: {
              ...prev,
              setup_status: 'pending_approval',
              join_lane: 'b2g',
              legal_form: legal_form ? String(legal_form) : null,
              approval_required: true,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
      } catch {
        /* soft */
      }
    } else if (legal_form) {
      try {
        const { data: existingMeta } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', profile.id)
          .maybeSingle();
        const prev =
          existingMeta?.metadata && typeof existingMeta.metadata === 'object'
            ? (existingMeta.metadata as Record<string, unknown>)
            : {};
        await supabase
          .from('profiles')
          .update({
            metadata: {
              ...prev,
              legal_form: String(legal_form),
              join_lane: String(join_lane || 'b2b'),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
      } catch {
        /* soft */
      }
    }

    // Specialist contact lead for provincial / national
    if (
      setupStatus === 'contact_required' ||
      setupStatus === 'pending_approval' ||
      entityKind.id === 'provincial_government' ||
      entityKind.id === 'national_government'
    ) {
      try {
        await supabase.from('crm_leads').insert({
          source: 'onboarding_contact_required',
          company_name: tradingNameTrim,
          contact_name: contact_name || null,
          contact_email: email,
          contact_phone: contact_phone || null,
          notes: `Setup path contact_required · entity=${entityKind.id} · packs=${packIds.join(',')}`,
          status: 'new',
          profile_id: profile.id,
          created_at: now,
        });
      } catch {
        /* soft — table may not exist */
      }
    }

    // Soft ops alert — never blocks registration
    void import('@/lib/notifications/email-alerts')
      .then(({ notifyNewCompanyRegistered }) =>
        notifyNewCompanyRegistered({
          profileId: Number(profile.id),
          tradingName: profile.trading_name || tradingNameTrim,
          legalName: legalNameTrim,
          contactEmail: email,
          contactName: contact_name ? String(contact_name) : null,
          contactPhone: contact_phone ? String(contact_phone) : null,
          country: country ? String(country) : 'South Africa',
          city: city ? String(city) : null,
          industry: industry ? String(industry) : null,
          businessType: entityKind.business_type,
          website: website ? String(website) : null,
          ownerUserId: userId,
          lifetimePlan,
          trialEndsAt: lifetimePlan ? null : trialEnds,
          referralSource: referredByProfileId
            ? refRaw
              ? 'ref_link'
              : 'default_root'
            : null,
          referredByProfileId,
        })
      )
      .catch((e) => console.warn('new company notify soft-fail', e));

    const subscriptionPersisted = registrationWrite?.persisted === true;
    const trialPersisted = !lifetimePlan && subscriptionPersisted;
    const warnings = registrationWrite?.warnings ?? ['trial_not_started'];

    return NextResponse.json({
      success: true,
      profileId: profile.id,
      tradingName: profile.trading_name,
      entityKind: entityId,
      orgType: entityKind.org_type,
      homePath,
      setupStatus: setupStatus || 'active',
      packaging: {
        entityType: packEntityType,
        sector: os_sector || null,
        packs: packIds,
        modules: moduleIds,
      },
      message:
        setupStatus === 'pending_approval'
          ? 'Request received — a SupplierAdvisor admin must approve this government workspace.'
          : setupStatus === 'contact_required'
            ? 'Thanks — a specialist will contact you to complete setup.'
            : lifetimePlan && subscriptionPersisted
              ? 'Organisation registered with complimentary lifetime access.'
              : 'Organisation registered successfully.',
      trial: trialPersisted
        ? {
            status: 'trial',
            days: COMPANY_TRIAL_DAYS,
            endsAt: trialEnds,
            monthlyZarAfterTrial: COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
          }
        : null,
      trialPersisted,
      lifetime:
        lifetimePlan && subscriptionPersisted
          ? { status: 'lifetime', plan: lifetimePlan }
          : null,
      warnings,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    console.error('Register business error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
