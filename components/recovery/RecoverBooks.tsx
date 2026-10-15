'use client';

import { Building2, ShieldCheck } from 'lucide-react';
import { RECOVER_PENDING_BANNER } from '@/lib/recovery/brand';
import type { RecoverCreditor, RecoverMandate } from '@/lib/recovery/types';
import { CreditorArt, MandateArt } from './RecoverArt';
import {
  RecoverBanner,
  RecoverButton,
  RecoverDemoGate,
  RecoverEmpty,
  RecoverRoleChip,
  RecoverSample,
  RecoverScreen,
} from './RecoverChrome';
import { SampleCreditorCards, SampleMandateTimeline } from './RecoverPreviews';
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
      <RecoverDemoGate desk={desk} />
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
          art={<CreditorArt />}
          action={<RecoverButton href="/dashboard/customers">Open customers</RecoverButton>}
          preview={
            <RecoverSample title="Sample layout of a creditor book">
              <SampleCreditorCards />
            </RecoverSample>
          }
        />
      ) : (
        <CreditorTable rows={rows} />
      )}
    </RecoverScreen>
  );
}

function CreditorTable({ rows }: { rows: RecoverCreditor[] }) {
  return (
    <div data-testid="recover-creditors-list" className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <article key={row.id} className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm">
          <div className="border-b border-[#e2e8f0] bg-gradient-to-r from-cyan-50 to-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Creditor</p>
            <h2 className="mt-0.5 text-base font-black text-slate-900">{row.name || 'Unnamed creditor'}</h2>
          </div>
          <dl className="grid grid-cols-2">
            <div className="border-t border-[#e2e8f0] px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Registration</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{row.reg_no || '—'}</dd>
            </div>
            <div className="border-t border-[#e2e8f0] px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Remittance</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {TERMS[row.remittance_terms] || row.remittance_terms}
              </dd>
            </div>
          </dl>
          <div className="flex items-center justify-between border-t border-[#e2e8f0] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Status</span>
            <span className="inline-flex rounded-full bg-[#00b4d8] px-2.5 py-1 text-xs font-bold text-[#0f172a]">
              {row.status}
            </span>
          </div>
        </article>
      ))}
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
      <RecoverDemoGate desk={desk} />
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
          art={<MandateArt />}
          action={<RecoverButton href="/dashboard/recovergraph/creditors">Open creditors</RecoverButton>}
          preview={
            <RecoverSample title="Sample layout of a mandate">
              <SampleMandateTimeline />
            </RecoverSample>
          }
        />
      ) : (
        <MandateTable rows={rows} />
      )}
    </RecoverScreen>
  );
}

function MandateTable({ rows }: { rows: RecoverMandate[] }) {
  return (
    <div data-testid="recover-mandates-list" className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <article key={row.id} className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm">
          <div className="border-b border-[#e2e8f0] bg-gradient-to-r from-cyan-50 to-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Mandate</p>
            <h2 className="mt-0.5 text-base font-black text-slate-900">{row.creditor_name || 'Creditor'}</h2>
          </div>
          <dl className="grid grid-cols-2">
            <div className="border-t border-[#e2e8f0] px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Product</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {PRODUCTS[row.product_type] || row.product_type}
              </dd>
            </div>
            <div className="border-t border-[#e2e8f0] px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Programme</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">Collections</dd>
            </div>
          </dl>
          <div className="flex items-center justify-between border-t border-[#e2e8f0] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Status</span>
            <span className="inline-flex rounded-full bg-[#00b4d8] px-2.5 py-1 text-xs font-bold text-[#0f172a]">
              {row.status}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
