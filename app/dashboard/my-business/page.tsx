'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  FolderOpen,
  ShieldCheck,
  FileText,
  Settings,
  Scale,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Globe,
  RefreshCw,
  CreditCard,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import {
  HubHero,
  HubModuleGrid,
  HubPrinciples,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';
import DiscoverableChecklist from '@/components/business/DiscoverableChecklist';
import { type CompletenessResult } from '@/lib/business/completeness';

type Summary = {
  trading_name: string;
  verification_status: string;
  is_verified: boolean;
  is_discoverable: boolean;
  primary_currency: string;
  timezone: string;
  teamTotal: number;
  teamActive: number;
  teamInvited: number;
  openRiads: number;
  purchaseOrders: number;
  documents: number;
  profileCompleteness: number;
  completeness: Record<string, boolean>;
  subscriptionStatus?: string | null;
  subscriptionDaysRemaining?: number | null;
  subscriptionHasAccess?: boolean;
};

export default function MyBusinessHub() {
  return (
    <CompanyRequired>
      <HubInner />
    </CompanyRequired>
  );
}

function HubInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/business/summary?${params}`);
      const data = await res.json();
      setSummary(data.summary || null);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pct = summary?.profileCompleteness ?? 0;
  const s = summary;
  const completeness: CompletenessResult | null = summary
    ? {
        pct: summary.profileCompleteness ?? 0,
        done: 0,
        total: 0,
        checks: Object.entries(summary.completeness || {}).map(([key, ok]) => ({
          key,
          label: key.replace(/_/g, ' '),
          ok: Boolean(ok),
        })),
        map: summary.completeness || {},
      }
    : null;

  const modules: HubModule[] = [
    {
      href: '/dashboard/my-business/profile',
      icon: Building2,
      code: '01',
      title: 'Profile',
      desc: 'Trading name, contacts, industry, location, certifications, wallet.',
      accent: 'from-violet-50 to-white border-violet-100',
      metric: loading ? '—' : `${pct}%`,
      metricLabel: 'complete',
    },
    {
      href: '/dashboard/my-business/team',
      icon: Users,
      code: '02',
      title: 'Team',
      desc: 'Invite members, assign roles, manage access rights.',
      accent: 'from-sky-50 to-white border-sky-100',
      metric: s?.teamActive ?? '—',
      metricLabel: 'active',
    },
    {
      href: '/dashboard/my-business/billing',
      icon: CreditCard,
      code: '03',
      title: 'Billing',
      desc: '30-day free trial, then R299/mo via Paystack (save up to 30% prepaid).',
      accent: 'from-amber-50 to-white border-amber-100',
      metric: loading
        ? '—'
        : s?.subscriptionStatus === 'lifetime'
          ? 'Free'
          : s?.subscriptionStatus === 'trial'
            ? s.subscriptionDaysRemaining != null
              ? `${s.subscriptionDaysRemaining}d`
              : 'Trial'
            : s?.subscriptionStatus === 'active'
              ? 'Active'
              : s?.subscriptionHasAccess
                ? 'OK'
                : 'Pay',
      metricLabel:
        s?.subscriptionStatus === 'lifetime'
          ? 'lifetime'
          : s?.subscriptionStatus === 'trial'
            ? 'trial left'
            : s?.subscriptionStatus === 'active'
              ? 'plan'
              : 'subscribe',
    },
    {
      href: '/dashboard/my-business/settings',
      icon: Settings,
      code: '04',
      title: 'Settings',
      desc: 'Timezone, currency, notifications, discoverability.',
      accent: 'from-cyan-50 to-white border-cyan-100',
    },
    {
      href: '/dashboard/my-business/legal',
      icon: ShieldCheck,
      code: '05',
      title: 'Legal',
      desc: 'Registration, B-BBEE, tax, regulatory posture.',
      accent: 'from-emerald-50 to-white border-emerald-100',
    },
    {
      href: '/dashboard/my-business/documents',
      icon: FileText,
      code: '06',
      title: 'Documents',
      desc: 'Company files, policies, and contracts vault.',
      accent: 'from-amber-50 to-white border-amber-100',
      metric: s?.documents ?? '—',
      metricLabel: 'files',
    },
    {
      href: '/dashboard/my-business/projects',
      icon: FolderOpen,
      code: '07',
      title: 'Projects',
      desc: 'Strategic initiatives and internal workstreams.',
      accent: 'from-rose-50 to-white border-rose-100',
    },
    {
      href: '/dashboard/my-business/riad-log',
      icon: Scale,
      code: '08',
      title: 'RIAD',
      desc: 'Internal risks, issues, actions, and decisions.',
      accent: 'from-slate-50 to-white border-slate-200',
      metric: s?.openRiads ?? '—',
      metricLabel: 'open',
    },
    {
      href: '/dashboard/my-business/trust',
      icon: CheckCircle2,
      code: '09',
      title: 'Trust',
      desc: 'OTIFEF, peer stars, and how the trust score is built.',
      accent: 'from-emerald-50 to-white border-emerald-100',
    },
    {
      href: '/dashboard/my-business/founding-waitlist',
      icon: UserPlus,
      code: '10',
      title: 'Founding waitlist',
      desc: 'Platform ops: manage homepage waitlist when founding slots are full.',
      accent: 'from-violet-50 to-white border-violet-100',
    },
  ];

  return (
    <BusinessPage>
      <RelationshipHeader
        eyebrow="Company workspace"
        title="My business"
        titleAccent="Command"
        description="One precision control room for identity, team, compliance, documents, and settings — membership-checked and synced to Supabase."
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
            <Link
              href="/dashboard/my-business/profile"
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Building2 className="w-4 h-4" /> Edit profile
            </Link>
            <Link
              href="/dashboard/my-business/team"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <UserPlus className="w-4 h-4" /> Invite team
            </Link>
          </div>
        }
      />

      {!loading && completeness ? (
        <div className="mb-5">
          <DiscoverableChecklist
            completeness={completeness}
            isDiscoverable={s?.is_discoverable}
          />
        </div>
      ) : null}

      <HubHero
        pill="Live identity · profile → team"
        title={s?.trading_name || 'Your company, mastered.'}
        description="A complete, verified profile is the foundation of trust across CRM, SRM, and on-chain flows. Invite with roles. Every change writes through to Supabase."
        stats={[
          {
            label: 'Profile',
            value: loading ? '—' : `${pct}%`,
            valueClass: 'text-[#00b4d8]',
          },
          {
            label: 'Team',
            value: loading ? '—' : s?.teamActive ?? 0,
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Open RIAD',
            value: loading ? '—' : s?.openRiads ?? 0,
            valueClass: 'text-amber-600',
          },
        ]}
      />

      <HubTelemetryGrid>
        <TelemetryCard
          label="Profile complete"
          value={loading ? '—' : `${pct}%`}
          sub={pct >= 80 ? 'World class' : pct >= 50 ? 'Building' : 'Needs attention'}
          accent={pct >= 80 ? 'emerald' : pct >= 50 ? 'cyan' : 'amber'}
          icon={CheckCircle2}
          href="/dashboard/my-business/profile"
        />
        <TelemetryCard
          label="Team active"
          value={s?.teamActive ?? 0}
          sub={`${s?.teamInvited ?? 0} invited · ${s?.teamTotal ?? 0} total`}
          accent="sky"
          icon={Users}
          href="/dashboard/my-business/team"
        />
        <TelemetryCard
          label="Verification"
          value={s?.is_verified ? 'Verified' : 'Pending'}
          sub={s?.verification_status || 'unverified'}
          accent={s?.is_verified ? 'emerald' : 'amber'}
          icon={ShieldCheck}
          href="/dashboard/my-business/profile"
        />
        <TelemetryCard
          label="Discoverable"
          value={s?.is_discoverable === false ? 'Off' : 'On'}
          sub="Network visibility"
          accent="cyan"
          icon={Globe}
          href="/dashboard/my-business/settings"
        />
        <TelemetryCard
          label="Documents"
          value={s?.documents ?? 0}
          sub="Company vault"
          accent="violet"
          icon={FileText}
          href="/dashboard/my-business/documents"
        />
        <TelemetryCard
          label="Open RIADs"
          value={s?.openRiads ?? 0}
          sub="Company risks"
          accent={(s?.openRiads || 0) > 0 ? 'amber' : 'slate'}
          icon={AlertTriangle}
          href="/dashboard/my-business/riad-log"
        />
      </HubTelemetryGrid>

      {/* Completeness checklist */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-800">Profile integrity</h3>
            <div className="text-xs text-neutral-500 mt-0.5">
              {s?.primary_currency || 'ZAR'} · {s?.timezone || 'Africa/Johannesburg'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black tracking-tighter text-slate-900 tabular-nums">
              {pct}%
            </div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
              complete
            </div>
          </div>
        </div>
        <div className="h-2 rounded-full bg-neutral-100 overflow-hidden mb-5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#00b4d8] to-[#0077b6] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {Object.entries(s?.completeness || {}).map(([k, ok]) => (
            <div
              key={k}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                ok
                  ? 'border-emerald-100 bg-emerald-50/50 text-emerald-900'
                  : 'border-neutral-100 bg-neutral-50 text-neutral-500'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-neutral-300'}`}
              />
              {labelFor(k)}
            </div>
          ))}
        </div>
      </div>

      <HubModuleGrid modules={modules} />

      <HubPrinciples
        items={[
          {
            title: 'Identity first',
            body: 'A complete, verified profile is the foundation of trust across CRM, SRM, and on-chain flows.',
          },
          {
            title: 'Least privilege team',
            body: 'Invite with roles. Every member is membership-checked against company scope.',
          },
          {
            title: 'Synced always',
            body: 'Profile, settings, and team changes write through APIs to Supabase — no local-only drift.',
          },
        ]}
      />
    </BusinessPage>
  );
}

function labelFor(k: string) {
  const map: Record<string, string> = {
    trading_name: 'Trading name',
    legal_name: 'Legal name',
    email: 'Email',
    contact: 'Contact',
    industry: 'Industry',
    location: 'Location',
    address: 'Address',
    registration: 'Reg / VAT',
    certs: 'Certifications',
    wallet: 'Wallet',
  };
  return map[k] || k;
}
