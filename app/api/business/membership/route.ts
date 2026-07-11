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
      },
      matrix,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
