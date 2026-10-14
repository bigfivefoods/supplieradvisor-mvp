'use client';

import { useEffect } from 'react';
import FirstRunChecklist from '@/components/onboarding/FirstRunChecklist';
import { bindFixtureNavigation } from '@/lib/preview/fixture-href';
import {
  FIRST_RUN_FIXTURE_COMPANY_ID,
  FIRST_RUN_FIXTURE_COMPANY_NAME,
  osFirstRunSignals,
} from '@/lib/preview/os-fixtures';

export default function FirstRunPreview() {
  useEffect(() => bindFixtureNavigation(), []);

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#0077b6]">
          SupplierAdvisor® · first-run checklist · not saved
        </p>
        <FirstRunChecklist
          companyId={FIRST_RUN_FIXTURE_COMPANY_ID}
          companyName={FIRST_RUN_FIXTURE_COMPANY_NAME}
          signals={osFirstRunSignals()}
          rememberDismiss={false}
        />
      </div>
    </main>
  );
}
