'use client';

import { useEffect } from 'react';

/**
 * Pricing lives on the main site homepage (#pricing / #referral / #tiers).
 * Keep /pricing as a soft entry that lands on the same-page section.
 */
export default function PricingRedirect() {
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const target =
      hash === '#referral' || hash === '#tiers' ? hash : '#pricing';
    window.location.replace(`/${target}`);
  }, []);

  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-[#f8fafc] text-slate-600 text-sm">
      Taking you to pricing on the home page…
    </div>
  );
}
