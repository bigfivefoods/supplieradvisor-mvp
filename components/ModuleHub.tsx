'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ReactNode } from 'react';
import {
  CommandWorkbenchBand,
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
  principles?: readonly OperatingPrincipleItem[];
  heroPill?: string;
  heroTitle?: string;
}

/**
 * Command-hub shell for module overview pages.
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
  heroPill,
  heroTitle,
}: ModuleHubProps) {
  return (
    <div className="sa-page">
      <div className="mx-auto max-w-screen-2xl px-1 sm:px-2">
        {backHref && (
          <Link
            href={backHref}
            className="group mb-4 inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-[#0077b6]"
          >
            <ArrowLeft className="h-4 w-4 text-[#00b4d8] transition-transform group-hover:-translate-x-0.5" />
            {backLabel}
          </Link>
        )}

        <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400 sm:text-xs">
              Module command
            </p>
            <h1 className="text-3xl font-black leading-[1.1] tracking-tight text-slate-900 sm:text-4xl lg:text-5xl lg:tracking-[-2px]">
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
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                {description}
              </p>
            )}
          </div>
          {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
        </div>

        <CommandWorkbenchBand
          pill={heroPill || 'Live module · command surface'}
          title={heroTitle || `${title} workbenches`}
          description={
            description ||
            'Open a workbench below — process steps stay in the sticky navbar rail.'
          }
        />

        <div className="space-y-8">{children}</div>

        {principles && principles.length > 0 && <OperatingPrinciples items={principles} />}
      </div>
    </div>
  );
}
