'use client';

import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';

interface HubCardProps {
  title: string;
  description?: string;
  href: string;
  icon?: LucideIcon;
  badge?: string;
  code?: string;
}

/**
 * Light module card — Lucide icon chip, cyan hover, consistent with ModuleGrid.
 */
export default function HubCard({
  title,
  description,
  href,
  icon: Icon,
  badge,
  code,
}: HubCardProps) {
  return (
    <Link
      href={href}
      className="group relative block rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm hover:border-[#00b4d8] hover:shadow-md transition-all active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        {Icon ? (
          <div className="sa-icon-chip group-hover:border-[#00b4d8]/40 transition-colors">
            <Icon className="w-5 h-5" />
          </div>
        ) : (
          <div className="sa-icon-chip" />
        )}
        <div className="flex items-center gap-2">
          {code && (
            <span className="text-[10px] font-black tracking-widest text-neutral-400 font-mono">
              {code}
            </span>
          )}
          {badge && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00b4d8]/10 text-[#0077b6] border border-[#00b4d8]/20">
              {badge}
            </span>
          )}
          <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-[#00b4d8] group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      <h3 className="font-bold text-[15px] sm:text-base tracking-tight text-slate-800 mb-1.5 group-hover:text-[#0077b6] transition-colors">
        {title}
      </h3>
      {description && (
        <p className="text-xs sm:text-[13px] text-neutral-500 leading-relaxed">{description}</p>
      )}
      <div className="mt-3 text-xs font-semibold text-[#00b4d8] inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        Open <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </Link>
  );
}
