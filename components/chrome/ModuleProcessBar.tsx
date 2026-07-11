'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Menu } from 'lucide-react';
import {
  isStepActive,
  lifecycleForPath,
} from '@/lib/chrome/module-lifecycles';
import NotificationBell from '@/components/chrome/NotificationBell';

type Props = {
  /** Mobile sidebar open — when set, menu control sits on this same rail */
  onOpenMobileMenu?: () => void;
};

/**
 * Single sticky top rail: process steps + Action centre on one horizontal level.
 */
export default function ModuleProcessBar({ onOpenMobileMenu }: Props) {
  const pathname = usePathname() || '';
  const life = lifecycleForPath(pathname);

  let activeHref: string | null = null;
  if (life) {
    for (const step of [...life.steps].sort((a, b) => b.href.length - a.href.length)) {
      if (isStepActive(pathname, step.href, step.exact) || pathname === step.href) {
        activeHref = step.href;
        break;
      }
    }
    if (!activeHref) {
      const hub = life.steps.find((s) => pathname === s.href);
      if (hub) activeHref = hub.href;
    }
  }

  return (
    <div className="border-b border-neutral-200/90 bg-white/95 backdrop-blur-md shadow-sm">
      <div className="px-2.5 sm:px-4 md:px-6 lg:px-8 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-1.5 sm:gap-3 min-h-[48px] py-1.5">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="md:hidden p-2 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer shrink-0 text-slate-700"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          )}

          {/* Process lifecycle — same row as Action centre */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {life && life.steps.length > 0 ? (
              <>
                <span className="hidden md:inline text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400 shrink-0">
                  {life.title}
                </span>
                <div
                  className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin min-w-0 flex-1"
                  role="navigation"
                  aria-label={`${life.title} process`}
                >
                  {life.steps.map((step, i) => {
                    const active = activeHref === step.href;
                    return (
                      <div key={step.href + step.label} className="flex items-center shrink-0">
                        <Link
                          href={step.href}
                          title={step.desc || step.label}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                            active
                              ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
                              : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40 hover:text-[#0077b6]'
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-black ${
                              active
                                ? 'bg-white/20 text-white'
                                : 'bg-[#00b4d8]/10 text-[#00b4d8]'
                            }`}
                          >
                            {i + 1}
                          </span>
                          {step.label}
                        </Link>
                        {i < life.steps.length - 1 && (
                          <ChevronRight
                            className="w-3 h-3 text-neutral-300 mx-0.5 shrink-0 hidden sm:block"
                            aria-hidden
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <Link
                  href="/dashboard"
                  className="md:hidden font-black text-base tracking-[-0.5px] text-[#00b4d8] shrink-0"
                >
                  SA
                </Link>
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                  Workspace
                </span>
                <span className="text-xs font-semibold text-slate-600 truncate">
                  Command centre
                </span>
              </div>
            )}
          </div>

          {/* Action centre — same vertical level as process steps */}
          <div className="flex items-center gap-1 shrink-0 pl-1.5 sm:pl-2 border-l border-neutral-200">
            <span className="hidden lg:inline text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">
              Actions
            </span>
            <NotificationBell />
          </div>
        </div>
      </div>
    </div>
  );
}
