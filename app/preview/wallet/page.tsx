'use client';

import { useState } from 'react';
import { CompanyWalletSection } from '@/components/business/CompanyWalletSection';

const SAMPLE = '0x1234567890abcdef1234567890abcdef1234abcd';
const CONNECTED = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

export default function WalletPreviewPage() {
  const [ownerAddress, setOwnerAddress] = useState(SAMPLE);
  const [notice, setNotice] = useState('');

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-8 text-slate-900">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
        <section data-wallet-view="owner">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0077b6]">
            SupplierAdvisor® · owner
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Owner wallet</h1>
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
            <CompanyWalletSection
              mode="owner"
              storedAddress={ownerAddress}
              walletReady
              connectedWallet={CONNECTED}
              onSave={async (address) => {
                setOwnerAddress(address);
                setNotice('Preview only — nothing was signed or saved.');
              }}
            />
          </div>
        </section>
        <section data-wallet-view="member">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0077b6]">
            SupplierAdvisor® · member
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Member wallet</h1>
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
            <CompanyWalletSection
              mode="member"
              storedAddress={SAMPLE}
              walletReady
              connectedWallet={CONNECTED}
              onSave={async () => undefined}
            />
          </div>
        </section>
      </div>
      {notice ? <p className="mx-auto mt-6 max-w-5xl text-sm text-slate-600">{notice}</p> : null}
    </main>
  );
}
