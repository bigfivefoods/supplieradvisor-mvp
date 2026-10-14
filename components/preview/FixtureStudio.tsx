'use client';

import { useEffect, useState } from 'react';
import { Providers } from '@/components/Providers';
import { OnchainProviders } from '@/components/onchain/OnchainProviders';
import { bindFixtureNavigation } from '@/lib/preview/fixture-href';
import { installPreviewFetch } from '@/lib/preview/install-preview-fetch';

export function FixtureStudio({
  companyId,
  companyName,
  label,
  sampleFlag,
  onchain = false,
  children,
}: {
  companyId: number;
  companyName: string;
  label: string;
  sampleFlag?: string;
  onchain?: boolean;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    installPreviewFetch();
    try {
      localStorage.setItem('selectedCompanyId', String(companyId));
      localStorage.setItem('selectedCompanyName', companyName);
      if (sampleFlag) sessionStorage.setItem(sampleFlag, '1');
    } catch {
      /* ignore */
    }
    const stop = bindFixtureNavigation();
    setReady(true);
    return stop;
  }, [companyId, companyName, sampleFlag]);

  const banner = (
    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#0077b6]">
      SupplierAdvisor® · {label} · not saved
    </p>
  );

  if (!ready) {
    return (
      <div data-tour-stage className="sa-page min-h-screen px-4 py-6">
        {banner}
      </div>
    );
  }

  const body = onchain ? <OnchainProviders>{children}</OnchainProviders> : children;
  return (
    <Providers>
      <div data-tour-stage className="sa-page min-h-screen px-4 py-6">
        {banner}
        {body}
      </div>
    </Providers>
  );
}
