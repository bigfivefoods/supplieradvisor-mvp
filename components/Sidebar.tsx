'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  ArrowLeftRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
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
  } = useCompanyRole();
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
    });
  }, [isCompanyModuleEnabled, packaging, businessType, programme.role]);

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
        if (mod.id === 'industry_tools' || mod.id === 'multi_entity') {
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
  ]);

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

  /** Switch company + expand/collapse — always under brand (same row, expanded & collapsed) */
  const switchCompanyRow = !forceExpanded && (
    <div
      className={`flex items-center gap-1 ${
        isCollapsed ? 'mt-2 flex-col' : 'mt-4'
      }`}
    >
      <Link
        href="/dashboard/select-company"
        title="Switch company"
        className={
          isCollapsed
            ? 'flex h-11 w-11 items-center justify-center rounded-2xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-[#00b4d8]'
            : 'flex min-w-0 flex-1 items-center gap-2 rounded-xl py-1.5 text-sm text-neutral-500 transition-colors hover:text-[#00b4d8]'
        }
      >
        <ArrowLeftRight className="h-4 w-4 shrink-0" />
        {!isCollapsed && (
          <span className="truncate font-medium">Switch company</span>
        )}
      </Link>
      <button
        type="button"
        onClick={toggle}
        className={
          isCollapsed
            ? 'flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 text-neutral-500 transition-colors hover:border-[#00b4d8] hover:text-[#00b4d8]'
            : 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500 transition-colors hover:border-[#00b4d8] hover:text-[#00b4d8]'
        }
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </button>
    </div>
  );

  /** Icon-only rail (desktop collapsed) */
  if (isCollapsed) {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="flex flex-col items-center border-b border-neutral-100 p-3">
          <Link href={homePath || '/dashboard'} title="Home" className="block">
            <Image
              src="/sa-logo.png"
              alt="SupplierAdvisor"
              width={64}
              height={28}
              className="sa-logo h-8 w-auto object-contain"
              priority
            />
          </Link>
          {switchCompanyRow}
        </div>

        <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto p-2">
          {visibleModules.map((mod) => {
            const Icon = mod.icon;
            const isActive = isModuleActive(mod.href);
            return (
              <Link
                key={mod.id}
                href={mod.href}
                title={mod.name}
                onClick={() => {
                  if (mod.sub.length > 0) {
                    setCollapsed(false);
                    setExpandedModules((prev) => ({ ...prev, [mod.id]: true }));
                  }
                }}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${
                  isActive
                    ? 'bg-[#00b4d8] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-neutral-100 hover:text-[#0077b6]'
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
      {/* Brand + switch company under logo/wordmark; mobile drawer has no toggle */}
      <div
        className={`border-b border-neutral-100 ${
          forceExpanded ? 'p-4' : 'p-5'
        }`}
      >
        {!forceExpanded && (
          <Link
            href={homePath || '/dashboard'}
            className="flex min-w-0 items-center gap-2.5"
          >
            <Image
              src="/sa-logo.png"
              alt=""
              width={64}
              height={28}
              className="sa-logo h-8 w-auto shrink-0 object-contain"
              priority
            />
            <div className="sa-wordmark text-base font-black leading-none tracking-[-1px] sm:text-lg">
              SupplierAdvisor
              <span className="sa-wordmark-mark">®</span>
            </div>
          </Link>
        )}
        {forceExpanded ? (
          <Link
            href="/dashboard/select-company"
            className="mt-0 flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-[#00b4d8]"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Switch company
          </Link>
        ) : (
          switchCompanyRow
        )}
        {/* Desktop only — hides on mobile drawer to avoid bounce when role/rights load */}
        {!forceExpanded && !loading && role && (
          <p className="mt-3 hidden text-[10px] font-semibold uppercase tracking-wide text-neutral-400 md:block">
            {roleLabel || role}
            {rights ? ` · ${rights}` : ''}
          </p>
        )}
      </div>

      <nav className="flex-1 p-3 overflow-y-auto">
        {visibleModules.map((mod) => {
          const Icon = mod.icon;
          const isActive = isModuleActive(mod.href);
          const isExpanded = expandedModules[mod.id] ?? false;

          return (
            <div key={mod.id} className="mb-1">
              <div
                className={`flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all ${
                  isActive ? 'bg-[#00b4d8] text-white' : 'hover:bg-neutral-100 text-slate-800'
                }`}
              >
                <Link
                  href={mod.href}
                  className="flex items-center gap-3 flex-1 min-w-0"
                  onClick={() => {
                    // Keep submenu open when selecting a module with children
                    if (mod.sub.length > 0) {
                      setExpandedModules((prev) => {
                        const next = { ...prev, [mod.id]: true };
                        saveExpanded(next);
                        return next;
                      });
                    }
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
                <div className="ml-5 mt-0.5 space-y-0.5 border-l border-neutral-100 pl-2">
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
                                ? 'text-[#00b4d8] bg-sky-50 font-semibold'
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
