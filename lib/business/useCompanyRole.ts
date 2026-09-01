'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  canAccessPath,
  canView,
  canWrite,
  defaultHomePathForRole,
  normalizeTeamRole,
  type TeamRole,
  type PermissionResource,
} from '@/lib/business/permissions';

export type CompanyRoleState = {
  loading: boolean;
  role: TeamRole | null;
  roleLabel: string;
  rights: string;
  memberId: number | null;
  canManageTeam: boolean;
  /** True when role is loaded and company is selected */
  ready: boolean;
  canViewModule: (resource: PermissionResource) => boolean;
  canWriteModule: (resource: PermissionResource) => boolean;
  canAccessRoute: (pathname: string | null | undefined) => boolean;
  homePath: string;
  refresh: () => Promise<void>;
};

/**
 * Client hook: loads the signed-in user's role for the selected company.
 * Used by Sidebar + route guard for sales_contractor and other limited roles.
 */
export function useCompanyRole(): CompanyRoleState {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = typeof window !== 'undefined' ? getSelectedCompanyId() : null;

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<TeamRole | null>(null);
  const [roleLabel, setRoleLabel] = useState('');
  const [rights, setRights] = useState('');
  const [memberId, setMemberId] = useState<number | null>(null);
  const [canManageTeam, setCanManageTeam] = useState(false);

  const refresh = useCallback(async () => {
    if (!companyId || !privyUserId) {
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        privyUserId,
      });
      const res = await fetch(`/api/business/membership?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setRole(null);
        return;
      }
      const mem = data.membership || {};
      setRole(normalizeTeamRole(mem.role));
      setRoleLabel(String(mem.roleLabel || mem.role || ''));
      setRights(String(mem.rights || ''));
      setMemberId(mem.memberId != null ? Number(mem.memberId) : null);
      setCanManageTeam(Boolean(mem.canManageTeam));
    } catch {
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ready = !loading && (!companyId || role != null || !privyUserId);

  return {
    loading,
    role,
    roleLabel,
    rights,
    memberId,
    canManageTeam,
    ready,
    canViewModule: (resource) => (role ? canView(role, resource) : true),
    canWriteModule: (resource) => (role ? canWrite(role, resource) : true),
    canAccessRoute: (pathname) => (role ? canAccessPath(role, pathname, 'view') : true),
    homePath: defaultHomePathForRole(role),
    refresh,
  };
}
