'use client';

import { CredentialsCard, type CredentialView } from '@/components/fitness/netcash/CredentialsCard';
import GymDebitFlow from '@/components/fitness/netcash/GymDebitFlow';
import { PreviewFrame } from '@/components/fitness/netcash/PreviewFrame';

const WHEN = '2026-10-29T08:00:00.000Z';

const empty: CredentialView = {
  merchantAccount: '',
  configured: false,
  last4: '',
  updatedAt: '',
  updatedBy: '',
  testResult: null,
};

const saved: CredentialView = {
  merchantAccount: 'NC-HA-1001',
  configured: true,
  last4: '1234',
  updatedAt: WHEN,
  updatedBy: 'owner',
  testResult: null,
};

const passed: CredentialView = {
  ...saved,
  testResult: {
    ok: true,
    message: 'Connection passed. Netcash accepted the Debit Order service key in test mode.',
  },
};

const failed: CredentialView = {
  ...saved,
  testResult: {
    ok: false,
    message: 'Connection failed. Netcash rejected the service key.',
  },
};

export default function PreviewNetcashPage() {
  return (
    <PreviewFrame screen="netcash">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">GymAdvisor®</p>
      <h1 className="text-3xl font-black tracking-tight text-[#0f172a] sm:text-4xl">Netcash <span className="text-[#00b4d8]">test mode</span></h1>
      <p className="mt-2 mb-5 max-w-3xl text-sm text-slate-600">
        Sample Netcash credentials for one gym on SupplierAdvisor®. The Debit Order service key is not on this page. Nothing here is saved and no bank is called.
      </p>
      <GymDebitFlow linkFor={(href) => (href.endsWith('/netcash') ? '/preview/fitgraph/netcash' : href.endsWith('/debit-orders') ? '/preview/fitgraph/debit-orders' : href.endsWith('/billing-runs') ? '/preview/fitgraph/billing-runs' : '/preview/fitgraph/collections')} />
      <div className="space-y-8">
        <CredentialsCard view={empty} legend="Empty" readOnly />
        <CredentialsCard view={saved} legend="Saved" readOnly />
        <CredentialsCard view={passed} legend="Test passed" readOnly />
        <CredentialsCard view={failed} legend="Test failed" readOnly />
      </div>
    </PreviewFrame>
  );
}
