'use client';

import { useState } from 'react';
import { SaMonogram } from '@/components/brand/SaMonogram';

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
  const src = logoUrl && String(logoUrl).trim() && !broken ? String(logoUrl).trim() : null;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || 'Company'}
        className={className}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <SaMonogram
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
}: {
  logoUrl?: string | null;
  brand: string;
  eyebrow: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-white p-1">
          <PortalBrandLogo
            logoUrl={logoUrl}
            name={brand}
            className="h-full w-full object-contain"
          />
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
          {eyebrow}
        </p>
        <h1 className="text-xl font-black mt-1 truncate">{brand}</h1>
      </div>
    </div>
  );
}
