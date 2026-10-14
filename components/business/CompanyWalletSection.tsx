'use client';

import { useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import { maskWalletAddress } from '@/lib/business/company-wallet';

const inputCls = 'input min-h-11 w-full !py-2.5 !px-3 !text-sm';

/**
 * Company payout wallet on the profile.
 * Owners set it explicitly and sign. Members see a masked address.
 */
export function CompanyWalletSection({
  mode,
  storedAddress,
  walletReady,
  connectedWallet,
  busy,
  onSave,
}: {
  mode: 'owner' | 'member';
  storedAddress: string | null;
  walletReady: boolean;
  connectedWallet: string | null;
  busy?: boolean;
  onSave: (address: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const shown =
    mode === 'owner'
      ? storedAddress || ''
      : maskWalletAddress(storedAddress) || '';

  return (
    <div className="min-w-0 sm:col-span-2">
      <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
        Wallet (on-chain)
      </label>
      <div className="mt-1.5 rounded-2xl border border-[#00b4d8]/25 bg-[#00b4d8]/[0.06] p-4">
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[#00b4d8]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {walletReady ? 'Payout wallet on file' : 'No payout wallet yet'}
            </p>
            {shown ? (
              <p className="mt-1 break-all font-mono text-sm text-slate-800" data-wallet-display>
                {shown}
              </p>
            ) : (
              <p className="mt-1 text-sm text-neutral-500" data-wallet-display>
                Not set
              </p>
            )}
            {mode === 'member' ? (
              <p className="mt-2 text-xs leading-relaxed text-neutral-600">
                Only the company owner can change this payout wallet on SupplierAdvisor®.
                You see a masked address, not the full one.
              </p>
            ) : (
              <>
                <p className="mt-2 text-xs leading-relaxed text-neutral-600">
                  Setting a payout wallet is an explicit owner action on SupplierAdvisor®.
                  It is not filled in from your login. Sign a message from the new address
                  to prove you control it. Owners and admins are emailed on every change.
                </p>
                <div className="relative mt-3">
                  <input
                    className={`${inputCls} pr-10 font-mono`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="0x…"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="New payout wallet"
                  />
                  <Wallet className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {connectedWallet ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#00b4d8] hover:underline"
                      onClick={() => setDraft(connectedWallet)}
                    >
                      Use your connected wallet
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-500">
                      Connect a wallet if you want to use that address.
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={busy || !draft.trim()}
                    onClick={() => void onSave(draft.trim())}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#00b4d8] px-3 text-xs font-bold text-[#0f172a] disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Sign and save
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
