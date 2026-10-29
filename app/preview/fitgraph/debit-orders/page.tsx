'use client';

import GymDebitFlow from '@/components/fitness/netcash/GymDebitFlow';
import { MandateDesk, ModeBanner } from '@/components/fitness/netcash/Desks';
import { PreviewFrame } from '@/components/fitness/netcash/PreviewFrame';
import { sampleMandates, sampleSettings } from '@/lib/fitness/netcash/fixtures';

export default function PreviewMandatesPage() {
  return (
    <PreviewFrame screen="debit-orders">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">GymAdvisor®</p>
      <h1 className="text-3xl font-black tracking-tight text-[#0f172a] sm:text-4xl">Debit orders <span className="text-[#00b4d8]">mandates</span></h1>
      <p className="mt-2 mb-5 max-w-3xl text-sm text-slate-600">Signed consent, masked accounts, and masterfile status. SupplierAdvisor® never shows the full account number here.</p>
      <GymDebitFlow linkFor={(href) => (href.endsWith('/debit-orders') ? '/preview/fitgraph/debit-orders' : href.endsWith('/netcash') ? '/preview/fitgraph/netcash' : href.endsWith('/billing-runs') ? '/preview/fitgraph/billing-runs' : '/preview/fitgraph/collections')} />
      <ModeBanner mode={sampleSettings.mode} />
      <MandateDesk mandates={sampleMandates} />
    </PreviewFrame>
  );
}
