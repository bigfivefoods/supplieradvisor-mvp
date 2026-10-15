'use client';

import { Building2, ShieldCheck } from 'lucide-react';
import { RECOVER_PENDING_BANNER } from '@/lib/recovery/brand';
import type { RecoverCreditor, RecoverMandate } from '@/lib/recovery/types';
import {
  RecoverBanner,
  RecoverButton,
  RecoverEmpty,
  RecoverRoleChip,
  RecoverScreen,
} from './RecoverChrome';
import { useRecoverDesk } from './useRecoverDesk';

const TERMS: Record<string, string> = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  on_receipt: 'On receipt',
};

const PRODUCTS: Record<string, string> = {
  nca_credit: 'Credit',
  trade: 'Trade',
  levy: 'Levy',
  rent: 'Rent',
  medical: 'Medical',
  utility: 'Utility',
  other: 'Other',
};

export function RecoverCreditors() {
  const { desk, error, loading } = useRecoverDesk();
  const rows = desk?.creditors ?? [];
  return (
    <RecoverScreen
      title="Creditors"
      description="Clients who place accounts. Creating a creditor book is a later step."
      action={desk ? <RecoverRoleChip role={desk.role} /> : null}
    >
      {error ? <RecoverBanner testId="recover-banner-error" tone="error">{error}</RecoverBanner> : null}
      {desk && !desk.ready ? (
        <RecoverBanner testId="recover-banner-pending" tone="pending">
          {RECOVER_PENDING_BANNER}
        </RecoverBanner>
      ) : null}
      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100 motion-reduce:animate-none" aria-busy="true" />
      ) : rows.length === 0 ? (
        <RecoverEmpty
          testId="recover-creditors-empty"
          icon={Building2}
          title="No accounts placed yet"
          body="No creditors yet. Creditor records appear here once a book is placed."
          legend={['Creditor', 'Registration', 'Remittance', 'Status']}
          action={<RecoverButton href="/dashboard/customers">Open customers</RecoverButton>}
        />
      ) : (
        <CreditorTable rows={rows} />
      )}
    </RecoverScreen>
  );
}

function CreditorTable({ rows }: { rows: RecoverCreditor[] }) {
  return (
    <div
      data-testid="recover-creditors-list"
      className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm"
    >
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-wider text-neutral-400">
          <tr>
            <th className="px-4 py-3">Creditor</th>
            <th className="px-4 py-3">Registration</th>
            <th className="px-4 py-3">Remittance</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[#e2e8f0]">
              <td className="px-4 py-3 font-semibold text-slate-900">{row.name || 'Unnamed creditor'}</td>
              <td className="px-4 py-3 tabular-nums text-slate-700">{row.reg_no || '—'}</td>
              <td className="px-4 py-3 text-slate-700">{TERMS[row.remittance_terms] || row.remittance_terms}</td>
              <td className="px-4 py-3 text-slate-700">{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecoverMandates() {
  const { desk, error, loading } = useRecoverDesk();
  const rows = desk?.mandates ?? [];
  return (
    <RecoverScreen
      title="Mandates"
      description="Authority to collect. Mandate forms arrive with the creditor book."
      action={desk ? <RecoverRoleChip role={desk.role} /> : null}
    >
      {error ? <RecoverBanner testId="recover-banner-error" tone="error">{error}</RecoverBanner> : null}
      {desk && !desk.ready ? (
        <RecoverBanner testId="recover-banner-pending" tone="pending">
          {RECOVER_PENDING_BANNER}
        </RecoverBanner>
      ) : null}
      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100 motion-reduce:animate-none" aria-busy="true" />
      ) : rows.length === 0 ? (
        <RecoverEmpty
          testId="recover-mandates-empty"
          icon={ShieldCheck}
          title="No mandates yet"
          body="A mandate records the authority to collect for a creditor. Add the creditor first."
          legend={['Creditor', 'Product', 'Programme', 'Status']}
          action={<RecoverButton href="/dashboard/recovergraph/creditors">Open creditors</RecoverButton>}
        />
      ) : (
        <MandateTable rows={rows} />
      )}
    </RecoverScreen>
  );
}

function MandateTable({ rows }: { rows: RecoverMandate[] }) {
  return (
    <div
      data-testid="recover-mandates-list"
      className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm"
    >
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-wider text-neutral-400">
          <tr>
            <th className="px-4 py-3">Creditor</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Programme</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[#e2e8f0]">
              <td className="px-4 py-3 font-semibold text-slate-900">{row.creditor_name || 'Creditor'}</td>
              <td className="px-4 py-3 text-slate-700">{PRODUCTS[row.product_type] || row.product_type}</td>
              <td className="px-4 py-3 text-slate-700">Collections</td>
              <td className="px-4 py-3 text-slate-700">{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
