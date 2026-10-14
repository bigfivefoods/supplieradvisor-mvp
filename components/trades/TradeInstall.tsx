'use client';

import { B2cInstallPrompt } from '@/components/b2c/B2cInstallPrompt';

export function TradeInstallPrompt() {
  return (
    <>
      <button
        type="button"
        className="mb-3 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800"
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
