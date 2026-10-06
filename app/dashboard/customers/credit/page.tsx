'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/accounting/types';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  CREDIT_PAYMENT_TERMS,
  creditStatusLabel,
  sellerDecisionPlan,
  type CreditApplication,
  type CreditApplicationStatus,
} from '@/lib/customers/credit-application';

type ListItem = {
  id: number;
  customer_id: number;
  customer_name: string;
  status: CreditApplicationStatus;
  requested_limit: number | null;
  currency: string;
  payment_terms: string;
  bank_name: string;
  bank_masked: string;
  submitted_at: string | null;
  updated_at: string | null;
};

type Filter = 'all' | 'open' | 'approved' | 'declined' | 'draft';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Needs a decision' },
  { id: 'approved', label: 'Approved' },
  { id: 'declined', label: 'Declined' },
  { id: 'draft', label: 'Draft' },
];

export default function CustomerCreditPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const { companyId, withAuthJson } = useApiAuth();
  const [rows, setRows] = useState<ListItem[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CreditApplication | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [limit, setLimit] = useState('');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await withAuthJson<{
        applications?: ListItem[];
        can_write?: boolean;
      }>(`/api/customers/credit-applications?companyId=${companyId}`);
      setRows(data.applications || []);
      setCanWrite(Boolean(data.can_write));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load applications');
    } finally {
      setLoading(false);
    }
  }, [companyId, withAuthJson]);

  const open = useCallback(
    async (id: number) => {
      if (!companyId) return;
      setSelectedId(id);
      setDetailLoading(true);
      try {
        const data = await withAuthJson<{ application?: CreditApplication }>(
          `/api/customers/credit-applications?companyId=${companyId}&id=${id}`
        );
        const app = data.application || null;
        setDetail(app);
        setLimit(app?.requested_limit != null ? String(app.requested_limit) : '');
        setTerms(app?.payment_terms || '');
        setNotes('');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not open the application');
      } finally {
        setDetailLoading(false);
      }
    },
    [companyId, withAuthJson]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const visible = rows.filter((row) => {
    if (filter === 'all') return true;
    if (filter === 'open') return row.status === 'submitted' || row.status === 'in_review';
    return row.status === filter;
  });

  const decide = async (decision: 'in_review' | 'approved' | 'declined') => {
    if (!detail || !companyId) return;
    setBusy(true);
    try {
      const data = await withAuthJson<{ application?: CreditApplication }>(
        '/api/customers/credit-applications',
        {
          jsonBody: {
            id: detail.id,
            decision,
            approved_limit: limit,
            approved_terms: terms,
            decision_notes: notes,
          },
        }
      );
      if (data.application) setDetail(data.application);
      toast.success(
        decision === 'approved'
          ? 'Approved. The customer credit limit is updated.'
          : decision === 'declined'
            ? 'Application declined.'
            : 'Marked in review.'
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the decision');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CustomersPage>
      <CustomersHeader
        title="Credit"
        titleAccent="applications"
        description="Customers fill this in on their portal, under Credit. Approving a limit saves it on the customer. Orders already stop when that limit would be exceeded. A credit hold on Money still blocks the account until you clear it."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? 'btn-primary !py-1.5 !px-3 text-xs' : 'btn-secondary !py-1.5 !px-3 text-xs'}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {loading ? <p className="text-sm text-neutral-500">Loading applications…</p> : null}
      {!loading && visible.length === 0 ? (
        <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 text-sm text-neutral-700">
          No applications in this view. Send the customer their portal link from{' '}
          <Link href="/dashboard/customers/portal" className="font-semibold text-[#0077b6]">
            Customers → Portal
          </Link>
          . They apply on the Credit tab.
        </section>
      ) : null}
      {visible.length ? (
        <div className="overflow-x-auto rounded-[1.5rem] border border-white/70 bg-white/90">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Terms</th>
                <th className="px-4 py-3">Bank</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  className={
                    selectedId === row.id
                      ? 'cursor-pointer bg-sky-50'
                      : 'cursor-pointer hover:bg-neutral-50'
                  }
                  onClick={() => void open(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void open(row.id);
                    }
                  }}
                >
                  <td className="px-4 py-3 font-medium text-neutral-900">{row.customer_name}</td>
                  <td className="px-4 py-3">{creditStatusLabel(row.status)}</td>
                  <td className="px-4 py-3">
                    {formatMoney(row.requested_limit, row.currency, { compact: false })}
                  </td>
                  <td className="px-4 py-3">{row.payment_terms || '—'}</td>
                  <td className="px-4 py-3">
                    {row.bank_name ? `${row.bank_name} ` : ''}
                    {row.bank_masked || '—'}
                  </td>
                  <td className="px-4 py-3">{row.submitted_at ? row.submitted_at.slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {detailLoading ? <p className="mt-4 text-sm text-neutral-500">Opening application…</p> : null}
      {detail && !detailLoading ? (
        <Detail
          application={detail}
          canWrite={canWrite}
          limit={limit}
          terms={terms}
          notes={notes}
          busy={busy}
          onLimit={setLimit}
          onTerms={setTerms}
          onNotes={setNotes}
          onDecide={(decision) => void decide(decision)}
        />
      ) : null}
    </CustomersPage>
  );
}

function Detail({
  application,
  canWrite,
  limit,
  terms,
  notes,
  busy,
  onLimit,
  onTerms,
  onNotes,
  onDecide,
}: {
  application: CreditApplication;
  canWrite: boolean;
  limit: string;
  terms: string;
  notes: string;
  busy: boolean;
  onLimit: (value: string) => void;
  onTerms: (value: string) => void;
  onNotes: (value: string) => void;
  onDecide: (decision: 'in_review' | 'approved' | 'declined') => void;
}) {
  const plan = sellerDecisionPlan(application.status);
  const facts: Array<[string, string]> = [
    ['Legal name', application.legal_name],
    ['Trading name', application.trading_name],
    ['Registration', application.registration_number],
    ['VAT', application.vat_number],
    ['Industry', application.industry],
    ['Years trading', application.years_trading != null ? String(application.years_trading) : ''],
    ['Billing address', application.billing_address],
    ['Contact', application.contact_name],
    ['Email', application.contact_email],
    ['Phone', application.contact_phone],
    [
      'Requested',
      formatMoney(application.requested_limit, application.currency, { compact: false }),
    ],
    ['Terms asked', application.payment_terms],
    [
      'Expected monthly',
      application.expected_monthly != null
        ? formatMoney(application.expected_monthly, application.currency, { compact: false })
        : '',
    ],
    ['Bank', application.bank_name],
    ['Account name', application.bank_account_name],
    ['Branch code', application.bank_branch_code],
    ['Account number', application.bank_account_number],
    ['Signatory', [application.signatory_name, application.signatory_title].filter(Boolean).join(', ')],
    [
      'Current credit limit',
      application.current_credit_limit != null
        ? formatMoney(application.current_credit_limit, application.currency, { compact: false })
        : 'None',
    ],
  ];
  return (
    <section className="mt-4 rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#0077b6]">
          {creditStatusLabel(application.status)}
        </p>
        <h2 className="text-lg font-semibold text-neutral-900">
          {application.customer_name || application.trading_name || application.legal_name}
        </h2>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-neutral-500">{label}</dt>
            <dd className="text-sm text-neutral-900">{value || '—'}</dd>
          </div>
        ))}
      </dl>
      {application.trade_references.length ? (
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Trade references</h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-800">
            {application.trade_references.map((ref, index) => (
              <li key={`${ref.company}-${index}`}>
                {[ref.company, ref.contact, ref.phone, ref.email].filter(Boolean).join(' · ')}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {application.decision_notes && plan === 'closed' ? (
        <p className="text-sm text-neutral-700">{application.decision_notes}</p>
      ) : null}
      {plan === 'draft' ? (
        <p className="text-sm text-neutral-600">The customer has not submitted this yet.</p>
      ) : null}
      {plan === 'closed' && application.status === 'approved' ? (
        <p className="text-sm font-semibold text-neutral-900">
          Approved{' '}
          {formatMoney(application.approved_limit, application.currency, { compact: false })}
          {application.approved_terms ? ` · ${application.approved_terms}` : ''}
        </p>
      ) : null}
      {plan === 'allow' && canWrite ? (
        <div className="grid gap-3 border-t border-neutral-200 pt-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-neutral-600">
            Approved limit
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm"
              inputMode="decimal"
              value={limit}
              onChange={(e) => onLimit(e.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold text-neutral-600">
            Payment terms on the customer
            <select
              className="input mt-0.5 w-full !p-2.5 !text-sm"
              value={terms}
              onChange={(e) => onTerms(e.target.value)}
            >
              <option value="">Leave unchanged</option>
              {CREDIT_PAYMENT_TERMS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-neutral-600 sm:col-span-2">
            Note to keep with the decision
            <textarea
              className="input mt-0.5 w-full !p-2.5 !text-sm"
              rows={3}
              value={notes}
              onChange={(e) => onNotes(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => onDecide('in_review')}
            >
              Mark in review
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => onDecide('approved')}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => onDecide('declined')}
            >
              Decline
            </button>
          </div>
        </div>
      ) : null}
      {plan === 'allow' && !canWrite ? (
        <p className="text-sm text-neutral-600">You can view this application. Approving it needs write access on Customers.</p>
      ) : null}
    </section>
  );
}
