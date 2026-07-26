'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  ShoppingCart,
  FileText,
  AlertTriangle,
  Award,
  Globe,
  Target,
  TrendingUp,
  Handshake,
  Star,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/customers/types';
import {
  CompanyRequired,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import {
  HubHero,
  HubModuleGrid,
  HubPrinciples,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';
import RatingPromptBanner from '@/components/ratings/RatingPromptBanner';

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

  /** Sell journey (matches process rail): Source → Book → Invite → Quote → Order → Invoice → Money → Rate → Report */
  const modules: HubModule[] = [
    {
      href: '/dashboard/customers/leads',
      icon: Target,
      code: '01',
      title: 'Source — leads & pipeline',
      desc: 'Capture, score, and convert demand — weighted pipeline value.',
      accent: 'from-violet-50 to-white border-violet-100',
      metric: s?.leadsOpen ?? '—',
      metricLabel: 'open leads',
    },
    {
      href: '/dashboard/customers/profiles',
      icon: Users,
      code: '02',
      title: 'Book — customer accounts',
      desc: 'CRM master: search, contacts, credit, industry.',
      accent: 'from-sky-50 to-white border-sky-100',
      metric: s?.customers ?? '—',
      metricLabel: 'accounts',
    },
    {
      href: '/dashboard/customers/onboard',
      icon: UserPlus,
      code: '03',
      title: 'Add customer',
      desc: 'Onboard from a lead or create a clean account (then invite).',
      accent: 'from-cyan-50 to-white border-cyan-100',
    },
    {
      href: '/dashboard/customers/invites',
      icon: Handshake,
      code: '04',
      title: 'Invite — platform connect',
      desc: 'Invite buyers onto SupplierAdvisor — claim, suspend, expire.',
      accent: 'from-emerald-50 to-white border-emerald-100',
      metric: s?.invitePending ?? '—',
      metricLabel: 'pending',
    },
    {
      href: '/dashboard/customers/quotes',
      icon: FileText,
      code: '05',
      title: 'Quote',
      desc: 'Catalogue lines, price, send — add customer if missing.',
      accent: 'from-amber-50 to-white border-amber-100',
    },
    {
      href: '/dashboard/customers/orders',
      icon: ShoppingCart,
      code: '06',
      title: 'Order',
      desc: 'Sales orders and inbound buyer POs (tab) in one place.',
      accent: 'from-rose-50 to-white border-rose-100',
    },
    {
      href: '/dashboard/customers/invoices',
      icon: FileText,
      code: '07',
      title: 'Invoice',
      desc: 'Bill, partial/full pay, WhatsApp PDF, loyalty on paid.',
      accent: 'from-violet-50 to-white border-violet-100',
    },
    {
      href: '/dashboard/customers/money',
      icon: Wallet,
      code: '08',
      title: 'Money',
      desc: 'Collect: claims, POP, dunning, installments, AR aging, settle.',
      accent: 'from-emerald-50 to-white border-emerald-100',
      metric: s?.overdueFollowups ?? '—',
      metricLabel: 'overdue signals',
    },
    {
      href: '/dashboard/customers/ratings',
      icon: Star,
      code: '09',
      title: 'Rate',
      desc: 'Peer ratings and post-trade reviews that build trust.',
      accent: 'from-violet-50 to-white border-violet-100',
    },
    {
      href: '/dashboard/customers/report',
      icon: TrendingUp,
      code: '10',
      title: 'Report',
      desc: 'Revenue, AR, win rates, and customer health pack.',
      accent: 'from-sky-50 to-white border-sky-100',
    },
    {
      href: '/dashboard/customers/loyalty',
      icon: Award,
      code: '11',
      title: 'Loyalty',
      desc: 'Points and bronze → platinum after paid sales.',
      accent: 'from-sky-50 to-white border-sky-100',
    },
    {
      href: '/dashboard/customers/contracts',
      icon: Handshake,
      code: '12',
      title: 'Contracts & SLAs',
      desc: 'Commercial agreements and renewals with buyers.',
      accent: 'from-slate-50 to-white border-slate-200',
    },
    {
      href: '/dashboard/customers/riad-log',
      icon: AlertTriangle,
      code: '13',
      title: 'Customer RIAD',
      desc: 'Risks, issues, actions, decisions on demand relationships.',
      accent: 'from-rose-50 to-white border-rose-100',
    },
  ];

  return (
    <CustomersPage>
      <RelationshipHeader
        eyebrow="Customer relationship management"
        title="Customers"
        titleAccent="Selling"
        description="Source leads → book & invite buyers → quote, order, invoice, collect → rate → report. One clean sell path (no duplicate search/connect/money tabs)."
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

      <Suspense fallback={null}>
        <RatingPromptBanner />
      </Suspense>

      <HubHero
        pill="Live CRM · source → sell → rate"
        title="Customers you can grow."
        description="Leads and book first, then quote through collect, then rate and report — parallel to suppliers, without duplicate nav."
        stats={[
          {
            label: 'Customers',
            value: loading ? '—' : s?.customers ?? 0,
            valueClass: 'text-[#00b4d8]',
          },
          {
            label: 'Pipeline',
            value: loading ? '—' : formatMoney(s?.pipelineValue ?? 0),
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Open leads',
            value: loading ? '—' : s?.leadsOpen ?? 0,
            valueClass: 'text-amber-600',
          },
        ]}
      />

      <HubTelemetryGrid>
        <TelemetryCard
          label="Customers"
          value={s?.customers ?? 0}
          sub={`${s?.customersActive ?? 0} active`}
          accent="violet"
          icon={Users}
          href="/dashboard/customers/profiles"
        />
        <TelemetryCard
          label="Open leads"
          value={s?.leadsOpen ?? 0}
          sub={`${s?.leads ?? 0} total · ${s?.overdueFollowups ?? 0} overdue`}
          accent={(s?.overdueFollowups || 0) > 0 ? 'amber' : 'sky'}
          icon={Target}
          href="/dashboard/customers/leads"
        />
        <TelemetryCard
          label="Open pipeline"
          value={formatMoney(s?.pipelineValue ?? 0)}
          sub={`${s?.opportunitiesOpen ?? 0} deals · wtd ${formatMoney(s?.weightedPipeline ?? 0)}`}
          accent="cyan"
          icon={TrendingUp}
          href="/dashboard/customers/leads?tab=pipeline"
        />
        <TelemetryCard
          label="Won value"
          value={formatMoney(s?.wonValue ?? 0)}
          sub={`${s?.wonCount ?? 0} closed won`}
          accent="emerald"
          icon={Award}
          href="/dashboard/customers/leads?tab=pipeline"
        />
        <TelemetryCard
          label="Pending invites"
          value={s?.invitePending ?? 0}
          sub="Awaiting buyer claim"
          accent={(s?.invitePending || 0) > 0 ? 'amber' : 'slate'}
          icon={Handshake}
          href="/dashboard/customers/invites"
        />
        <TelemetryCard
          label="Connected"
          value={s?.inviteAccepted ?? 0}
          sub="Platform buyers linked"
          accent="sky"
          icon={Globe}
          href="/dashboard/customers/invites"
        />
        <TelemetryCard
          label="Suspended"
          value={s?.inviteSuspended ?? 0}
          sub="Collaboration frozen"
          accent={(s?.inviteSuspended || 0) > 0 ? 'rose' : 'slate'}
          icon={AlertTriangle}
          href="/dashboard/customers/invites"
        />
        <TelemetryCard
          label="Customer book"
          value="Open"
          sub="Profiles & accounts"
          accent="violet"
          icon={Users}
          href="/dashboard/customers/profiles"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={modules} />

      <HubPrinciples
        items={[
          {
            title: 'Source demand',
            body: 'Leads, search, and onboard — build a clean book before you quote.',
          },
          {
            title: 'Connect, then sell',
            body: 'Invite buyers to the platform; quote and invoice even while invite is pending.',
          },
          {
            title: 'Score & report',
            body: 'Loyalty, peer ratings, AR, and the customer report pack close the loop after cash.',
          },
        ]}
      />
    </CustomersPage>
  );
}
