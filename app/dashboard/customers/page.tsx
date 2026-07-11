'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  ShoppingCart,
  FileText,
  AlertTriangle,
  Award,
  Globe,
  Search,
  Target,
  TrendingUp,
  Handshake,
  Star,
  RefreshCw,
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

  const modules: HubModule[] = [
    {
      href: '/dashboard/customers/leads',
      icon: Target,
      code: '01',
      title: 'Leads & opportunities',
      desc: 'Capture, score, and convert — full pipeline with weighted value.',
      accent: 'from-violet-50 to-white border-violet-100',
      metric: s?.leadsOpen ?? '—',
      metricLabel: 'open leads',
    },
    {
      href: '/dashboard/customers/profiles',
      icon: Users,
      code: '02',
      title: 'Customer profiles',
      desc: 'Account master — contacts, credit, industry, addresses.',
      accent: 'from-sky-50 to-white border-sky-100',
      metric: s?.customers ?? '—',
      metricLabel: 'accounts',
    },
    {
      href: '/dashboard/customers/onboard',
      icon: UserPlus,
      code: '03',
      title: 'Add customer',
      desc: 'Onboard from a lead or create a clean account from scratch.',
      accent: 'from-cyan-50 to-white border-cyan-100',
    },
    {
      href: '/dashboard/customers/invites',
      icon: Handshake,
      code: '04',
      title: 'Platform invites',
      desc: 'Connect buyers on SupplierAdvisor — claim, suspend, expire.',
      accent: 'from-emerald-50 to-white border-emerald-100',
      metric: s?.invitePending ?? '—',
      metricLabel: 'pending',
    },
    {
      href: '/dashboard/customers/quotes',
      icon: FileText,
      code: '05',
      title: 'Quotes',
      desc: 'Catalogue lines, price, send, convert to order.',
      accent: 'from-amber-50 to-white border-amber-100',
    },
    {
      href: '/dashboard/customers/orders',
      icon: ShoppingCart,
      code: '06',
      title: 'Sales orders',
      desc: 'Confirmed demand — convert quotes or build from inventory.',
      accent: 'from-rose-50 to-white border-rose-100',
    },
    {
      href: '/dashboard/customers/invoices',
      icon: FileText,
      code: '07',
      title: 'Invoices',
      desc: 'Bill, mark paid, auto-earn loyalty points.',
      accent: 'from-violet-50 to-white border-violet-100',
    },
    {
      href: '/dashboard/customers/loyalty',
      icon: Award,
      code: '08',
      title: 'Loyalty',
      desc: 'Points and bronze → platinum tiers after the sale.',
      accent: 'from-sky-50 to-white border-sky-100',
    },
    {
      href: '/dashboard/customers/claims',
      icon: AlertTriangle,
      code: '09',
      title: 'Claims',
      desc: 'Quality, delivery, damage — investigate and resolve.',
      accent: 'from-amber-50 to-white border-amber-100',
    },
    {
      href: '/dashboard/customers/contracts',
      icon: Handshake,
      code: '10',
      title: 'Contracts',
      desc: 'Agreements, SLAs, renewals with connected buyers.',
      accent: 'from-slate-50 to-white border-slate-200',
    },
    {
      href: '/dashboard/customers/reviews',
      icon: Star,
      code: '11',
      title: 'Peer reviews',
      desc: 'Bilateral post-PO ratings that build trust.',
      accent: 'from-emerald-50 to-white border-emerald-100',
    },
    {
      href: '/dashboard/customers/riad-log',
      icon: AlertTriangle,
      code: '12',
      title: 'Customer RIAD',
      desc: 'Risks, issues, actions, decisions — relationship control.',
      accent: 'from-rose-50 to-white border-rose-100',
    },
  ];

  return (
    <CustomersPage>
      <RelationshipHeader
        eyebrow="Customer relationship management"
        title="Customers"
        titleAccent="Command"
        description="One precision system: lead → opportunity → quote → order → invoice → loyalty. Invites connect buyers on-platform. Claims, contracts, and RIAD keep every relationship under control."
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
          </div>
        }
      />

      <HubHero
        pill="Live CRM · lead → loyalty"
        title="Customers you can grow."
        description="Pipeline, quotes, orders, and invoices on one tower. Platform invites turn CRM rows into live buyer edges with shared documents."
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
          label="Search"
          value="Find"
          sub="Customers, leads, deals"
          accent="violet"
          icon={Search}
          href="/dashboard/customers/search"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={modules} />

      <HubPrinciples
        items={[
          {
            title: 'Single source of truth',
            body: 'Every stage lives on Supabase — no spreadsheet drift between sales and fulfilment.',
          },
          {
            title: 'Connect, then collaborate',
            body: 'Platform invites turn CRM rows into live buyer edges with shared documents.',
          },
          {
            title: 'Close the loop',
            body: 'Reviews, loyalty, claims, and RIAD keep performance visible after the sale.',
          },
        ]}
      />
    </CustomersPage>
  );
}
