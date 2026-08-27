'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  AlertTriangle,
  Award,
  Globe,
  Target,
  TrendingUp,
  Handshake,
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
  HubHero,
  HubPrinciples,
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
        description="Source leads → book & invite buyers → quote, order, invoice, collect → rate → report. Advisor members, patients and hirers land on this book so the Advisor OS and Core CRM stay one system."
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
          sub={`${s?.opportunitiesOpen ?? 0} deals · wtd ${formatMoney(s?.weightedPipeline ?? 0)}${
            s?.pipelineIncludesGroup
              ? ` · incl. ${s.pipelineGroupCompanies} group ${
                  s.pipelineGroupCompanies === 1 ? 'company' : 'companies'
                }`
              : ''
          }`}
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

      {/* Process steps live in the top module rail — not repeated here. */}

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
