'use client';

import { MemberStatements } from '@/components/fitness/netcash/MemberStatements';
import { buildMemberStatements } from '@/lib/fitness/netcash/member-statement';
import { sampleLines, sampleRuns } from '@/lib/fitness/netcash/fixtures';
import type { BillingLine, BillingRun } from '@/lib/fitness/netcash/types';

const september: BillingLine = {
  ...sampleLines[0],
  id: 'ln_sep',
  runId: 'run_sep',
  collectionStatus: 'unpaid',
  invoiceNumber: 'GYM-00030',
  totalCents: 89000,
  netcashReasonCode: '02',
  netcashReasonText: 'Not provided for',
  financeStatus: 'issued',
};
const septemberRun: BillingRun = {
  ...sampleRuns[0],
  id: 'run_sep',
  periodKey: '2026-09',
  actionDate: '2026-09-01',
  status: 'reconciled',
};

const statements = buildMemberStatements('m_amahle', [september, sampleLines[0]], [septemberRun, sampleRuns[0]]);

export default function PreviewMemberAdminPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-6 text-[#0f172a]">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">GymAdvisor® · You</p>
      <h1 className="mt-1 text-2xl font-black">Admin</h1>
      <p className="mt-1 text-sm text-slate-600">Amahle Nkosi · Harbour Athletic. This is her statement only.</p>
      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
        <MemberStatements gymName="Harbour Athletic" memberName="Amahle Nkosi" statements={statements} />
      </div>
    </main>
  );
}
