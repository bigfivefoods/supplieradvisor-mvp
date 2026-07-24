'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronRight, Menu, Search } from 'lucide-react';
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
 * Mobile: brand (logo + name) shown once here — not again in the drawer.
 * Responsive: process chips scroll horizontally; brand compresses on xs.
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

  const openPalette = () => {
    window.dispatchEvent(new Event('sa:open-command-palette'));
  };

  return (
    <div className="border-b border-neutral-200/90 bg-white/95 backdrop-blur-md shadow-sm">
      <div className="px-2 sm:px-4 md:px-6 lg:px-8 xl:px-10 max-w-screen-2xl 2xl:max-w-[90rem] mx-auto">
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 min-h-[48px] sm:min-h-[52px] py-1.5">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="md:hidden p-2.5 min-h-[44px] min-w-[44px] hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer shrink-0 text-slate-700 inline-flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          )}

          {/* Mobile brand — logo always; wordmark from sm */}
          <Link
            href="/dashboard"
            className="md:hidden flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0"
            aria-label="SupplierAdvisor home"
          >
            <Image
              src="/sa-logo.png"
              alt=""
              width={28}
              height={28}
              className="rounded-lg shrink-0"
              priority
            />
            <span className="hidden min-[380px]:inline font-black text-xs sm:text-sm tracking-[-0.5px] text-slate-900 truncate max-w-[7rem] sm:max-w-[10rem]">
              SupplierAdvisor®
            </span>
          </Link>

          {/* Process lifecycle — same row as Action centre */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            {life && life.steps.length > 0 ? (
              <>
                <span className="hidden lg:inline text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400 shrink-0">
                  {life.title}
                </span>
                <div
                  className="sa-scroll-x flex items-center gap-0.5 min-w-0 flex-1 mask-fade-r"
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
                          className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-full border px-2 sm:px-2.5 py-1.5 min-h-[36px] sm:min-h-[40px] text-[10px] sm:text-[11px] font-semibold transition-all whitespace-nowrap touch-manipulation ${
                            active
                              ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
                              : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40 hover:text-[#0077b6]'
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-black shrink-0 ${
                              active
                                ? 'bg-white/20 text-white'
                                : 'bg-[#00b4d8]/10 text-[#00b4d8]'
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="max-w-[5.5rem] sm:max-w-none truncate">
                            {step.label}
                          </span>
                        </Link>
                        {i < life.steps.length - 1 && (
                          <ChevronRight
                            className="w-3 h-3 text-neutral-300 mx-0.5 shrink-0 hidden md:block"
                            aria-hidden
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="hidden md:flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                  Workspace
                </span>
                <span className="text-xs font-semibold text-slate-600 truncate">
                  Command centre
                </span>
              </div>
            )}
          </div>

          {/* Action centre — search + notifications */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 pl-1 sm:pl-2 border-l border-neutral-200">
            <button
              type="button"
              onClick={openPalette}
              className="p-2 sm:p-2.5 min-h-[40px] min-w-[40px] rounded-xl hover:bg-neutral-100 text-slate-600 inline-flex items-center justify-center touch-manipulation"
              aria-label="Open command palette"
              title="Search (⌘K)"
            >
              <Search className="w-4 h-4" />
            </button>
            <span className="hidden xl:inline text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">
              Actions
            </span>
            <NotificationBell />
          </div>
        </div>
      </div>
    </div>
  );
}
