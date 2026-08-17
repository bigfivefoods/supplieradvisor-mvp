import { NextRequest, NextResponse } from 'next/server';
import { getCompanyMembership } from '@/lib/business/access';
import {
  ALL_RESOURCES,
  accessLabel,
  getRolePermissions,
  resourceLabel,
  TEAM_ROLE_OPTIONS,
  canManageTeam,
  canWrite,
  canView,
  type PermissionResource,
} from '@/lib/business/permissions';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  extractEnabledModulesFromMetadata,
  listCompanyModuleOptions,
  normalizeEnabledModules,
} from '@/lib/business/company-modules';
import {
  effectiveModulesForMember,
  extractAllowedModules,
  extractSidebarModuleOrder,
  hasCustomModuleAccess,
  mergeSidebarOrderIntoPermissions,
} from '@/lib/business/member-modules';
import {
  mergeUserSidebarOrderIntoCompanyMeta,
  parseSidebarModuleOrder,
  readUserSidebarOrderFromCompanyMeta,
} from '@/lib/chrome/sidebar-order';
import {
  loadCompanyProfileChrome,
  putCompanyChrome,
} from '@/lib/business/company-data';

/**
 * GET ?companyId=&privyUserId=
 * Returns the caller's role + effective access matrix for the company.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));

    const _gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!_gate.ok) return _gate.response;
    // Trust JWT user, not client-supplied privyUserId
    const mem = await getCompanyMembership(_gate.userId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const permissions = getRolePermissions(mem.role);
    const matrix = ALL_RESOURCES.map((resource: PermissionResource) => ({
      resource,
      label: resourceLabel(resource),
      level: permissions[resource],
      levelLabel: accessLabel(permissions[resource]),
      canView: canView(mem.role, resource),
      canWrite: canWrite(mem.role, resource),
    }));

    const roleMeta = TEAM_ROLE_OPTIONS.find((r) => r.value === mem.role);

    // Slim chrome only — do not pull Advisor module blobs for sidenav.
    let companyModules = normalizeEnabledModules(null);
    let packaging: Record<string, unknown> | null = null;
    let businessType: string | null = null;
    let logoUrl: string | null = null;
    let companyName: string | null = null;
    let companyMeta: Record<string, unknown> = {};
    try {
      const profile = await loadCompanyProfileChrome(companyId);
      companyMeta = profile.chrome;
      companyModules = extractEnabledModulesFromMetadata(profile.chrome);
      businessType = profile.businessType;
      logoUrl = profile.logoUrl;
      companyName = profile.companyName;
      const { readPackagingFromMetadata } = await import(
        '@/lib/product/architecture'
      );
      packaging = readPackagingFromMetadata(profile.chrome) as unknown as Record<
        string,
        unknown
      > | null;
    } catch {
      /* soft — fail open all modules */
    }

    // What this user sees after login = company modules ∩ optional per-user allow-list
    const allowedModules = extractAllowedModules(mem.permissions);
    const enabledModules = effectiveModulesForMember({
      companyEnabled: companyModules,
      permissions: mem.permissions,
      role: mem.role,
    });
    const fromMember = extractSidebarModuleOrder(mem.permissions);
    const fromProfile = readUserSidebarOrderFromCompanyMeta(
      companyMeta,
      mem.userId
    );
    const sidebarModuleOrder = fromMember.length ? fromMember : fromProfile;

    return NextResponse.json({
      success: true,
      companyId,
      membership: {
        memberId: mem.memberId,
        userId: mem.userId,
        role: mem.role,
        roleLabel: roleMeta?.label || mem.role,
        rights: roleMeta?.rights || '',
        description: roleMeta?.description || '',
        status: mem.status,
        name: mem.name,
        email: mem.email,
        canManageTeam: canManageTeam(mem.role),
        canWriteProfile: canWrite(mem.role, 'profile'),
        canWriteSettings: canWrite(mem.role, 'settings'),
        canWriteDocuments: canWrite(mem.role, 'documents'),
        customModuleAccess: hasCustomModuleAccess(mem.permissions),
        allowedModules,
      },
      matrix,
      /** Effective modules for this user (sidebar + gates) */
      enabledModules,
      /** Company-wide toggles set by owner (Company → Modules) */
      companyModules,
      packaging,
      businessType,
      logoUrl,
      companyName,
      moduleOptions: listCompanyModuleOptions(),
      sidebarModuleOrder,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH { companyId, sidebarModuleOrder }
 * Save this user's sidenav order onto the company profile and their membership.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;
    const mem = await getCompanyMembership(gate.userId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    const order = parseSidebarModuleOrder(body.sidebarModuleOrder);
    const supabase = getSupabaseServer();
    const nextPerms = mergeSidebarOrderIntoPermissions(mem.permissions, order);
    const { error: memErr } = await supabase
      .from('business_users')
      .update({
        permissions: nextPerms,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mem.memberId)
      .eq('profile_id', companyId);
    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }

    const chrome = await loadCompanyProfileChrome(companyId);
    const nextChrome = mergeUserSidebarOrderIntoCompanyMeta(
      chrome.chrome,
      mem.userId,
      order
    );
    await putCompanyChrome(companyId, {
      user_sidebar_orders: nextChrome.user_sidebar_orders,
    });

    return NextResponse.json({
      success: true,
      sidebarModuleOrder: order,
      message: 'Sidebar order saved',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
