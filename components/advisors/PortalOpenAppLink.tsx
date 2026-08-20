'use client';

import { Smartphone } from 'lucide-react';
import { AdvisorPortalThemeToggle } from '@/components/advisors/AdvisorPortalThemeToggle';

/** Theme chips plus a one-tap return to SA Member. */
export function PortalHeaderTools({
  onLightBrand = false,
  appHref = '/me',
  appLabel = 'Open app',
  spread = false,
}: {
  onLightBrand?: boolean;
  appHref?: string;
  appLabel?: string;
  /** Theme top-right, Open app bottom-right — keeps the two tap targets apart. */
  spread?: boolean;
}) {
  const chip = onLightBrand
    ? 'border-black/15 bg-black/10 text-slate-800 hover:bg-black/15'
    : 'border-white/25 bg-white/12 text-white hover:bg-white/20';
  return (
    <div
      className={
        spread
          ? 'flex shrink-0 flex-col items-end justify-between self-stretch'
          : 'flex shrink-0 flex-col items-end gap-1.5'
      }
    >
      <AdvisorPortalThemeToggle onLightBrand={onLightBrand} />
      <a
        href={appHref}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${chip}`}
      >
        <Smartphone className="h-3.5 w-3.5" />
        {appLabel}
      </a>
    </div>
  );
}
