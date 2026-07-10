'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ReactNode } from 'react';
import {
  OperatingPrinciples,
  type OperatingPrincipleItem,
} from '@/components/relationship/RelationshipChrome';

interface ModuleHubProps {
  title: string;
  titleAccent?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Three (or more) operating principles — same panel as Suppliers hub */
  principles?: readonly OperatingPrincipleItem[];
}

/**
 * Canonical light hub shell for module overview pages.
 * Process navigation lives in the sticky ModuleProcessBar only.
 */
export default function ModuleHub({
  title,
  titleAccent,
  description,
  backHref = '/dashboard',
  backLabel = 'Dashboard',
  action,
  children,
  principles,
}: ModuleHubProps) {
  return (
    <div className="sa-page">
      <div className="px-1 sm:px-2 max-w-screen-2xl mx-auto">
        {backHref && (
          <Link
            href={backHref}
            className="group inline-flex items-center gap-2 text-sm text-neutral-500 mb-4 hover:text-[#0077b6] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#00b4d8] transition-transform group-hover:-translate-x-0.5" />
            {backLabel}
          </Link>
        )}

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8 sm:mb-10">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
              Module
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-[-2px] leading-[1.1]">
              {titleAccent ? (
                <>
                  <span className="text-slate-800">{title}</span>{' '}
                  <span className="text-[#00b4d8]">{titleAccent}</span>
                </>
              ) : (
                <span className="text-[#00b4d8]">{title}</span>
              )}
            </h1>
            {description && (
              <p className="text-neutral-600 mt-3 text-sm sm:text-base max-w-2xl leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {action && <div className="flex flex-wrap gap-2 shrink-0">{action}</div>}
        </div>

        <div className="space-y-8">{children}</div>

        {principles && principles.length > 0 && (
          <OperatingPrinciples items={principles} />
        )}
      </div>
    </div>
  );
}
