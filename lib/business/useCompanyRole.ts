'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  isModuleEnabled,
  normalizeEnabledModules,
  type EnabledModulesMap,
} from '@/lib/business/company-modules';

const FINANCE_CRITICAL: TeamRole[] = ['owner', 'admin', 'finance'];
const QA_OVERRIDE_ROLES: TeamRole[] = ['owner', 'admin'];
const MONEY_OR_OPS: TeamRole[] = ['owner', 'admin', 'finance', 'operations'];

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
  /** Company profile module toggles (sidebar). Default all true. */
  enabledModules: EnabledModulesMap;
  isCompanyModuleEnabled: (moduleId: string) => boolean;
  /** Period lock, hard finance close */
  canFinanceCritical: boolean;
  /** QA inspections write */
  canOpsWrite: boolean;
  /** Ship despite QA hold */
  canQaOverride: boolean;
  /** On-chain escrow attach */
  canMoneyOrOps: boolean;
  /** Accounting journals / bank allocate */
  canAccountingWrite: boolean;
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
  const [companyId, setCompanyId] = useState<number | null>(() =>
    typeof window !== 'undefined' ? getSelectedCompanyId() : null
  );

  // Stay in sync when user switches company or updates module prefs
  useEffect(() => {
    const sync = () => setCompanyId(getSelectedCompanyId());
    sync();
    window.addEventListener('sa:company-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('sa:company-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<TeamRole | null>(null);
  const [roleLabel, setRoleLabel] = useState('');
  const [rights, setRights] = useState('');
  const [memberId, setMemberId] = useState<number | null>(null);
  const [canManageTeam, setCanManageTeam] = useState(false);
  const [enabledModules, setEnabledModules] = useState<EnabledModulesMap>(() =>
    normalizeEnabledModules(null)
  );

  const refresh = useCallback(async () => {
    if (!companyId || !privyUserId) {
      setRole(null);
      setEnabledModules(normalizeEnabledModules(null));
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
      setEnabledModules(normalizeEnabledModules(data.enabledModules));
    } catch {
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-fetch when profile module toggles save (same company)
  useEffect(() => {
    const onModules = () => {
      void refresh();
    };
    window.addEventListener('sa:company-changed', onModules);
    return () => window.removeEventListener('sa:company-changed', onModules);
  }, [refresh]);

  const ready = !loading && (!companyId || role != null || !privyUserId);

  const canViewModule = useCallback(
    (resource: PermissionResource) => (role ? canView(role, resource) : true),
    [role]
  );
  const canWriteModule = useCallback(
    (resource: PermissionResource) => (role ? canWrite(role, resource) : true),
    [role]
  );
  const canAccessRoute = useCallback(
    (pathname: string | null | undefined) =>
      role ? canAccessPath(role, pathname, 'view') : true,
    [role]
  );
  const isCompanyModuleEnabled = useCallback(
    (moduleId: string) => isModuleEnabled(enabledModules, moduleId),
    [enabledModules]
  );

  const homePath = useMemo(() => defaultHomePathForRole(role), [role]);

  const canFinanceCritical = Boolean(role && FINANCE_CRITICAL.includes(role));
  const canOpsWrite = Boolean(role && canWrite(role, 'operations'));
  const canQaOverride = Boolean(role && QA_OVERRIDE_ROLES.includes(role));
  const canMoneyOrOps = Boolean(role && MONEY_OR_OPS.includes(role));
  const canAccountingWrite = Boolean(role && canWrite(role, 'accounting'));

  return {
    loading,
    role,
    roleLabel,
    rights,
    memberId,
    canManageTeam,
    ready,
    canViewModule,
    canWriteModule,
    canAccessRoute,
    enabledModules,
    isCompanyModuleEnabled,
    canFinanceCritical,
    canOpsWrite,
    canQaOverride,
    canMoneyOrOps,
    canAccountingWrite,
    homePath,
    refresh,
  };
}
