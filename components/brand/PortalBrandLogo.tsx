'use client';

import { useEffect, useState } from 'react';
import { SaOfficialLogo } from '@/components/brand/SaOfficialLogo';

/**
 * Portal mark: company logo when set, otherwise the SupplierAdvisor logo.
 */
export function PortalBrandLogo({
  logoUrl,
  name,
  className = 'h-8 w-auto max-w-[8rem] object-contain',
  fallbackClassName,
}: {
  logoUrl?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
  priority?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const raw = logoUrl && String(logoUrl).trim() ? String(logoUrl).trim() : '';
  useEffect(() => {
    setBroken(false);
  }, [raw]);
  const src = raw && !broken ? raw : null;

  if (src) {
    const companyClass = className
      .split(/\s+/)
      .filter((c) => c && c !== 'sa-logo')
      .join(' ');
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || 'Company'}
        className={companyClass}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <SaOfficialLogo
      title={name || 'SupplierAdvisor'}
      className={fallbackClassName || className}
    />
  );
}

/** Member / patient portal header lockup */
export function MemberPortalBrandLockup({
  logoUrl,
  brand,
  eyebrow,
  onLightFill = false,
}: {
  logoUrl?: string | null;
  brand: string;
  eyebrow: string;
  /** Navy type on a pale brand fill (TradeAdvisor® cyan). */
  onLightFill?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white p-1 ${
            onLightFill ? 'border-slate-900/10' : 'border-white/30'
          }`}
        >
          <PortalBrandLogo
            logoUrl={logoUrl}
            name={brand}
            className="h-full w-full object-contain"
          />
        </div>
      ) : null}
      <div className="min-w-0">
        <p
          className={`text-[10px] font-bold uppercase tracking-widest ${
            onLightFill ? 'text-[#0f172a]/70' : 'text-white/80'
          }`}
        >
          {eyebrow}
        </p>
        <h1
          className={`mt-1 truncate text-xl font-black md:text-3xl ${
            onLightFill ? 'text-[#0f172a]' : ''
          }`}
        >
          {brand}
        </h1>
      </div>
    </div>
  );
}
