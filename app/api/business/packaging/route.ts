import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  INDUSTRY_PACKS,
  packagingFromSelection,
  packagingMetadataBlob,
  enabledModulesMapFromPacks,
  monthlyPriceZar,
  readPackagingFromMetadata,
  getIndustryPack,
  CORE_OS_MONTHLY_ZAR,
  INDUSTRY_PACK_MONTHLY_ZAR,
} from '@/lib/product/architecture';
import {
  extractEnabledModulesFromMetadata,
  mergeEnabledModulesIntoMetadata,
} from '@/lib/business/company-modules';
import { MODULE_NAV } from '@/lib/chrome/module-nav';

export const runtime = 'nodejs';

/**
 * GET  /api/business/packaging?companyId=
 * PATCH /api/business/packaging
 *   { companyId, packIds?, moduleIds?, sectorId?, industryId?, businessTypeId?, entityTypeId? }
 *
 * In-app Industry Pack management (Phase 3). Adds modules; never deletes MODULE_NAV steps.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, trading_name, business_type, metadata')
      .eq('id', companyId)
      .maybeSingle();
    if (!prof) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    const meta =
      prof.metadata && typeof prof.metadata === 'object'
        ? (prof.metadata as Record<string, unknown>)
        : {};
    const packaging = readPackagingFromMetadata(meta);
    const price = monthlyPriceZar(packaging?.packIds || []);

    return NextResponse.json({
      success: true,
      companyId,
      tradingName: prof.trading_name,
      businessType: prof.business_type,
      packaging,
      pricing: {
        coreMonthlyZar: CORE_OS_MONTHLY_ZAR,
        packMonthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
        ...price,
      },
      catalogue: INDUSTRY_PACKS.map((p) => ({
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        description: p.description,
        monthlyZar: p.monthlyZar,
        priority: p.priority,
        moduleCount: p.modules.length,
        active: Boolean(packaging?.packIds?.includes(p.id)),
      })),
      enabledModules: extractEnabledModulesFromMetadata(meta),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    // Only owner/admin may change packs
    {
      const { data: mem } = await supabase
        .from('business_users')
        .select('role')
        .eq('profile_id', companyId)
        .eq('user_id', gate.userId)
        .eq('status', 'active')
        .maybeSingle();
      const r = String(mem?.role || '').toLowerCase();
      if (r && !['owner', 'admin'].includes(r)) {
        return NextResponse.json(
          { error: 'Only owners and admins can change Industry Packs' },
          { status: 403 }
        );
      }
    }
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, business_type, metadata')
      .eq('id', companyId)
      .maybeSingle();
    if (!prof) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const meta =
      prof.metadata && typeof prof.metadata === 'object'
        ? { ...(prof.metadata as Record<string, unknown>) }
        : {};
    const current = readPackagingFromMetadata(meta);

    const packIdsRaw = Array.isArray(body.packIds)
      ? body.packIds.map(String)
      : current?.packIds || [];
    // Validate pack ids (mutable so industry suggest can add)
    const packIds = packIdsRaw.filter((id: string) =>
      Boolean(getIndustryPack(id))
    );
    const moduleIds = Array.isArray(body.moduleIds)
      ? body.moduleIds.map(String)
      : current?.moduleIds || [];
    const sectorId =
      body.sectorId != null
        ? String(body.sectorId)
        : current?.sectorId || 'secondary';

    // Multi-industry: industryIds[] preferred; industryId still accepted
    let industryIds: string[] = [];
    if (body.industryIds !== undefined) {
      industryIds = Array.isArray(body.industryIds)
        ? body.industryIds.map(String).filter(Boolean)
        : [];
    } else if (body.industryId !== undefined) {
      industryIds = body.industryId != null ? [String(body.industryId)] : [];
    } else {
      industryIds = [
        ...(current?.industryIds || []),
        ...(current?.industryId ? [String(current.industryId)] : []),
      ];
    }
    industryIds = [...new Set(industryIds)];

    let businessTypeIds: string[] = [];
    if (body.businessTypeIds !== undefined) {
      businessTypeIds = Array.isArray(body.businessTypeIds)
        ? body.businessTypeIds.map(String).filter(Boolean)
        : [];
    } else if (body.businessTypeId !== undefined) {
      businessTypeIds =
        body.businessTypeId != null ? [String(body.businessTypeId)] : [];
    } else {
      businessTypeIds = [
        ...(current?.businessTypeIds || []),
        ...(current?.businessTypeId ? [String(current.businessTypeId)] : []),
      ];
    }
    businessTypeIds = [...new Set(businessTypeIds)];

    let entityTypeId =
      body.entityTypeId != null
        ? String(body.entityTypeId)
        : current?.entityTypeId || 'private_company';
    const industryLabels: string[] = [];
    let profileBusinessType: string | null = null;
    try {
      const { getIndustry, getBusinessType } = await import(
        '@/lib/product/business-catalogue'
      );
      for (const iid of industryIds) {
        const ind = getIndustry(iid);
        if (ind?.label) industryLabels.push(ind.label);
        if (
          body.suggestIndustryPacks === true &&
          ind?.packIds?.length
        ) {
          for (const pid of ind.packIds) {
            if (!packIds.includes(pid) && getIndustryPack(pid)) {
              packIds.push(pid);
            }
          }
        }
      }
      // Resolve entity from first matching business type
      for (const btid of businessTypeIds) {
        for (const iid of industryIds) {
          const bt = getBusinessType(iid, btid);
          if (bt) {
            entityTypeId = bt.entityTypeId;
            profileBusinessType = bt.profileBusinessType;
            break;
          }
        }
        if (profileBusinessType) break;
      }
    } catch {
      /* soft */
    }

    // Contact-gated orgs cannot self-activate full packs changes? Allow pack selection still
    const selection = packagingFromSelection({
      entityTypeId,
      sectorId,
      industryIds,
      industryId: industryIds[0] || null,
      businessTypeIds,
      businessTypeId: businessTypeIds[0] || null,
      packIds,
      moduleIds,
    });
    // Preserve contact_required setup status if already set
    if (
      current?.setupStatus === 'contact_required' ||
      current?.setupStatus === 'pending_specialist'
    ) {
      selection.setupStatus = current.setupStatus;
      selection.setupPath = 'contact_required';
    }

    const packBlob = packagingMetadataBlob(selection);
    Object.assign(meta, packBlob);

    // Merge pack unlocks onto existing enabled modules (never strip unknown keys badly)
    const existingEnabled = extractEnabledModulesFromMetadata(meta);
    const baseEnable = Object.entries(existingEnabled)
      .filter(([, on]) => on)
      .map(([id]) => id);
    // Also keep all currently true modules when only adding packs
    const fromPacks = enabledModulesMapFromPacks(
      selection.packIds,
      selection.moduleIds,
      MODULE_NAV.map((m) => m.id),
      { basePresetEnable: baseEnable }
    );
    // Union: if pack enables, turn on; if pack removed, keep previously on modules
    // so we never silently remove Make/Containers when user had them
    for (const id of MODULE_NAV.map((m) => m.id)) {
      if (fromPacks[id]) existingEnabled[id] = true;
      // Only turn off pack-only modules when explicitly requested
      if (body.strictDisable === true && !fromPacks[id] && !['home', 'my-business', 'guide'].includes(id)) {
        // keep user's existing if they had it before pack management
        if (baseEnable.includes(id) && !body.packIds) {
          /* keep */
        }
      }
    }
    // Apply pack map as additive
    const merged = { ...existingEnabled };
    for (const [id, on] of Object.entries(fromPacks)) {
      if (on) merged[id] = true;
    }
    const nextMeta = mergeEnabledModulesIntoMetadata(meta, merged);

    // Keep company Identity profile in sync (visible on /my-business/profile)
    const profilePatch: Record<string, unknown> = {
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    };
    if (industryLabels.length) {
      profilePatch.industries = industryLabels;
      profilePatch.industry = industryLabels[0];
    }
    if (profileBusinessType) profilePatch.business_type = profileBusinessType;
    // Surface sector on profile row when column exists; always in metadata via packBlob
    if (sectorId) {
      profilePatch.sector = sectorId;
    }

    let { error } = await supabase
      .from('profiles')
      .update(profilePatch)
      .eq('id', companyId);

    // Retry without sector column if schema lacks it
    if (error && /sector|column/i.test(String(error.message || ''))) {
      delete profilePatch.sector;
      const retry = await supabase
        .from('profiles')
        .update(profilePatch)
        .eq('id', companyId);
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const price = monthlyPriceZar(selection.packIds);
    return NextResponse.json({
      success: true,
      packaging: selection,
      pricing: {
        coreMonthlyZar: CORE_OS_MONTHLY_ZAR,
        packMonthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
        ...price,
      },
      message: `Packaging saved · ${selection.packIds.length} pack(s) · est. R${price.total}/mo`,
      note: 'Full module feature trees stay available under each sidebar hub. Packs add Industry Tools shortcuts.',
    });
  } catch (e: unknown) {
    console.error('[packaging PATCH]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
