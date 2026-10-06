'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Handshake, Loader2, Printer } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatMoney } from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  AccountingStat,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel } from '@/components/relationship/RelationshipChrome';
import PeriodSlicer from '@/components/accounting/PeriodSlicer';
import { useAccountingPeriod } from '@/lib/accounting/use-period';
import type {
  PartnerCommissionStatement,
  ReferralEarnLine,
  ReferralRedemption,
} from '@/lib/accounting/referral-commission';

type CustomerChoice = {
  id: number;
  name: string;
  referral_partner_profile_id: number | null;
};

type CompanyHit = { id: number; name: string; legal_name: string };

type Outgoing = {
  partners: PartnerCommissionStatement[];
  customers: CustomerChoice[];
  warning: string | null;
};

type Bundle = {
  can_write: boolean;
  outgoing: Outgoing | null;
  incoming: PartnerCommissionStatement[];
};

function money(amount: number): string {
  return formatMoney(amount, 'ZAR', { compact: false });
}

function methodLabel(method: string): string {
  if (method === 'offset') return 'Offset against their account';
  if (method === 'credit') return 'Credit note';
  return 'Paid out';
}

function ruleLabel(row: PartnerCommissionStatement): string {
  const rate = `${row.rate_pct}%`;
  const base = row.basis === 'incl_vat' ? 'sales including VAT' : 'sales excluding VAT';
  const when = row.earn_on === 'invoiced' ? 'when you invoice' : 'when the customer pays';
  return `${row.partner_name} earns ${rate} of ${base}, ${when}.`;
}

export default function ReferralCommissionPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const { fyStartMonth, period, setPeriod } = useAccountingPeriod(
    companyId,
    privyUserId,
    'full_fy'
  );
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CompanyHit[]>([]);
  const [picked, setPicked] = useState<CompanyHit | null>(null);
  const [newRate, setNewRate] = useState('5');
  const [newBasis, setNewBasis] = useState('ex_vat');
  const [newEarnOn, setNewEarnOn] = useState('collected');
  const [newStatus, setNewStatus] = useState('active');
  const [newNotes, setNewNotes] = useState('');
  const [rate, setRate] = useState('5');
  const [basis, setBasis] = useState('ex_vat');
  const [earnOn, setEarnOn] = useState('collected');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [checked, setChecked] = useState<number[]>([]);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemOn, setRedeemOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [redeemMethod, setRedeemMethod] = useState('paid');
  const [redeemRef, setRedeemRef] = useState('');
  const [redeemNotes, setRedeemNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/referral-commission?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load commission');
      const next: Bundle = {
        can_write: Boolean(data.can_write),
        outgoing: data.outgoing || null,
        incoming: Array.isArray(data.incoming) ? data.incoming : [],
      };
      setBundle(next);
      if (next.outgoing?.warning) toast.message(next.outgoing.warning);
    } catch (error) {
      setBundle(null);
      toast.error(error instanceof Error ? error.message : 'Could not load commission');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, period.from, period.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const partners = bundle?.outgoing?.partners || [];
  const selected = useMemo(
    () => partners.find((row) => row.partner_profile_id === partnerId) || partners[0] || null,
    [partners, partnerId]
  );

  useEffect(() => {
    if (!selected) return;
    setPartnerId(selected.partner_profile_id);
    setRate(String(selected.rate_pct));
    setBasis(selected.basis);
    setEarnOn(selected.earn_on);
    setStatus(selected.status === 'paused' ? 'paused' : 'active');
    setNotes(selected.notes || '');
    const ids = (bundle?.outgoing?.customers || [])
      .filter((row) => row.referral_partner_profile_id === selected.partner_profile_id)
      .map((row) => row.id);
    setChecked(ids);
  }, [selected?.partner_profile_id, bundle?.outgoing?.customers]);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await fetch('/api/accounting/referral-commission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, privyUserId, ...body }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not save');
        toast.success('Saved');
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not save');
      } finally {
        setSaving(false);
      }
    },
    [companyId, privyUserId, load]
  );

  const search = async () => {
    const params = new URLSearchParams({
      companyId: String(companyId),
      q: query,
    });
    if (privyUserId) params.set('privyUserId', privyUserId);
    const res = await fetch(`/api/accounting/referral-commission?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Search failed');
      return;
    }
    setHits(Array.isArray(data.companies) ? data.companies : []);
  };

  return (
    <AccountingPage>
      <AccountingHeader
        title="Referral commission"
        description="Show a partner company what they earned on the sales they brought in, and what has already been paid, offset, or credited."
        action={
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2 !py-2 !px-3 text-sm print:hidden"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        }
      />
      <PeriodSlicer
        value={period}
        fyStartMonth={fyStartMonth}
        onChange={setPeriod}
        className="mb-4 print:hidden"
      />

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading commission
        </p>
      ) : null}

      {bundle?.can_write ? (
        <Panel title="Partner company" className="mb-4 print:hidden">
          <div className="space-y-3 px-5 py-4">
            <p className="text-sm text-slate-600">
              Add the company that refers sales to you. Restore Africa Foundation is a company on SupplierAdvisor, so search for that name and set their rate.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input w-full"
                placeholder="Search companies"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void search();
                }}
              />
              <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => void search()}>
                Search
              </button>
            </div>
            {hits.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {hits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-left text-xs ${
                      picked?.id === hit.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                    onClick={() => setPicked(hit)}
                  >
                    {hit.name}
                    {hit.legal_name && hit.legal_name !== hit.name ? ` · ${hit.legal_name}` : ''}
                  </button>
                ))}
              </div>
            ) : null}
            <RateFields
              rate={newRate}
              basis={newBasis}
              earnOn={newEarnOn}
              status={newStatus}
              notes={newNotes}
              onRate={setNewRate}
              onBasis={setNewBasis}
              onEarnOn={setNewEarnOn}
              onStatus={setNewStatus}
              onNotes={setNewNotes}
            />
            <button
              type="button"
              className="btn-primary !py-2 !px-4 text-sm"
              disabled={saving || !picked}
              onClick={() => {
                if (!picked) return;
                void post({
                  action: 'save_agreement',
                  partner_profile_id: picked.id,
                  rate_pct: Number(newRate),
                  basis: newBasis,
                  earn_on: newEarnOn,
                  status: newStatus,
                  notes: newNotes,
                });
              }}
            >
              {picked ? `Save ${picked.name}` : 'Choose a company'}
            </button>
          </div>
        </Panel>
      ) : null}

      {partners.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          {partners.map((row) => (
            <button
              key={row.partner_profile_id}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs ${
                selected?.partner_profile_id === row.partner_profile_id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white'
              }`}
              onClick={() => setPartnerId(row.partner_profile_id)}
            >
              <Handshake className="mr-1 inline h-3 w-3" />
              {row.partner_name}
              {row.status === 'paused' ? ' · paused' : ''}
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <Statement
          row={selected}
          periodLabel={period.label}
          canWrite={Boolean(bundle?.can_write)}
          customers={bundle?.outgoing?.customers || []}
          checked={checked}
          onToggle={(id) =>
            setChecked((current) =>
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
            )
          }
          rate={rate}
          basis={basis}
          earnOn={earnOn}
          status={status}
          notes={notes}
          onRate={setRate}
          onBasis={setBasis}
          onEarnOn={setEarnOn}
          onStatus={setStatus}
          onNotes={setNotes}
          saving={saving}
          onSaveRate={() =>
            void post({
              action: 'save_agreement',
              partner_profile_id: selected.partner_profile_id,
              rate_pct: Number(rate),
              basis,
              earn_on: earnOn,
              status,
              notes,
            })
          }
          onSaveCustomers={() =>
            void post({
              action: 'assign_customers',
              partner_profile_id: selected.partner_profile_id,
              customer_ids: checked,
            })
          }
          redeemAmount={redeemAmount}
          redeemOn={redeemOn}
          redeemMethod={redeemMethod}
          redeemRef={redeemRef}
          redeemNotes={redeemNotes}
          onRedeemAmount={setRedeemAmount}
          onRedeemOn={setRedeemOn}
          onRedeemMethod={setRedeemMethod}
          onRedeemRef={setRedeemRef}
          onRedeemNotes={setRedeemNotes}
          onRedeem={() =>
            void post({
              action: 'redeem',
              partner_profile_id: selected.partner_profile_id,
              amount: Number(redeemAmount),
              redeemed_on: redeemOn,
              method: redeemMethod,
              reference: redeemRef,
              notes: redeemNotes,
            })
          }
          onDeleteRedemption={(id) => void post({ action: 'delete_redemption', id })}
        />
      ) : null}

      {(bundle?.incoming || []).filter(
        (row) => row.seller_profile_id !== companyId
      ).length > 0 ? (
        <div className="mt-8 space-y-4">
          <h2 className="text-sm font-black text-slate-900">Commission earned by this company</h2>
          {bundle!.incoming
            .filter((row) => row.seller_profile_id !== companyId)
            .map((row) => (
              <Statement
                key={`${row.seller_profile_id}-${row.partner_profile_id}`}
                row={row}
                periodLabel={period.label}
                canWrite={false}
                heading={`From ${row.seller_name}`}
              />
            ))}
        </div>
      ) : null}
    </AccountingPage>
  );
}

function RateFields(props: {
  rate: string;
  basis: string;
  earnOn: string;
  status: string;
  notes: string;
  onRate: (value: string) => void;
  onBasis: (value: string) => void;
  onEarnOn: (value: string) => void;
  onStatus: (value: string) => void;
  onNotes: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-slate-600">
        Rate %
        <input
          className="input mt-1 w-full"
          inputMode="decimal"
          value={props.rate}
          onChange={(event) => props.onRate(event.target.value)}
        />
      </label>
      <label className="text-xs text-slate-600">
        Calculated on
        <select
          className="input mt-1 w-full"
          value={props.basis}
          onChange={(event) => props.onBasis(event.target.value)}
        >
          <option value="ex_vat">Sales excluding VAT</option>
          <option value="incl_vat">Sales including VAT</option>
        </select>
      </label>
      <label className="text-xs text-slate-600">
        Earned
        <select
          className="input mt-1 w-full"
          value={props.earnOn}
          onChange={(event) => props.onEarnOn(event.target.value)}
        >
          <option value="collected">When the customer pays</option>
          <option value="invoiced">When you invoice</option>
        </select>
      </label>
      <label className="text-xs text-slate-600">
        Status
        <select
          className="input mt-1 w-full"
          value={props.status}
          onChange={(event) => props.onStatus(event.target.value)}
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
      </label>
      <label className="text-xs text-slate-600 sm:col-span-2">
        Note
        <input
          className="input mt-1 w-full"
          value={props.notes}
          onChange={(event) => props.onNotes(event.target.value)}
        />
      </label>
    </div>
  );
}

function Statement(props: {
  row: PartnerCommissionStatement;
  periodLabel: string;
  canWrite: boolean;
  heading?: string;
  customers?: CustomerChoice[];
  checked?: number[];
  onToggle?: (id: number) => void;
  rate?: string;
  basis?: string;
  earnOn?: string;
  status?: string;
  notes?: string;
  onRate?: (value: string) => void;
  onBasis?: (value: string) => void;
  onEarnOn?: (value: string) => void;
  onStatus?: (value: string) => void;
  onNotes?: (value: string) => void;
  saving?: boolean;
  onSaveRate?: () => void;
  onSaveCustomers?: () => void;
  redeemAmount?: string;
  redeemOn?: string;
  redeemMethod?: string;
  redeemRef?: string;
  redeemNotes?: string;
  onRedeemAmount?: (value: string) => void;
  onRedeemOn?: (value: string) => void;
  onRedeemMethod?: (value: string) => void;
  onRedeemRef?: (value: string) => void;
  onRedeemNotes?: (value: string) => void;
  onRedeem?: () => void;
  onDeleteRedemption?: (id: number) => void;
}) {
  const row = props.row;
  return (
    <div className="space-y-4">
      <Panel title={props.heading || row.partner_name}>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-slate-600">
            {props.periodLabel}. {ruleLabel(row)}
            {row.status === 'paused'
              ? ' Paused still keeps this rate on sales already referred.'
              : ''}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AccountingStat label="Sales in period" value={money(row.period_sales)} />
            <AccountingStat label="Commission earned" value={money(row.period_commission)} />
            <AccountingStat label="Redeemed in period" value={money(row.period_redeemed)} />
            <AccountingStat
              label="Still owing"
              value={money(row.owing_at_end)}
              sub="Earned to period end, less redemptions"
              warn={row.owing_at_end < -0.05}
            />
          </div>
          <EarnTable lines={row.lines} />
          <RedeemTable
            rows={row.redemptions}
            canWrite={props.canWrite}
            onDelete={props.onDeleteRedemption}
          />
        </div>
      </Panel>

      {props.canWrite && props.onSaveRate && props.onRate ? (
        <Panel title="Rate" className="print:hidden">
          <div className="space-y-3 px-5 py-4">
            <RateFields
              rate={props.rate || ''}
              basis={props.basis || row.basis}
              earnOn={props.earnOn || row.earn_on}
              status={props.status || row.status}
              notes={props.notes || ''}
              onRate={props.onRate}
              onBasis={props.onBasis || (() => undefined)}
              onEarnOn={props.onEarnOn || (() => undefined)}
              onStatus={props.onStatus || (() => undefined)}
              onNotes={props.onNotes || (() => undefined)}
            />
            <button
              type="button"
              className="btn-secondary !py-2 !px-4 text-sm"
              disabled={props.saving}
              onClick={props.onSaveRate}
            >
              Update rate
            </button>
          </div>
        </Panel>
      ) : null}

      {props.canWrite && props.customers && props.onSaveCustomers ? (
        <Panel title="Customers they referred" className="print:hidden">
          <div className="space-y-3 px-5 py-4">
            <p className="text-sm text-slate-600">
              Tick the customers whose sales count for this partner, including sales already invoiced. Their own purchases count only if you tick their customer record.
            </p>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {props.customers.map((customer) => {
                const elsewhere =
                  customer.referral_partner_profile_id &&
                  customer.referral_partner_profile_id !== row.partner_profile_id;
                return (
                  <label key={customer.id} className="flex items-start gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={props.checked?.includes(customer.id) || false}
                      onChange={() => props.onToggle?.(customer.id)}
                    />
                    <span>
                      {customer.name}
                      {elsewhere ? (
                        <span className="block text-xs text-amber-700">
                          Currently assigned to another partner. Saving moves them here.
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
            <button
              type="button"
              className="btn-secondary !py-2 !px-4 text-sm"
              disabled={props.saving}
              onClick={props.onSaveCustomers}
            >
              Save customers
            </button>
          </div>
        </Panel>
      ) : null}

      {props.canWrite && props.onRedeem ? (
        <Panel title="Record a redemption" className="print:hidden">
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
            <label className="text-xs text-slate-600">
              Amount
              <input
                className="input mt-1 w-full"
                inputMode="decimal"
                value={props.redeemAmount || ''}
                onChange={(event) => props.onRedeemAmount?.(event.target.value)}
              />
            </label>
            <label className="text-xs text-slate-600">
              Date
              <input
                className="input mt-1 w-full"
                type="date"
                value={props.redeemOn || ''}
                onChange={(event) => props.onRedeemOn?.(event.target.value)}
              />
            </label>
            <label className="text-xs text-slate-600">
              How
              <select
                className="input mt-1 w-full"
                value={props.redeemMethod || 'paid'}
                onChange={(event) => props.onRedeemMethod?.(event.target.value)}
              >
                <option value="paid">Paid out</option>
                <option value="offset">Offset against their account</option>
                <option value="credit">Credit note</option>
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Reference
              <input
                className="input mt-1 w-full"
                value={props.redeemRef || ''}
                onChange={(event) => props.onRedeemRef?.(event.target.value)}
              />
            </label>
            <label className="text-xs text-slate-600 sm:col-span-2">
              Note
              <input
                className="input mt-1 w-full"
                value={props.redeemNotes || ''}
                onChange={(event) => props.onRedeemNotes?.(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-primary !py-2 !px-4 text-sm sm:col-span-2 sm:w-fit"
              disabled={props.saving}
              onClick={props.onRedeem}
            >
              Record redemption
            </button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function EarnTable({ lines }: { lines: ReferralEarnLine[] }) {
  if (!lines.length) {
    return <p className="text-sm text-slate-500">No commission in this period.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3 font-black">Date</th>
            <th className="py-2 pr-3 font-black">Invoice</th>
            <th className="py-2 pr-3 font-black">Customer</th>
            <th className="py-2 pr-3 text-right font-black">Sales</th>
            <th className="py-2 text-right font-black">Commission</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.key} className="border-t border-slate-100">
              <td className="py-2 pr-3 whitespace-nowrap">{line.earned_on}</td>
              <td className="py-2 pr-3 whitespace-nowrap">
                {line.invoice_number}
                {line.reference ? (
                  <span className="block text-xs text-slate-500">{line.reference}</span>
                ) : null}
              </td>
              <td className="py-2 pr-3">{line.customer_name}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{money(line.sales_amount)}</td>
              <td className="py-2 text-right tabular-nums">{money(line.commission)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RedeemTable(props: {
  rows: ReferralRedemption[];
  canWrite: boolean;
  onDelete?: (id: number) => void;
}) {
  if (!props.rows.length) {
    return <p className="text-sm text-slate-500">Nothing redeemed in this period.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3 font-black">Date</th>
            <th className="py-2 pr-3 font-black">How</th>
            <th className="py-2 pr-3 font-black">Reference</th>
            <th className="py-2 text-right font-black">Amount</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="py-2 pr-3 whitespace-nowrap">{row.redeemed_on}</td>
              <td className="py-2 pr-3">
                {methodLabel(row.method)}
                {row.notes ? <span className="block text-xs text-slate-500">{row.notes}</span> : null}
              </td>
              <td className="py-2 pr-3">{row.reference || '—'}</td>
              <td className="py-2 text-right tabular-nums">
                {money(row.amount)}
                {props.canWrite && props.onDelete ? (
                  <button
                    type="button"
                    className="ml-2 text-xs text-slate-500 underline print:hidden"
                    onClick={() => {
                      if (window.confirm('Remove this redemption?')) props.onDelete?.(row.id);
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
