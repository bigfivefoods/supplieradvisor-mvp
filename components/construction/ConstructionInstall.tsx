'use client';

import { B2cInstallPrompt } from '@/components/b2c/B2cInstallPrompt';

export function ConstructionInstallPrompt() {
  return (
    <>
      <button
        type="button"
        data-testid="install-prompt"
        className="inline-flex min-h-10 items-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 shadow-sm"
        onClick={() => window.dispatchEvent(new Event('sa-open-install'))}
      >
        Add to home screen
      </button>
      <B2cInstallPrompt
        autoShow={false}
        product="ConstructionAdvisor"
        blurb="Add ConstructionAdvisor® to your home screen. Your project plan, claims and notices open like an app."
      />
    </>
  );
}
