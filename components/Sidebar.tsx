'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  ArrowLeftRight,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { moveSidebarModule } from '@/lib/chrome/sidebar-order';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { SIDEBAR_MODULE_RESOURCE } from '@/lib/business/permissions';
import SystemHealthBadge from '@/components/system/SystemHealthBadge';
import { useSidebarChrome } from '@/components/chrome/SidebarContext';
import { useProgrammeRole } from '@/lib/schools/useProgrammeRole';
import { stepVisibleForRole } from '@/lib/schools/programme-role';
import { useHealthProgrammeRole } from '@/lib/health/useProgrammeRole';
import { healthStepVisibleForRole } from '@/lib/health/programme-role';
import { functionalSidebarModules } from '@/lib/chrome/functional-nav';
import { buildGuideNavSteps } from '@/lib/guide/curriculum';
import { AdvisorWordmark } from '@/components/brand/AdvisorSkinApplier';
import { PortalBrandLogo } from '@/components/brand/PortalBrandLogo';
import { useAdvisorSkin } from '@/lib/brand/useAdvisorSkin';

const EXPANDED_KEY = 'sa-sidebar-expanded-v1';

function loadExpanded(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(EXPANDED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveExpanded(state: Record<string, boolean>) {
  try {
    sessionStorage.setItem(EXPANDED_KEY, JSON.stringify(state));
  } catch {
    /* soft */
  }
}

export default function Sidebar({ forceExpanded = false }: { forceExpanded?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const skin = useAdvisorSkin();
  const { collapsed, toggle, setCollapsed } = useSidebarChrome();
  const isCollapsed = forceExpanded ? false : collapsed;
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() =>
    loadExpanded()
  );
  const {
    role,
    canViewModule,
    homePath,
    roleLabel,
    rights,
    loading,
    isCompanyModuleEnabled,
    packaging,
    businessType,
    logoUrl,
    companyName,
    selectedCompanyId,
    sidebarModuleOrder,
    saveSidebarModuleOrder,
  } = useCompanyRole();
  const [arranging, setArranging] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const programme = useProgrammeRole();
  const healthProgramme = useHealthProgrammeRole();

  const modules = useMemo(() => {
    const simplifiedSchool =
      businessType === 'school' ||
      packaging?.entityTypeId === 'school' ||
      programme.role === 'school';
    return functionalSidebarModules({
      isModuleEnabled: isCompanyModuleEnabled,
      packaging,
      simplifiedSchool,
      moduleOrder: sidebarModuleOrder,
    });
  }, [
    isCompanyModuleEnabled,
    packaging,
    businessType,
    programme.role,
    sidebarModuleOrder,
  ]);

  const visibleModules = useMemo(() => {
    // sales_contractor must only see Sales (enforced in /sales SalesShell;
    // if they ever land here, still lock nav to sales-portal only).
    if (role === 'sales_contractor') {
      return modules.filter(
        (mod) =>
          mod.id === 'sales-portal' ||
          mod.functionalId === 'customers' ||
          mod.href.startsWith('/sales')
      );
    }
    return modules
      .filter((mod) => {
        // Functional shells always allowed if present; module gates applied when building
        if (mod.id === 'multi_entity') {
          return true;
        }
        // Company profile module toggles (default all on)
        if (!isCompanyModuleEnabled(mod.id) && mod.id !== 'home') return false;
        const resource = SIDEBAR_MODULE_RESOURCE[mod.id];
        if (!resource) return true;
        if (!role) return true;
        return canViewModule(resource);
      })
      .map((mod) => {
        // Schools steps (standalone or folded under Operations)
        if (mod.id === 'schools') {
          const filtered = mod.sub.filter((s) =>
            stepVisibleForRole(
              (s as { group?: string }).group,
              programme.role
            )
          );
          return {
            ...mod,
            name:
              programme.role === 'department'
                ? 'Schools · DBE'
                : programme.role === 'sp'
                  ? 'Schools · SP'
                  : 'Schools · School',
            sub: filtered.length ? filtered : mod.sub,
          };
        }
        // Health module: DoH / Facility / SP
        if (mod.id === 'health') {
          const filtered = mod.sub.filter((s) =>
            healthStepVisibleForRole(
              (s as { group?: string }).group,
              healthProgramme.role
            )
          );
          return {
            ...mod,
            name:
              healthProgramme.role === 'department'
                ? 'Health · DoH'
                : healthProgramme.role === 'sp'
                  ? 'Health · SP'
                  : 'Health · Facility',
            sub: filtered.length ? filtered : mod.sub,
          };
        }
        // Guide: nest only chapters for modules this company has enabled
        if (mod.id === 'guide') {
          const steps = buildGuideNavSteps(isCompanyModuleEnabled);
          return {
            ...mod,
            sub: steps.map((s) => ({
              name: s.name,
              href: s.href,
              exact: Boolean(s.exact),
              section: s.section,
              desc: s.desc,
            })),
          };
        }
        return mod;
      });
  }, [
    role,
    canViewModule,
    isCompanyModuleEnabled,
    programme.role,
    healthProgramme.role,
    modules,
  ]);

  const persistOrder = async (fromId: string, toId: string) => {
    const visibleIds = visibleModules.map((m) => m.id);
    const base = visibleIds;
    const nextVisible = moveSidebarModule(base, fromId, toId);
    const hidden = sidebarModuleOrder.filter((id) => !visibleIds.includes(id));
    const next = [...nextVisible, ...hidden];
    setSavingOrder(true);
    try {
      await saveSidebarModuleOrder(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save order');
    } finally {
      setSavingOrder(false);
    }
  };

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveExpanded(next);
      return next;
    });
  };

  // Keep the module open for the current section (especially Sales on /sales/*)
  useEffect(() => {
    if (!pathname) return;
    const active = visibleModules.find((mod) => {
      if (mod.href === '/dashboard') return pathname === '/dashboard';
      if (mod.href === '/sales') {
        return pathname === '/sales' || pathname.startsWith('/sales/');
      }
      if (mod.href === '/dashboard/connections') {
        return (
          pathname.startsWith('/dashboard/connections') ||
          pathname.startsWith('/dashboard/invite-business')
        );
      }
      if (mod.href === '/dashboard/customers') {
        return (
          pathname.startsWith('/dashboard/customers') ||
          pathname.startsWith('/dashboard/settle')
        );
      }
      if (mod.href === '/dashboard/suppliers') {
        return (
          pathname.startsWith('/dashboard/suppliers') ||
          pathname.startsWith('/dashboard/escrow')
        );
      }
      return pathname === mod.href || pathname.startsWith(`${mod.href}/`);
    });
    if (!active || active.sub.length === 0) return;
    setExpandedModules((prev) => {
      if (prev[active.id]) return prev;
      const next = { ...prev, [active.id]: true };
      saveExpanded(next);
      return next;
    });
  }, [pathname, visibleModules]);

  /** Path only — nav items may carry ?query for deep-links (e.g. Messages). */
  const pathOnly = (href: string) => href.split('?')[0] || href;

  const isModuleActive = (href: string) => {
    if (!pathname) return false;
    const base = pathOnly(href);
    if (base === '/dashboard') return pathname === '/dashboard';
    if (base === '/sales') return pathname === '/sales' || pathname.startsWith('/sales/');
    if (base === '/dashboard/connections') {
      return (
        pathname === '/dashboard/connections' ||
        pathname.startsWith('/dashboard/connections/') ||
        pathname.startsWith('/dashboard/invite-business') ||
        pathname.startsWith('/dashboard/messages')
      );
    }
    if (base === '/dashboard/customers') {
      return (
        pathname === '/dashboard/customers' ||
        pathname.startsWith('/dashboard/customers/') ||
        pathname.startsWith('/dashboard/settle')
      );
    }
    if (base === '/dashboard/suppliers') {
      return (
        pathname === '/dashboard/suppliers' ||
        pathname.startsWith('/dashboard/suppliers/') ||
        pathname.startsWith('/dashboard/escrow')
      );
    }
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  const isSubActive = (href: string, exact?: boolean) => {
    if (!pathname) return false;
    const base = pathOnly(href);
    if (exact || base === '/sales' || base === '/dashboard') {
      return pathname === base;
    }
    if (pathname === base) return true;
    // Prefer longest match among siblings later; simple prefix for nested
    const parts = base.split('/').filter(Boolean);
    if (parts.length <= 2) return pathname === base;
    return pathname === base || pathname.startsWith(base + '/');
  };

  const showChromeLabels = forceExpanded || !isCollapsed;
  const chromeRow =
    'flex h-9 w-full min-w-0 items-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100';
  const chromeIconSlot =
    'inline-flex h-9 w-9 shrink-0 items-center justify-center';
  const chromeLabel = showChromeLabels
    ? 'min-w-0 truncate pr-2 text-sm font-medium'
    : 'sr-only';

  const brandAndChrome = (
    <div className="px-3 pt-4 pb-1">
      {!forceExpanded && (
        <Link
          href={skin.homeHref || homePath || '/dashboard'}
          title={companyName || skin.name}
          className="sa-brand-lockup flex h-8 min-w-0 items-center gap-2.5"
        >
          <PortalBrandLogo
            key={`${selectedCompanyId || 'none'}:${logoUrl || 'sa'}`}
            logoUrl={logoUrl}
            name={companyName || skin.registered}
            className={`h-8 shrink-0 object-contain ${
              isCollapsed ? 'w-8' : 'w-auto max-w-[5.5rem]'
            }`}
            fallbackClassName="sa-logo h-8 w-auto shrink-0 object-contain"
            priority
          />
          {!isCollapsed ? (
            <AdvisorWordmark className="sa-wordmark block min-w-0 truncate text-base font-black leading-none tracking-[-1px] sm:text-lg" />
          ) : null}
        </Link>
      )}

      {/* Same 3-row icon column open or closed — labels clip, icons do not move */}
      <div className={forceExpanded ? 'mt-0 flex flex-col' : 'mt-3 flex flex-col'}>
        <Link
          href="/dashboard/select-company"
          title="Switch company"
          className={`${chromeRow} hover:text-[var(--sa-brand)]`}
        >
          <span className={chromeIconSlot} aria-hidden>
            <ArrowLeftRight className="h-4 w-4" />
          </span>
          <span className={chromeLabel}>Switch company</span>
        </Link>
        {!forceExpanded ? (
          <button
            type="button"
            onClick={toggle}
            className={`${chromeRow} hover:text-[var(--sa-brand)]`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
          >
            <span className={chromeIconSlot} aria-hidden>
              {isCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </span>
            <span className={chromeLabel}>
              {isCollapsed ? 'Expand' : 'Collapse'}
            </span>
          </button>
        ) : null}
        <Link
          href="/me"
          title="SA Member — personal wallet"
          className={`${chromeRow} hover:text-[#0077b6]`}
        >
          <span className={chromeIconSlot} aria-hidden>
            <Smartphone className="h-4 w-4" />
          </span>
          <span className={chromeLabel}>SA Member</span>
        </Link>
      </div>

      {!forceExpanded && !isCollapsed && !loading && role ? (
        <p className="mt-3 hidden text-[10px] font-semibold uppercase tracking-wide text-neutral-400 md:block">
          {roleLabel || role}
          {rights ? ` · ${rights}` : ''}
        </p>
      ) : null}
    </div>
  );

  if (isCollapsed) {
    return (
      <div className="flex h-full flex-col bg-white">
        {brandAndChrome}
        <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto p-2 scrollbar-none">
          {visibleModules.map((mod) => {
            const Icon = mod.icon;
            const isActive = isModuleActive(mod.href);
            return (
              <Link
                key={mod.id}
                href={mod.href}
                title={mod.name}
                onClick={(e) => {
                  if (mod.sub.length === 0) return;
                  // Expanding the rail remounts this tree and eats the Link
                  // navigation — push first, then open the submenu.
                  e.preventDefault();
                  router.push(mod.href);
                  setCollapsed(false);
                  setExpandedModules((prev) => {
                    if (prev[mod.id]) return prev;
                    const next = { ...prev, [mod.id]: true };
                    saveExpanded(next);
                    return next;
                  });
                }}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${
                  isActive
                    ? 'bg-[var(--sa-brand)] text-[var(--sa-brand-ink,#fff)] shadow-sm'
                    : 'text-slate-600 hover:bg-neutral-100 hover:text-[var(--sa-brand-deep)]'
                }`}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {brandAndChrome}

      <nav className="flex-1 overflow-y-auto p-3 scrollbar-none">
        {role !== 'sales_contractor' ? (
          <div className="mb-2 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setArranging((v) => !v)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                arranging
                  ? 'bg-[var(--sa-brand)] text-[var(--sa-brand-ink,#0f172a)]'
                  : 'text-neutral-400 hover:bg-neutral-100 hover:text-slate-700'
              }`}
            >
              {arranging ? 'Done arranging' : 'Arrange sidebar'}
            </button>
            {savingOrder ? (
              <span className="text-[10px] font-bold text-neutral-400">
                Saving…
              </span>
            ) : null}
          </div>
        ) : null}
        {arranging ? (
          <p className="mb-2 px-1 text-[10px] leading-snug text-neutral-500">
            Drag modules to set your order. Saved to your profile for this
            company.
          </p>
        ) : null}
        {visibleModules.map((mod) => {
          const Icon = mod.icon;
          const isActive = isModuleActive(mod.href);
          const isExpanded = arranging ? false : expandedModules[mod.id] ?? false;

          return (
            <div
              key={mod.id}
              className="mb-1"
              draggable={arranging}
              onDragStart={(e) => {
                setDragId(mod.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', mod.id);
              }}
              onDragOver={(e) => {
                if (!arranging || !dragId || dragId === mod.id) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!arranging || !dragId || dragId === mod.id) return;
                void persistOrder(dragId, mod.id);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
            >
              <div
                className={`flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all ${
                  dragId === mod.id
                    ? 'opacity-50'
                    : isActive
                      ? 'bg-[var(--sa-brand)] text-[var(--sa-brand-ink,#fff)]'
                      : 'hover:bg-neutral-100 text-slate-800'
                } ${arranging ? 'cursor-grab' : ''}`}
              >
                {arranging ? (
                  <span className="mr-2 text-neutral-400" aria-hidden>
                    <GripVertical className="h-4 w-4" />
                  </span>
                ) : null}
                <Link
                  href={mod.href}
                  className="flex items-center gap-3 flex-1 min-w-0"
                  onClick={(e) => {
                    if (arranging) {
                      e.preventDefault();
                      return;
                    }
                    if (mod.sub.length === 0) return;
                    setExpandedModules((prev) => {
                      if (prev[mod.id]) return prev;
                      const next = { ...prev, [mod.id]: true };
                      saveExpanded(next);
                      return next;
                    });
                  }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-semibold truncate text-sm">{mod.name}</span>
                </Link>

                {mod.sub.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleModule(mod.id);
                    }}
                    className="p-1.5 -mr-1 rounded-xl hover:bg-white/20 transition-colors"
                    aria-label={`Toggle ${mod.name} submenu`}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}
              </div>

              {mod.sub.length > 0 && isExpanded && (
                <div className="ml-5 mt-0.5 space-y-0.5 pl-2">
                  {(() => {
                    // Prefer fine-grained `section` headers (e.g. Govern · Reports).
                    // Fall back to role `group` only when multiple groups remain
                    // (unusual once role-filtered).
                    const hasSections = mod.sub.some((s) =>
                      Boolean((s as { section?: string }).section)
                    );
                    const hasGroups =
                      !hasSections &&
                      mod.sub.some((s) =>
                        Boolean((s as { group?: string }).group)
                      );
                    let lastSection: string | null | undefined = undefined;
                    let lastGroup: string | null | undefined = undefined;
                    return mod.sub.map((sub, idx) => {
                      const section =
                        (sub as { section?: string }).section || null;
                      const group =
                        (sub as { group?: string }).group || null;
                      const showSection =
                        hasSections && section && section !== lastSection;
                      const showGroup =
                        hasGroups && group && group !== lastGroup;
                      if (showSection) lastSection = section;
                      if (showGroup) lastGroup = group;
                      const header = showSection
                        ? section
                        : showGroup
                          ? group === 'DBE'
                            ? 'DBE'
                            : group
                          : null;
                      return (
                        <div key={`${sub.href}-${sub.name}-${idx}`}>
                          {header ? (
                            <div className="mt-2.5 first:mt-0 mb-0.5 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                              {header}
                            </div>
                          ) : null}
                          <Link
                            href={sub.href}
                            title={(sub as { desc?: string }).desc || sub.name}
                            className={`block px-3 py-1.5 rounded-xl text-xs transition-all ${
                              isSubActive(
                                sub.href,
                                Boolean((sub as { exact?: boolean }).exact)
                              )
                                ? 'text-[var(--sa-brand-deep)] bg-[var(--sa-brand-soft)] font-semibold'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-neutral-50'
                            }`}
                          >
                            {sub.name}
                          </Link>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-neutral-100 p-3">
        <SystemHealthBadge />
        <p className="text-center text-[10px] font-medium text-neutral-400">
          Critical processes only
        </p>
      </div>
    </div>
  );
}
