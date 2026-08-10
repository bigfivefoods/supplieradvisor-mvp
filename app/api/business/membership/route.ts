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
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  extractEnabledModulesFromMetadata,
  listCompanyModuleOptions,
  normalizeEnabledModules,
} from '@/lib/business/company-modules';
import {
  effectiveModulesForMember,
  extractAllowedModules,
  hasCustomModuleAccess,
} from '@/lib/business/member-modules';

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

    // Company module enablement (sidebar) — default all selected
    let companyModules = normalizeEnabledModules(null);
    let packaging: Record<string, unknown> | null = null;
    let businessType: string | null = null;
    try {
      const supabase = getSupabaseServer();
      const { data: prof } = await supabase
        .from('profiles')
        .select('metadata, business_type')
        .eq('id', companyId)
        .maybeSingle();
      companyModules = extractEnabledModulesFromMetadata(prof?.metadata);
      businessType =
        prof?.business_type != null ? String(prof.business_type) : null;
      const meta =
        prof?.metadata && typeof prof.metadata === 'object'
          ? (prof.metadata as Record<string, unknown>)
          : null;
      if (meta) {
        const { readPackagingFromMetadata } = await import(
          '@/lib/product/architecture'
        );
        packaging = readPackagingFromMetadata(meta) as unknown as Record<
          string,
          unknown
        > | null;
      }
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

    return NextResponse.json({
      success: true,
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
      moduleOptions: listCompanyModuleOptions(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
