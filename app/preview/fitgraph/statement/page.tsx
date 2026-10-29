'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { StatementDesk } from '@/components/fitness/netcash/Desks';
import { PreviewFrame } from '@/components/fitness/netcash/PreviewFrame';
import { sampleLines, sampleRuns } from '@/lib/fitness/netcash/fixtures';

function Body() {
  const member = useSearchParams().get('member') || 'm_amahle';
  const lines = sampleLines.filter((line) => line.memberId === member);
  const name = lines[0]?.memberName || 'Amahle Nkosi';
  return <StatementDesk memberName={name} lines={lines.length ? lines : sampleLines.filter((line) => line.memberId === 'm_amahle')} runs={sampleRuns} />;
}

export default function PreviewStatementPage() {
  return (
    <PreviewFrame screen="collections">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">GymAdvisor®</p>
      <h1 className="text-3xl font-black tracking-tight text-[#0f172a] sm:text-4xl">Statement <span className="text-[#00b4d8]">member</span></h1>
      <p className="mt-2 mb-5 text-sm text-slate-600">SupplierAdvisor® invoice history for one member. Share the invoice on WhatsApp before the debit date.</p>
      <Suspense fallback={null}>
        <Body />
      </Suspense>
    </PreviewFrame>
  );
}
