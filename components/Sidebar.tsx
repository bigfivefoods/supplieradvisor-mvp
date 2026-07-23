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
import { sidebarModulesFromNav } from '@/lib/chrome/module-nav';

/** Critical-process nav only — icons unique per module (see lib/chrome/module-nav.ts). */
const modules = sidebarModulesFromNav();

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
  const { role, canViewModule, homePath, roleLabel, rights, loading } = useCompanyRole();

  const visibleModules = useMemo(() => {
    // sales_contractor must only see Sales (enforced in /sales SalesShell;
    // if they ever land here, still lock nav to sales-portal only).
    if (role === 'sales_contractor') {
      return modules.filter((mod) => mod.id === 'sales-portal');
    }
    return modules.filter((mod) => {
      const resource = SIDEBAR_MODULE_RESOURCE[mod.id];
      if (!resource) return true;
      if (!role) return true;
      return canViewModule(resource);
    });
  }, [role, canViewModule]);

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

  const isModuleActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/sales') return pathname === '/sales' || pathname.startsWith('/sales/');
    if (href === '/dashboard/connections') {
      return (
        pathname === '/dashboard/connections' ||
        pathname.startsWith('/dashboard/connections/') ||
        pathname.startsWith('/dashboard/invite-business')
      );
    }
    if (href === '/dashboard/customers') {
      return (
        pathname === '/dashboard/customers' ||
        pathname.startsWith('/dashboard/customers/') ||
        pathname.startsWith('/dashboard/settle')
      );
    }
    if (href === '/dashboard/suppliers') {
      return (
        pathname === '/dashboard/suppliers' ||
        pathname.startsWith('/dashboard/suppliers/') ||
        pathname.startsWith('/dashboard/escrow')
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isSubActive = (href: string, exact?: boolean) => {
    if (!pathname) return false;
    if (exact || href === '/sales' || href === '/dashboard') {
      return pathname === href;
    }
    if (pathname === href) return true;
    // Prefer longest match among siblings later; simple prefix for nested
    const parts = href.split('/').filter(Boolean);
    if (parts.length <= 2) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  /** Icon-only rail (desktop collapsed) */
  if (isCollapsed) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-3 border-b border-neutral-100 flex flex-col items-center gap-2">
          <Link href={homePath || '/dashboard'} title="Home" className="block">
            <Image
              src="/sa-logo.png"
              alt="SupplierAdvisor"
              width={36}
              height={36}
              className="rounded-xl"
              priority
            />
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:border-[#00b4d8] hover:text-[#00b4d8] transition-colors"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto flex flex-col items-center gap-1">
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
                className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all ${
                  isActive
                    ? 'bg-[#00b4d8] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-neutral-100 hover:text-[#0077b6]'
                }`}
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-neutral-100 flex flex-col items-center gap-2">
          <Link
            href="/dashboard/select-company"
            title="Switch company"
            className="w-11 h-11 flex items-center justify-center rounded-2xl text-neutral-500 hover:bg-neutral-100 hover:text-[#00b4d8]"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-5 border-b border-neutral-100">
        <div className="flex items-start justify-between gap-2">
          <Link href={homePath || '/dashboard'} className="flex items-center gap-3 min-w-0">
            <Image
              src="/sa-logo.png"
              alt="SupplierAdvisor"
              width={40}
              height={40}
              className="rounded-xl shrink-0"
              priority
            />
            <div className="font-black text-lg tracking-[-1px] leading-none text-slate-900 truncate">
              SupplierAdvisor®
            </div>
          </Link>
          {!forceExpanded && (
            <button
              type="button"
              onClick={toggle}
              className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:border-[#00b4d8] hover:text-[#00b4d8] shrink-0"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
        <Link
          href="/dashboard/select-company"
          className="mt-4 flex items-center gap-2 text-sm text-neutral-500 hover:text-[#00b4d8] transition-colors"
        >
          <ArrowLeftRight className="w-4 h-4" />
          Switch company
        </Link>
        {!loading && role && (
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
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
                  {mod.sub.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      className={`block px-3 py-2 rounded-xl text-xs transition-all ${
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
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-neutral-100 space-y-2">
        <SystemHealthBadge />
        <p className="text-[10px] text-center text-neutral-400 font-medium">
          Critical processes only
        </p>
      </div>
    </div>
  );
}
