'use client';

import { useEffect } from 'react';
import { applyAdvisorSkinToDocument } from '@/lib/brand/advisor-skins';
import { useAdvisorSkin } from '@/lib/brand/useAdvisorSkin';

/**
 * Paints CSS brand tokens + html[data-advisor] when the user is in an Advisor.
 * Mount inside dashboard chrome only (not marketing).
 */
export function AdvisorSkinApplier() {
  const skin = useAdvisorSkin();

  useEffect(() => {
    applyAdvisorSkinToDocument(skin);
    return () => {
      applyAdvisorSkinToDocument({
        id: 'supplier',
        name: 'SupplierAdvisor',
        registered: 'SupplierAdvisor®',
        shortName: 'SA',
        tagline: 'Supply-chain operating system',
        homeHref: '/dashboard',
        prefixes: [],
        moduleIds: [],
        packIds: [],
        brand: '#00b4d8',
        brandDeep: '#0077b6',
      });
    };
  }, [skin]);

  return null;
}

/** Wordmark used in sidebar / rails — switches with Advisor skin. */
export function AdvisorWordmark({
  className = '',
  markClassName = '',
}: {
  className?: string;
  markClassName?: string;
}) {
  const skin = useAdvisorSkin();
  return (
    <span className={className}>
      {skin.name}
      <span className={markClassName || 'sa-wordmark-mark'}>®</span>
    </span>
  );
}
