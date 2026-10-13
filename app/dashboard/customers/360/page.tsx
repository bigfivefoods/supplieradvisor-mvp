'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import { IdentityStrip, KindChips } from '@/components/core-os/IdentityStrip';
import { formatMoney } from '@/lib/customers/types';
import type { Customer360 } from '@/lib/core-os/customer-360';
import CompanyLogo from '@/components/business/CompanyLogo';
import { AccountLogoField } from '@/components/relationship/AccountLogoField';
import {
  CrmEmpty,
  CrmSampleBanner,
  CrmSearch,
  CrmSkeleton,
  CrmTimeline,
  customerTimelineFrom360,
} from '@/components/customers/crm/kit';
import { CRM_SAMPLE_FLAG, crmPreviewBook } from '@/lib/customers/crm-preview';
import { Users } from 'lucide-react';

function sampleBookOn() {
  try {
    return sessionStorage.getItem(CRM_SAMPLE_FLAG) === '1';
  } catch {
    return false;
  }
}

const FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'trade', label: 'Trade' },
  { id: 'gym_member', label: 'Gym' },
  { id: 'clinic_patient', label: 'Clinic' },
  { id: 'hire_customer', label: 'Hire' },
  { id: 'retail_customer', label: 'Retail' },
];

export default function Customers360Page() {
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
  const [kind, setKind] = useState('all');
  const [rows, setRows] = useState<Customer360[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [raising, setRaising] = useState(false);
  const [q, setQ] = useState('');
  const [sample, setSample] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    if (sampleBookOn()) {
      const book = crmPreviewBook();
      setSample(true);
      setRows(book.rows360);
      setCounts(book.counts360);
      setLoading(false);
      return;
    }
    setSample(false);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (kind !== 'all') params.set('kind', kind);
      const res = await fetch(`/api/core/customer-360?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not load Customer 360');
      }
      setRows(data.rows || []);
      setCounts(data.counts || {});
    } catch (e: unknown) {
      setRows([]);
      setCounts({});
      toast.error(e instanceof Error ? e.message : 'Could not load Customer 360');
    } finally {
      setLoading(false);
    }
  }, [companyId, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  async function raiseRecurring() {
    setRaising(true);
    try {
      const res = await fetch('/api/core/customer-360', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Raised ${data.created || 0} membership invoice(s)`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setRaising(false);
    }
  }

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      `${row.name} ${row.email || ''}`.toLowerCase().includes(query)
    );
  }, [rows, q]);

  return (
    <CustomersPage>
      <CustomersHeader
        title="Customer"
        titleAccent="360"
        description="Trade buyers, gym members, clinic patients and hirers on one SupplierAdvisor® book — memberships, debit bank, invoices and the activity timeline."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-sm"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={raising}
              onClick={() => void raiseRecurring()}
              className="btn-primary !py-2 !px-4 text-sm"
            >
              {raising ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Raise period invoices'}
            </button>
          </div>
        }
      />

      {sample ? (
        <CrmSampleBanner
          onHide={() => {
            try {
              sessionStorage.removeItem(CRM_SAMPLE_FLAG);
            } catch {
              /* ignore */
            }
            void load();
          }}
        />
      ) : null}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CrmSearch label="Search the book" placeholder="Search name or email…" value={q} onChange={setQ} />
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setKind(f.id)}
            className={`min-h-11 rounded-full border px-3 text-sm font-bold ${
              kind === f.id
                ? 'border-[#00b4d8] bg-[#00b4d8] text-slate-950'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            {f.label}
            {counts[f.id] != null ? ` · ${counts[f.id]}` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <CrmSkeleton />
      ) : shown.length === 0 ? (
        <CrmEmpty
          icon={Users}
          title="No customers in this filter"
          body="Try another kind, or preview a sample book. Sample rows are not written to SupplierAdvisor®."
          onSample={() => {
            try {
              sessionStorage.setItem(CRM_SAMPLE_FLAG, '1');
            } catch {
              /* ignore */
            }
            void load();
          }}
        />
      ) : (
        <div className="space-y-2">
          {shown.map((r) => {
            const open = openId === r.customer_id;
            return (
              <article
                key={r.customer_id}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <button
                  type="button"
                  className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
                  onClick={() => setOpenId(open ? null : r.customer_id)}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <CompanyLogo
                      logoUrl={r.logo_url}
                      name={r.name}
                      size="md"
                      variant={r.party === 'individual' ? 'person' : 'company'}
                    />
                    <div className="min-w-0">
                    <p className="font-black text-slate-900">{r.name}</p>
                    <p className="text-[12px] text-slate-500">
                      {r.ar_account_code ? (
                        <span className="mr-2 font-mono font-bold text-slate-700">
                          {r.ar_account_code}
                        </span>
                      ) : null}
                      {r.email || '—'}
                      {r.next_session
                        ? ` · next ${r.next_session.date} ${r.next_session.title}`
                        : ''}
                    </p>
                    <div className="mt-1">
                      <KindChips kinds={r.kinds} />
                    </div>
                    </div>
                  </div>
                  <div className="text-right text-[12px]">
                    <p className="font-bold tabular-nums">
                      AR {formatMoney(r.open_ar)}
                    </p>
                    {r.debit_bank ? (
                      <p
                        className={
                          r.debit_bank.ready ? 'text-emerald-700' : 'text-amber-700'
                        }
                      >
                        {r.debit_bank.ready
                          ? `Debit ready · ${r.debit_bank.bank_name}`
                          : 'Debit bank incomplete'}
                      </p>
                    ) : r.party === 'individual' ? (
                      <p className="text-slate-400">Individual</p>
                    ) : (
                      <p className="text-slate-400">Trade / no debit</p>
                    )}
                  </div>
                </button>
                {open ? (
                  <Detail
                    row={r}
                    companyId={companyId}
                    privyUserId={privyUserId}
                    onLogo={(url) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.customer_id === r.customer_id
                            ? { ...x, logo_url: url }
                            : x
                        )
                      )
                    }
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </CustomersPage>
  );
}

function Detail({
  row,
  companyId,
  privyUserId,
  onLogo,
}: {
  row: Customer360;
  companyId: number;
  privyUserId?: string | null;
  onLogo: (url: string | null) => void;
}) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="grid gap-3 md:grid-cols-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Identity
        </p>
        <div className="mt-2 mb-2">
          <AccountLogoField
            companyId={companyId}
            privyUserId={privyUserId}
            kind="customer"
            recordId={row.customer_id}
            logoUrl={row.logo_url}
            name={row.name}
            size="lg"
            variant={row.party === 'individual' ? 'person' : 'company'}
            onChange={onLogo}
          />
        </div>
        <IdentityStrip identity={row.identity} />
        {row.memberships.length ? (
          <ul className="mt-2 space-y-1 text-[12px]">
            {row.memberships.map((m) => (
              <li key={m.plan_id}>
                <span className="font-bold">{m.plan_name}</span>{' '}
                <span className="text-slate-500">
                  {m.status} · {formatMoney(m.price_zar)}
                  {m.period_end ? ` · to ${m.period_end}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12px] text-slate-500">No class subscription.</p>
        )}
        {row.family.length ? (
          <p className="mt-2 text-[12px] text-slate-600">
            Household: {row.family.map((f) => f.name).join(', ')}
          </p>
        ) : null}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Money & visits
        </p>
        <ul className="mt-1 space-y-1 text-sm">
          {row.invoices.slice(0, 6).map((inv) => (
            <li key={String(inv.id)} className="flex justify-between gap-3">
              <span>
                {inv.number} · {inv.status}
              </span>
              <span className="tabular-nums">{formatMoney(inv.total)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-slate-600">
          Last visit: {row.last_visit ? `${row.last_visit.date} ${row.last_visit.title}` : '—'}
        </p>
      </div>
      </div>
      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Activity</p>
        <div className="mt-2">
          <CrmTimeline items={customerTimelineFrom360(row)} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/customers/onboard?id=${row.customer_id}`}
          className="inline-flex min-h-11 items-center text-sm font-bold text-[#0077b6]"
        >
          Edit CRM
        </Link>
        <Link
          href="/dashboard/customers/invoices"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-[#0077b6]"
        >
          <FileText className="h-4 w-4" /> Invoices
        </Link>
        {row.advisor_hrefs.map((h) => (
          <Link key={h} href={h} className="inline-flex min-h-11 items-center text-sm font-bold text-[#0077b6]">
            Advisor book
          </Link>
        ))}
      </div>
    </div>
  );
}
