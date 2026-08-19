'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  resolveVisibleModules,
  type EnabledModulesMap,
} from '@/lib/business/company-modules';
import { advisorLandingPath } from '@/lib/brand/advisor-skins';
import type { PackagingSelection } from '@/lib/product/architecture';
import {
  fetchCompanyMembership,
  invalidateCompanyMembership,
} from '@/lib/client/company-membership';

/** Who may open Finance / period-lock critical UI — owner + finance only */
const FINANCE_CRITICAL: TeamRole[] = ['owner', 'finance'];
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
  /** Core OS packaging (entity, sector, packs) */
  packaging: PackagingSelection | null;
  businessType: string | null;
  /** Selected company id from local storage (null before pick) */
  selectedCompanyId: number | null;
  logoUrl: string | null;
  companyName: string | null;
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
  /** This user's sidenav module order for the selected company */
  sidebarModuleOrder: string[];
  saveSidebarModuleOrder: (order: string[]) => Promise<void>;
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

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<TeamRole | null>(null);
  const [roleLabel, setRoleLabel] = useState('');
  const [rights, setRights] = useState('');
  const [memberId, setMemberId] = useState<number | null>(null);
  const [canManageTeam, setCanManageTeam] = useState(false);
  const [enabledModules, setEnabledModules] = useState<EnabledModulesMap>(() =>
    normalizeEnabledModules(null)
  );
  const [packaging, setPackaging] = useState<PackagingSelection | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [sidebarModuleOrder, setSidebarModuleOrder] = useState<string[]>([]);
  const fetchGen = useRef(0);

  const clearCompanyChrome = useCallback(() => {
    setRole(null);
    setEnabledModules(normalizeEnabledModules(null));
    setPackaging(null);
    setBusinessType(null);
    setLogoUrl(null);
    setCompanyName(null);
    setSidebarModuleOrder([]);
  }, []);

  const refresh = useCallback(async (force = false) => {
    const selectedId = getSelectedCompanyId();
    if (!selectedId || !privyUserId) {
      fetchGen.current += 1;
      clearCompanyChrome();
      setLoading(false);
      return;
    }
    const gen = ++fetchGen.current;
    setLoading(true);
    try {
      const data = await fetchCompanyMembership(selectedId, privyUserId, {
        force,
      });
      if (gen !== fetchGen.current) return;
      if (getSelectedCompanyId() !== selectedId) return;
      const payloadCompany = Number(
        (data as { companyId?: unknown }).companyId
      );
      if (Number.isFinite(payloadCompany) && payloadCompany !== selectedId) {
        return;
      }
      const mem = data.membership || {};
      setRole(normalizeTeamRole(mem.role));
      setRoleLabel(String(mem.roleLabel || mem.role || ''));
      setRights(String(mem.rights || ''));
      setMemberId(mem.memberId != null ? Number(mem.memberId) : null);
      setCanManageTeam(Boolean(mem.canManageTeam));
      const packagingNext =
        data.packaging && typeof data.packaging === 'object'
          ? (data.packaging as PackagingSelection)
          : null;
      setEnabledModules(
        resolveVisibleModules({
          stored: data.enabledModules,
          packaging: packagingNext,
          companyId: selectedId,
          companyName: data.companyName != null ? String(data.companyName) : null,
        })
      );
      setPackaging(packagingNext);
      setBusinessType(
        data.businessType != null ? String(data.businessType) : null
      );
      setLogoUrl(data.logoUrl ? String(data.logoUrl) : null);
      setCompanyName(data.companyName ? String(data.companyName) : null);
      setSidebarModuleOrder(
        Array.isArray(data.sidebarModuleOrder)
          ? data.sidebarModuleOrder.map(String)
          : []
      );
    } catch {
      if (gen !== fetchGen.current) return;
      setRole(null);
    } finally {
      if (gen === fetchGen.current) setLoading(false);
    }
  }, [privyUserId, clearCompanyChrome]);

  useEffect(() => {
    void refresh();
  }, [companyId, refresh]);

  useEffect(() => {
    const onCompanyEvent = () => {
      const id = getSelectedCompanyId();
      const switched = id !== companyId;
      if (switched) {
        fetchGen.current += 1;
        setLogoUrl(null);
        setCompanyName(null);
      }
      setCompanyId(id);
      if (id && privyUserId) invalidateCompanyMembership(id, privyUserId);
      if (!switched) void refresh(true);
    };
    window.addEventListener('sa:company-changed', onCompanyEvent);
    window.addEventListener('storage', onCompanyEvent);
    return () => {
      window.removeEventListener('sa:company-changed', onCompanyEvent);
      window.removeEventListener('storage', onCompanyEvent);
    };
  }, [companyId, privyUserId, refresh]);

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

  const homePath = useMemo(() => {
    if (role === 'sales_contractor') return '/sales';
    if (role === 'finance') return '/dashboard/accounting';
    return (
      advisorLandingPath({
        enabledModules,
        packIds: packaging?.packIds,
        sidebarOrder: sidebarModuleOrder,
      }) || defaultHomePathForRole(role)
    );
  }, [role, enabledModules, packaging?.packIds, sidebarModuleOrder]);

  const saveSidebarModuleOrder = useCallback(
    async (order: string[]) => {
      if (!companyId || !privyUserId) return;
      setSidebarModuleOrder(order);
      const res = await fetch('/api/business/membership', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          privyUserId,
          sidebarModuleOrder: order,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not save sidebar order');
      }
      if (Array.isArray(data.sidebarModuleOrder)) {
        setSidebarModuleOrder(data.sidebarModuleOrder.map(String));
      }
      invalidateCompanyMembership(companyId, privyUserId);
    },
    [companyId, privyUserId]
  );

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
    packaging,
    businessType,
    selectedCompanyId: companyId,
    logoUrl,
    companyName,
    canFinanceCritical,
    canOpsWrite,
    canQaOverride,
    canMoneyOrOps,
    canAccountingWrite,
    homePath,
    sidebarModuleOrder,
    saveSidebarModuleOrder,
    refresh,
  };
}
