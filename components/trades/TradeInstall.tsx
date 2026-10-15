'use client';

import { B2cInstallPrompt } from '@/components/b2c/B2cInstallPrompt';

export function TradeInstallPrompt() {
  return (
    <>
      <button
        type="button"
        className="mb-3 inline-flex min-h-10 items-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 shadow-sm"
        onClick={() => window.dispatchEvent(new Event('sa-open-install'))}
      >
        Add to home screen
      </button>
      <B2cInstallPrompt
        autoShow={false}
        product="TradeAdvisor"
        blurb="Add TradeAdvisor® to your home screen. Jobs, the plan, and invoices open like an app."
      />
    </>
  );
}
