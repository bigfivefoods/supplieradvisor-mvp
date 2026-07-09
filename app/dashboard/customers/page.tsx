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
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/customers/types';
import {
  CompanyRequired,
  CustomersNav,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import {
  AlertBanner,
  KpiCard,
  ModuleGrid,
  Panel,
  ProcessRail,
  RelationshipHeader,
  SectionLabel,
  type ModuleCard,
} from '@/components/relationship/RelationshipChrome';

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

const PROCESS = [
  { label: 'Lead', href: '/dashboard/customers/leads' },
  { label: 'Opportunity', href: '/dashboard/customers/leads?tab=pipeline' },
  { label: 'Quote', href: '/dashboard/customers/quotes' },
  { label: 'Order', href: '/dashboard/customers/orders' },
  { label: 'Invoice', href: '/dashboard/customers/invoices' },
  { label: 'Loyalty', href: '/dashboard/customers/loyalty' },
  { label: 'RIAD', href: '/dashboard/customers/riad-log' },
];

const MODULES: ModuleCard[] = [
  {
    href: '/dashboard/customers/leads',
    icon: Target,
    title: 'Leads & opportunities',
    desc: 'Capture, score, and convert — full pipeline with weighted value',
    badge: 'Core',
  },
  {
    href: '/dashboard/customers/profiles',
    icon: Users,
    title: 'Customer profiles',
    desc: 'Account master — contacts, credit, industry, addresses',
  },
  {
    href: '/dashboard/customers/onboard',
    icon: UserPlus,
    title: 'Add customer',
    desc: 'Onboard from a lead or create a clean account from scratch',
  },
  {
    href: '/dashboard/customers/invites',
    icon: Handshake,
    title: 'Platform invites',
    desc: 'Connect buyers on SupplierAdvisor — claim, suspend, expire',
    badge: 'Connect',
  },
  {
    href: '/dashboard/customers/quotes',
    icon: FileText,
    title: 'Quotes',
    desc: 'Catalogue lines, price, send, convert to order',
    badge: 'Sell',
  },
  {
    href: '/dashboard/customers/orders',
    icon: ShoppingCart,
    title: 'Sales orders',
    desc: 'Confirmed demand — convert quotes or build from inventory',
    badge: 'Sell',
  },
  {
    href: '/dashboard/customers/invoices',
    icon: FileText,
    title: 'Invoices',
    desc: 'Bill, mark paid, auto-earn loyalty points',
    badge: 'Sell',
  },
  {
    href: '/dashboard/customers/loyalty',
    icon: Award,
    title: 'Loyalty',
    desc: 'Points and bronze → platinum tiers',
  },
  {
    href: '/dashboard/customers/claims',
    icon: AlertTriangle,
    title: 'Claims',
    desc: 'Quality, delivery, damage — investigate and resolve',
  },
  {
    href: '/dashboard/customers/contracts',
    icon: Handshake,
    title: 'Contracts',
    desc: 'Agreements, SLAs, renewals, share with connected buyers',
  },
  {
    href: '/dashboard/customers/reviews',
    icon: Star,
    title: 'Peer reviews',
    desc: 'Bilateral post-PO ratings that build trust',
  },
  {
    href: '/dashboard/customers/portal',
    icon: Globe,
    title: 'Ops board',
    desc: 'Seller command center for the full customer lifecycle',
  },
  {
    href: '/dashboard/customers/search',
    icon: Search,
    title: 'Search',
    desc: 'Find customers, leads, and deals instantly',
  },
  {
    href: '/dashboard/customers/riad-log',
    icon: AlertTriangle,
    title: 'Customer RIAD',
    desc: 'Risks, issues, actions, decisions — relationship control',
  },
];

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

  return (
    <CustomersPage>
      <RelationshipHeader
        nav={<CustomersNav />}
        eyebrow="Customer relationship management"
        title="Customers you can"
        titleAccent="grow"
        description="One precision system: lead → opportunity → quote → order → invoice → loyalty. Invites connect buyers on-platform. Claims, contracts, and RIAD keep every relationship under control."
        action={
          <>
            <Link href="/dashboard/customers/onboard" className="btn-primary !py-2.5 !px-5 text-sm">
              <UserPlus className="w-4 h-4" /> Add customer
            </Link>
            <Link href="/dashboard/customers/leads" className="btn-secondary !py-2.5 !px-5 text-sm">
              <Target className="w-4 h-4" /> Pipeline
            </Link>
          </>
        }
      />

      <SectionLabel>Lifecycle</SectionLabel>
      <ProcessRail steps={PROCESS} />

      <SectionLabel>Pulse</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <KpiCard
          icon={Users}
          label="Customers"
          value={summary?.customers ?? 0}
          sub={`${summary?.customersActive ?? 0} active`}
          href="/dashboard/customers/profiles"
          loading={loading}
        />
        <KpiCard
          icon={Target}
          label="Open leads"
          value={summary?.leadsOpen ?? 0}
          sub={`${summary?.leads ?? 0} total · ${summary?.overdueFollowups ?? 0} overdue`}
          href="/dashboard/customers/leads"
          tone={(summary?.overdueFollowups || 0) > 0 ? 'amber' : 'neutral'}
          loading={loading}
        />
        <KpiCard
          icon={TrendingUp}
          label="Open pipeline"
          value={formatMoney(summary?.pipelineValue ?? 0)}
          sub={`${summary?.opportunitiesOpen ?? 0} deals · wtd ${formatMoney(summary?.weightedPipeline ?? 0)}`}
          href="/dashboard/customers/leads?tab=pipeline"
          tone="cyan"
          loading={loading}
        />
        <KpiCard
          icon={Award}
          label="Won value"
          value={formatMoney(summary?.wonValue ?? 0)}
          sub={`${summary?.wonCount ?? 0} closed won`}
          href="/dashboard/customers/leads?tab=pipeline"
          tone="emerald"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-10">
        <KpiCard
          icon={Handshake}
          label="Pending invites"
          value={summary?.invitePending ?? 0}
          sub="Awaiting buyer claim"
          href="/dashboard/customers/invites"
          tone={(summary?.invitePending || 0) > 0 ? 'amber' : 'neutral'}
          loading={loading}
        />
        <KpiCard
          icon={Globe}
          label="Connected"
          value={summary?.inviteAccepted ?? 0}
          sub="Platform buyers linked"
          href="/dashboard/customers/invites"
          tone="cyan"
          loading={loading}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Suspended"
          value={summary?.inviteSuspended ?? 0}
          sub="Collaboration frozen"
          href="/dashboard/customers/invites"
          tone={(summary?.inviteSuspended || 0) > 0 ? 'amber' : 'neutral'}
          loading={loading}
        />
      </div>

      <SectionLabel
        action={
          <Link
            href="/dashboard/customers/portal"
            className="text-xs font-semibold text-[#00b4d8] hover:underline"
          >
            Open ops board →
          </Link>
        }
      >
        Workspace
      </SectionLabel>
      <ModuleGrid modules={MODULES} />

      <div className="mt-10">
        <Panel title="Operating principle">
          <div className="px-5 py-6 sm:px-8 sm:py-8 grid sm:grid-cols-3 gap-6 text-sm">
            <Principle
              n="01"
              title="Single source of truth"
              body="Every stage lives on Supabase — no spreadsheet drift between sales and fulfilment."
            />
            <Principle
              n="02"
              title="Connect, then collaborate"
              body="Platform invites turn CRM rows into live buyer edges with shared documents."
            />
            <Principle
              n="03"
              title="Close the loop"
              body="Reviews, loyalty, claims, and RIAD keep performance visible after the sale."
            />
          </div>
        </Panel>
      </div>
    </CustomersPage>
  );
}

function Principle({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="text-[10px] font-black tracking-[0.2em] text-[#00b4d8] mb-2">{n}</div>
      <div className="font-bold text-slate-900 mb-1.5">{title}</div>
      <p className="text-xs text-neutral-500 leading-relaxed">{body}</p>
    </div>
  );
}
