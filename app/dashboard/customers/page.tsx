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
  CalendarDays,
  BookOpen,
  FileText,
  Receipt,
  Wallet,
  ScanSearch,
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
import {
  CrmEmpty,
  CrmKeysHint,
  CrmSampleBanner,
  CrmSkeleton,
  useCrmKeys,
} from '@/components/customers/crm/kit';
import { CRM_SAMPLE_FLAG, crmPreviewBook } from '@/lib/customers/crm-preview';
import { fixtureHref, isFixturePath } from '@/lib/preview/fixture-href';

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

type DeskItem = {
  id: string;
  kind: 'follow_up' | 'close' | 'task';
  title: string;
  detail: string;
  when: string | null;
  overdue: boolean;
  href: string;
};

const CRM_PATH = [
  { href: '/dashboard/customers/profiles', label: 'Book', hint: 'Accounts', icon: BookOpen },
  { href: '/dashboard/customers/leads', label: 'Leads', hint: 'Source', icon: Target },
  { href: '/dashboard/customers/leads?tab=pipeline', label: 'Pipeline', hint: 'Deals', icon: TrendingUp },
  { href: '/sales/tasks', label: 'Diary', hint: 'Tasks', icon: CalendarDays },
  { href: '/dashboard/customers/quotes', label: 'Quote', hint: 'Trade', icon: FileText },
  { href: '/dashboard/customers/invoices', label: 'Invoice', hint: 'Bill', icon: Receipt },
  { href: '/dashboard/customers/money', label: 'Collect', hint: 'AR', icon: Wallet },
  { href: '/dashboard/customers/360', label: '360', hint: 'Account', icon: ScanSearch },
] as const;

const DESK_KIND: Record<DeskItem['kind'], string> = {
  follow_up: 'Follow up',
  close: 'Close',
  task: 'Diary',
};

export default function CustomersHub() {
  return (
    <CompanyRequired>
      <HubInner />
    </CompanyRequired>
  );
}

function sampleBookOn() {
  try {
    return sessionStorage.getItem(CRM_SAMPLE_FLAG) === '1';
  } catch {
    return false;
  }
}

function HubInner() {
  const companyId = getSelectedCompanyId()!;
  const fixture = isFixturePath('/preview/crm');
  const seeded = fixture || sampleBookOn();
  const [summary, setSummary] = useState<Summary | null>(() =>
    seeded ? crmPreviewBook().summary : null
  );
  const [desk, setDesk] = useState<DeskItem[]>(() => (seeded ? crmPreviewBook().desk : []));
  const [loading, setLoading] = useState(!seeded);
  const [sample, setSample] = useState(seeded);

  const load = useCallback(async () => {
    if (sampleBookOn() || isFixturePath('/preview/crm')) {
      const book = crmPreviewBook();
      setSample(true);
      setSummary(book.summary);
      setDesk(book.desk);
      setLoading(false);
      return;
    }
    setLoading(true);
    setSample(false);
    try {
      const res = await fetch(`/api/customers/summary?companyId=${companyId}`);
      const data = await res.json();
      setSummary(data.summary || null);
      setDesk(Array.isArray(data.desk) ? data.desk : []);
    } catch {
      setSummary(null);
      setDesk([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useCrmKeys({
    onCreate: () => {
      if (isFixturePath('/preview')) return;
      window.location.assign('/dashboard/customers/onboard');
    },
  });

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
        description="The SupplierAdvisor® customer book. Leads, the pipeline, the sales diary, quotes, and invoices all read and write those same records."
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
            <Link href={fixtureHref('/dashboard/customers/onboard')} className="btn-primary !py-2.5 !px-5 text-sm">
              <UserPlus className="w-4 h-4" /> Add customer
            </Link>
            <Link href={fixtureHref('/sales/tasks')} className="btn-secondary !py-2.5 !px-4 text-sm">
              <CalendarDays className="w-4 h-4" /> Diary
            </Link>
            <Link href={fixtureHref('/dashboard/customers/quotes')} className="btn-secondary !py-2.5 !px-4 text-sm">
              New quote
            </Link>
          </div>
        }
      />

      <CrmKeysHint />
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

      {fixture ? null : <AdvisorCoreBridge surface="customers" />}

      {fixture ? null : (
        <Suspense fallback={null}>
          <RatingPromptBanner />
        </Suspense>
      )}

      {fixture ? null : (
        <div className="mb-6">
          <AdvisorMemberAppInvite
            kind="customer"
            companyId={companyId}
            brand={getSelectedCompanyName()}
            audience="customers"
          />
        </div>
      )}

      <nav className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8" aria-label="Customer work">
        {CRM_PATH.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.href}
              href={fixtureHref(step.href)}
              className="crm-path min-h-11 rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-sm hover:border-[#00b4d8] hover:text-[#0077b6]"
            >
              <Icon className="h-4 w-4 text-[#00b4d8]" />
              <div className="mt-2 text-sm font-bold text-slate-900">{step.label}</div>
              <div className="text-[11px] text-neutral-500">{step.hint}</div>
            </Link>
          );
        })}
      </nav>

      {loading ? <CrmSkeleton variant="metrics" /> : null}
      <HubTelemetryGrid className={`mb-6 ${loading ? 'hidden' : ''}`}>
        <TelemetryCard
          label="In the book"
          value={loading ? '—' : s?.customers ?? 0}
          sub={`${s?.customersActive ?? 0} active`}
          accent="violet"
          icon={Users}
          href={fixtureHref('/dashboard/customers/profiles')}
        />
        <TelemetryCard
          label="Open pipeline"
          value={loading ? '—' : formatMoney(s?.pipelineValue ?? 0)}
          sub={`${s?.opportunitiesOpen ?? 0} deals · weighted ${formatMoney(s?.weightedPipeline ?? 0)}`}
          accent="cyan"
          icon={TrendingUp}
          href={fixtureHref('/dashboard/customers/leads?tab=pipeline')}
        />
        <TelemetryCard
          label="Open leads"
          value={loading ? '—' : s?.leadsOpen ?? 0}
          sub={`${s?.leads ?? 0} total · ${s?.overdueFollowups ?? 0} overdue`}
          accent={(s?.overdueFollowups || 0) > 0 ? 'amber' : 'sky'}
          icon={Target}
          href={fixtureHref('/dashboard/customers/leads')}
        />
        <TelemetryCard
          label="Won"
          value={loading ? '—' : formatMoney(s?.wonValue ?? 0)}
          sub={`${s?.wonCount ?? 0} closed won`}
          accent="emerald"
          icon={Award}
          href={fixtureHref('/dashboard/customers/leads?tab=pipeline')}
        />
      </HubTelemetryGrid>

      <section className="mb-6 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-800">On the desk</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Follow-ups, closes in the next 14 days, and open diary tasks.
            </p>
          </div>
          <Link href={fixtureHref('/sales/tasks')} className="text-xs font-bold text-[#0077b6] hover:underline">
            Open the diary
          </Link>
        </div>
        {loading ? (
          <div className="mt-4">
            <CrmSkeleton />
          </div>
        ) : desk.length === 0 ? (
          <div className="mt-4">
            <CrmEmpty
              icon={CalendarDays}
              title="The desk is clear"
              body="Nothing is due in the next 14 days. Capture a lead, or preview a sample book. Sample rows stay in this browser and are never written to SupplierAdvisor®."
              onSample={() => {
                try {
                  sessionStorage.setItem(CRM_SAMPLE_FLAG, '1');
                } catch {
                  /* ignore */
                }
                void load();
              }}
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {desk.map((item) => (
              <li key={item.id}>
                <Link
                  href={fixtureHref(item.href)}
                  className="flex min-h-11 items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {DESK_KIND[item.kind]} · {item.detail}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs font-bold tabular-nums ${
                      item.overdue ? 'text-rose-700' : 'text-slate-500'
                    }`}
                  >
                    {item.overdue ? 'Overdue' : item.when || 'Open'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

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
                  href={fixtureHref(row.href)}
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
              href={fixtureHref('/dashboard/customers/leads?tab=pipeline')}
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
            href={fixtureHref('/dashboard/customers/profiles')}
            className="mt-3 inline-flex text-xs font-bold text-[#0077b6] hover:underline"
          >
            Open the customer book
          </Link>
        </section>
      </div>
    </CustomersPage>
  );
}
