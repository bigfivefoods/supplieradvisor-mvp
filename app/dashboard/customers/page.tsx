'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Award,
  Target,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { getSelectedCompanyId, getSelectedCompanyName } from '@/lib/containers/company';
import { AdvisorMemberAppInvite } from '@/components/b2c/AdvisorMemberAppInvite';
import { formatMoney } from '@/lib/customers/types';
import {
  CompanyRequired,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import {
  HubTelemetryGrid,
  TelemetryCard,
} from '@/components/chrome/CommandHubChrome';
import RatingPromptBanner from '@/components/ratings/RatingPromptBanner';
import { AdvisorCoreBridge } from '@/components/advisors/AdvisorCoreBridge';

type Summary = {
  customers: number;
  customersActive: number;
  leads: number;
  leadsOpen: number;
  opportunities: number;
  opportunitiesOpen: number;
  pipelineValue: number;
  weightedPipeline: number;
  wonValue: number;
  wonCount: number;
  overdueFollowups: number;
  pipelineIncludesGroup?: boolean;
  pipelineGroupCompanies?: number;
  invitePending?: number;
  inviteAccepted?: number;
  inviteSuspended?: number;
};

export default function CustomersHub() {
  return (
    <CompanyRequired>
      <HubInner />
    </CompanyRequired>
  );
}

function HubInner() {
  const companyId = getSelectedCompanyId()!;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/summary?companyId=${companyId}`);
      const data = await res.json();
      setSummary(data.summary || null);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = summary;

  return (
    <CustomersPage>
      <RelationshipHeader
        band
        eyebrow="Customer relationship management"
        title="Customers"
        titleAccent="Selling"
        description="The customer book, the pipeline, and the follow-ups that are late. Quote, invoice, and collect live on the rail."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link href="/dashboard/customers/onboard" className="btn-primary !py-2.5 !px-5 text-sm">
              <UserPlus className="w-4 h-4" /> Add customer
            </Link>
            <Link href="/dashboard/customers/quotes" className="btn-secondary !py-2.5 !px-4 text-sm">
              New quote
            </Link>
          </div>
        }
      />

      <AdvisorCoreBridge surface="customers" />

      <Suspense fallback={null}>
        <RatingPromptBanner />
      </Suspense>

      <div className="mb-6">
        <AdvisorMemberAppInvite
          kind="customer"
          companyId={companyId}
          brand={getSelectedCompanyName()}
          audience="customers"
        />
      </div>

      <HubTelemetryGrid className="mb-6">
        <TelemetryCard
          label="In the book"
          value={loading ? '—' : s?.customers ?? 0}
          sub={`${s?.customersActive ?? 0} active`}
          accent="violet"
          icon={Users}
          href="/dashboard/customers/profiles"
        />
        <TelemetryCard
          label="Open pipeline"
          value={loading ? '—' : formatMoney(s?.pipelineValue ?? 0)}
          sub={`${s?.opportunitiesOpen ?? 0} deals · weighted ${formatMoney(s?.weightedPipeline ?? 0)}`}
          accent="cyan"
          icon={TrendingUp}
          href="/dashboard/customers/leads?tab=pipeline"
        />
        <TelemetryCard
          label="Open leads"
          value={loading ? '—' : s?.leadsOpen ?? 0}
          sub={`${s?.leads ?? 0} total · ${s?.overdueFollowups ?? 0} overdue`}
          accent={(s?.overdueFollowups || 0) > 0 ? 'amber' : 'sky'}
          icon={Target}
          href="/dashboard/customers/leads"
        />
        <TelemetryCard
          label="Won"
          value={loading ? '—' : formatMoney(s?.wonValue ?? 0)}
          sub={`${s?.wonCount ?? 0} closed won`}
          accent="emerald"
          icon={Award}
          href="/dashboard/customers/leads?tab=pipeline"
        />
      </HubTelemetryGrid>

      <div className="mb-8 grid items-start gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black text-slate-800">Needs a decision</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Follow-ups and invites. A zero means that queue is clear.
          </p>
          <ul className="mt-3 divide-y divide-neutral-100">
            {[
              {
                label: 'Overdue follow-ups',
                value: s?.overdueFollowups ?? 0,
                href: '/dashboard/customers/leads',
              },
              {
                label: 'Invites awaiting claim',
                value: s?.invitePending ?? 0,
                href: '/dashboard/customers/invites',
              },
              {
                label: 'Connections suspended',
                value: s?.inviteSuspended ?? 0,
                href: '/dashboard/customers/invites',
              },
              {
                label: 'Open deals',
                value: s?.opportunitiesOpen ?? 0,
                href: '/dashboard/customers/leads?tab=pipeline',
              },
            ].map((row) => (
              <li key={row.label}>
                <Link
                  href={row.href}
                  className="flex items-center justify-between gap-3 py-3 text-sm hover:text-[#0077b6]"
                >
                  <span className="font-medium text-slate-700">{row.label}</span>
                  <span
                    className={`font-black tabular-nums ${
                      row.value > 0 ? 'text-amber-700' : 'text-slate-400'
                    }`}
                  >
                    {loading ? '—' : row.value}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-800">Pipeline</h3>
            <Link
              href="/dashboard/customers/leads?tab=pipeline"
              className="text-xs font-bold text-[#0077b6] hover:underline"
            >
              Open pipeline
            </Link>
          </div>
          <dl className="mt-3 divide-y divide-neutral-100 text-sm">
            <div className="flex items-baseline justify-between gap-3 py-3">
              <dt className="text-neutral-500">Open value</dt>
              <dd className="font-black tabular-nums text-slate-900">
                {loading ? '—' : formatMoney(s?.pipelineValue ?? 0)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-3">
              <dt className="text-neutral-500">Weighted</dt>
              <dd className="font-black tabular-nums text-slate-900">
                {loading ? '—' : formatMoney(s?.weightedPipeline ?? 0)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-3">
              <dt className="text-neutral-500">Won</dt>
              <dd className="font-black tabular-nums text-emerald-700">
                {loading ? '—' : formatMoney(s?.wonValue ?? 0)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-3">
              <dt className="text-neutral-500">Buyers on the platform</dt>
              <dd className="font-black tabular-nums text-slate-900">
                {loading ? '—' : s?.inviteAccepted ?? 0}
              </dd>
            </div>
          </dl>
          {s?.pipelineIncludesGroup ? (
            <p className="text-[11px] text-neutral-500">
              Pipeline includes {s.pipelineGroupCompanies} group{' '}
              {s.pipelineGroupCompanies === 1 ? 'company' : 'companies'}.
            </p>
          ) : null}
          <Link
            href="/dashboard/customers/profiles"
            className="mt-3 inline-flex text-xs font-bold text-[#0077b6] hover:underline"
          >
            Open the customer book
          </Link>
        </section>
      </div>
    </CustomersPage>
  );
}
