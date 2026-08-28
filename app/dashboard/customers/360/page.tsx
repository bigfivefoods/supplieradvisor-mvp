'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const load = useCallback(async () => {
    setLoading(true);
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

  return (
    <CustomersPage>
      <CustomersHeader
        title="Customer"
        titleAccent="360"
        description="Trade buyers, gym members, clinic patients and hirers on one book — memberships, debit bank, invoices and last visit."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-sm"
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

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setKind(f.id)}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
              kind === f.id
                ? 'border-cyan-700 bg-cyan-700 text-white'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {f.label}
            {counts[f.id] != null ? ` · ${counts[f.id]}` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">
          No customers in this filter.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
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
    <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-2">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
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
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          Money & visits
        </p>
        <ul className="mt-1 space-y-1 text-[12px]">
          {row.invoices.slice(0, 6).map((inv) => (
            <li key={String(inv.id)} className="flex justify-between">
              <span>
                {inv.number} · {inv.status}
              </span>
              <span className="tabular-nums">{formatMoney(inv.total)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-slate-600">
          Last visit: {row.last_visit ? `${row.last_visit.date} ${row.last_visit.title}` : '—'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href={`/dashboard/customers/onboard?id=${row.customer_id}`}
            className="text-[11px] font-bold text-[#0077b6]"
          >
            Edit CRM
          </Link>
          <Link
            href="/dashboard/customers/invoices"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0077b6]"
          >
            <FileText className="h-3 w-3" /> Invoices
          </Link>
          {row.advisor_hrefs.map((h) => (
            <Link key={h} href={h} className="text-[11px] font-bold text-[#0077b6]">
              Advisor book
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
