'use client';

import { useEffect, useState } from 'react';
import { Building2, ShieldCheck } from 'lucide-react';
import { HARBOUR_CUSTOMERS } from '@/lib/recovery/harbour-seed';
import { useIsRecoverPreview, useRecoverDesk, useRecoverIllustration } from './useRecoverDesk';
import type { RecoverCreditor, RecoverMandate } from '@/lib/recovery/types';
import { CreditorArt, MandateArt } from './RecoverArt';
import {
  RecoverBanner,
  RecoverButton,
  RecoverDemoGate,
  RecoverEmpty,
  RecoverField,
  RecoverPendingBanner,
  RecoverRoleChip,
  RecoverSample,
  RecoverScreen,
} from './RecoverChrome';
import { SampleCreditorCards, SampleMandateTimeline } from './RecoverPreviews';

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
  const { desk, error, loading, save } = useRecoverDesk();
  const preview = useIsRecoverPreview();
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<{ id: number; trading_name: string }[]>([]);
  const illustration = useRecoverIllustration();
  useEffect(() => {
    if (preview) {
      setCustomers(HARBOUR_CUSTOMERS.map((row) => ({ id: row.id, trading_name: row.trading_name })));
      return;
    }
    let stop = false;
    fetch('/api/recovery/recovergraph/creditors', { cache: 'no-store' })
      .then(async (response) => {
        if (stop || !response.ok) return;
        const body = (await response.json()) as { customers?: { id: number; trading_name: string }[]; reason?: string };
        if (body.reason === 'migration_pending') return;
        setCustomers(Array.isArray(body.customers) ? body.customers : []);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [preview]);
  const rows = desk?.creditors ?? [];
  return (
    <RecoverScreen
      title="Creditors"
      description="Clients who place accounts."
      action={desk ? <RecoverRoleChip role={desk.role} /> : null}
    >
      {error ? <RecoverBanner testId="recover-banner-error" tone="error">{error}</RecoverBanner> : null}
      <RecoverDemoGate desk={desk} />
      {desk && !desk.ready ? (
        <RecoverPendingBanner role={desk.role} />
      ) : null}
      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100 motion-reduce:animate-none" aria-busy="true" />
      ) : rows.length === 0 ? (
        <RecoverEmpty
          testId="recover-creditors-empty"
          icon={Building2}
          title="No creditors yet"
          body="Add the first client who will place accounts."
          art={<CreditorArt />}
          action={<RecoverButton type="button" onClick={() => setOpen(true)}>Add your first creditor</RecoverButton>}
          preview={
            illustration ? (
              <RecoverSample title="Sample layout of a creditor book">
                <SampleCreditorCards />
              </RecoverSample>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          <CreditorTable rows={rows} />
          <RecoverButton type="button" onClick={() => setOpen(true)}>Add a creditor</RecoverButton>
        </div>
      )}
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 sm:items-center" data-testid="recover-creditor-drawer">
          <form
            className="w-full max-w-lg rounded-t-3xl bg-white p-5 sm:rounded-3xl"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void save({
                op: 'creditor.upsert',
                name: String(data.get('name') || ''),
                reg_no: String(data.get('reg_no') || ''),
                contact_email: String(data.get('contact_email') || ''),
                customer_id: String(data.get('customer_id') || ''),
              }).then((ok) => {
                if (ok) setOpen(false);
              });
            }}
          >
            <h2 className="text-xl font-black">Creditor</h2>
            <RecoverField label="Name">
              <input name="name" required className="min-h-11 w-full rounded-xl border border-slate-200 px-3" />
            </RecoverField>
            <RecoverField label="Customer">
              <select name="customer_id" data-testid="recover-customer-picker" className="min-h-11 w-full rounded-xl border border-slate-200 px-3">
                <option value="">No customer link</option>
                {customers.map((row) => (
                  <option key={row.id} value={row.id}>{row.trading_name}</option>
                ))}
              </select>
            </RecoverField>
            <RecoverField label="Registration">
              <input name="reg_no" className="min-h-11 w-full rounded-xl border border-slate-200 px-3" />
            </RecoverField>
            <RecoverField label="Email">
              <input name="contact_email" type="email" className="min-h-11 w-full rounded-xl border border-slate-200 px-3" />
            </RecoverField>
            <div className="mt-4 flex gap-2">
              <RecoverButton type="submit">Save creditor</RecoverButton>
              <RecoverButton type="button" onClick={() => setOpen(false)}>Close</RecoverButton>
            </div>
          </form>
        </div>
      ) : null}
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
  const { desk, error, loading, save } = useRecoverDesk();
  const [open, setOpen] = useState(false);
  const illustration = useRecoverIllustration();
  const rows = desk?.mandates ?? [];
  return (
    <RecoverScreen
      title="Mandates"
      description="Authority to collect."
      action={desk ? <RecoverRoleChip role={desk.role} /> : null}
    >
      {error ? <RecoverBanner testId="recover-banner-error" tone="error">{error}</RecoverBanner> : null}
      <RecoverDemoGate desk={desk} />
      {desk && !desk.ready ? (
        <RecoverPendingBanner role={desk.role} />
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
          action={<RecoverButton type="button" onClick={() => setOpen(true)}>Add a mandate</RecoverButton>}
          preview={
            illustration ? (
              <RecoverSample title="Sample layout of a mandate">
                <SampleMandateTimeline />
              </RecoverSample>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          <MandateTable rows={rows} />
          <RecoverButton type="button" onClick={() => setOpen(true)}>Add a mandate</RecoverButton>
        </div>
      )}
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 sm:items-center" data-testid="recover-mandate-drawer">
          <form
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void save({
                op: 'mandate.upsert',
                creditor_id: String(data.get('creditor_id') || ''),
                product_type: String(data.get('product_type') || ''),
                nca_regulated: data.get('nca_regulated') === 'on',
                commission_model: { kind: String(data.get('commission_kind') || 'flat_per_account') },
              }).then((ok) => {
                if (ok) setOpen(false);
              });
            }}
          >
            <h2 className="text-xl font-black">Mandate</h2>
            <RecoverField label="Creditor">
              <select name="creditor_id" required className="min-h-11 w-full rounded-xl border border-slate-200 px-3">
                <option value="">Choose a creditor</option>
                {(desk?.creditors || []).map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </RecoverField>
            <RecoverField label="Product">
              <select name="product_type" required defaultValue="trade" className="min-h-11 w-full rounded-xl border border-slate-200 px-3">
                <option value="trade">Trade</option>
                <option value="nca_credit">Credit</option>
                <option value="levy">Levy</option>
                <option value="rent">Rent</option>
                <option value="medical">Medical</option>
                <option value="utility">Utility</option>
                <option value="other">Other</option>
              </select>
            </RecoverField>
            <p className="mt-2 text-sm">Commission is recorded for later; no fee is calculated or charged by RecoverAdvisor® yet.</p>
            <p className="mt-2 text-xs">Allocation order ⚖ VERIFY. RecoverAdvisor® gives no legal advice.</p>
            <div className="mt-4 flex gap-2">
              <RecoverButton type="submit">Save mandate</RecoverButton>
              <RecoverButton type="button" onClick={() => setOpen(false)}>Close</RecoverButton>
            </div>
          </form>
        </div>
      ) : null}
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
