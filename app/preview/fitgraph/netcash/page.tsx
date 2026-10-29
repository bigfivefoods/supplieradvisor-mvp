'use client';

import GymDebitFlow from '@/components/fitness/netcash/GymDebitFlow';
import { SettingsDesk } from '@/components/fitness/netcash/Desks';
import { PreviewFrame } from '@/components/fitness/netcash/PreviewFrame';
import { sampleSettings } from '@/lib/fitness/netcash/fixtures';

export default function PreviewNetcashPage() {
  return (
    <PreviewFrame screen="netcash">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">GymAdvisor®</p>
      <h1 className="text-3xl font-black tracking-tight text-[#0f172a] sm:text-4xl">Netcash <span className="text-[#00b4d8]">test mode</span></h1>
      <p className="mt-2 mb-5 max-w-3xl text-sm text-slate-600">Per-company merchant account and Debit Order service key. The key is sealed and this screen only shows the last four characters.</p>
      <GymDebitFlow linkFor={(href) => (href.endsWith('/netcash') ? '/preview/fitgraph/netcash' : href.endsWith('/debit-orders') ? '/preview/fitgraph/debit-orders' : href.endsWith('/billing-runs') ? '/preview/fitgraph/billing-runs' : '/preview/fitgraph/collections')} />
      <SettingsDesk settings={sampleSettings} />
    </PreviewFrame>
  );
}
