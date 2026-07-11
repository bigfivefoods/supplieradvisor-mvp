'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import {
  isStepActive,
  lifecycleForPath,
} from '@/lib/chrome/module-lifecycles';

/**
 * Sticky top process rail for the active module — always visible while working.
 */
export default function ModuleProcessBar() {
  const pathname = usePathname() || '';
  const life = lifecycleForPath(pathname);

  if (!life || life.steps.length === 0) return null;

  // Prefer most specific matching step; honour exact flag on Command hubs
  let activeHref: string | null = null;
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

  return (
    <div className="border-b border-cyan-100/80 shadow-sm">
      <div className="px-3 sm:px-4 md:px-6 lg:px-8 max-w-screen-2xl mx-auto py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:inline text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400 shrink-0 pr-1">
            {life.title}
          </span>
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin min-w-0 flex-1 pb-0.5">
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
                        active ? 'bg-white/20 text-white' : 'bg-[#00b4d8]/10 text-[#00b4d8]'
                      }`}
                    >
                      {i + 1}
                    </span>
                    {step.label}
                  </Link>
                  {i < life.steps.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-neutral-300 mx-0.5 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
