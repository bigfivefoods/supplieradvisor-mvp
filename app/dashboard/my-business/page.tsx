'use client';

/**
 * Company command tower — identity, workspace, people, trust, money, govern.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  ShieldCheck,
  FileText,
  Settings,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Network,
  LayoutGrid,
  ArrowRight,
  Sparkles,
  Handshake,
  BadgeCheck,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { RelationshipHeader, SectionLabel } from '@/components/relationship/RelationshipChrome';
import {
  HubModuleGrid,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';
import DiscoverableChecklist from '@/components/business/DiscoverableChecklist';
import {
  DISCOVERABLE_MIN_COMPLETENESS_PCT,
  type CompletenessResult,
} from '@/lib/business/completeness';

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
  groupInvitesPending?: number;
};

type GroupDef = {
  id: string;
  title: string;
  blurb: string;
  modules: HubModule[];
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

  const billingMetric = loading
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
            : 'Pay';
  const billingLabel =
    s?.subscriptionStatus === 'lifetime'
      ? 'lifetime'
      : s?.subscriptionStatus === 'trial'
        ? 'trial left'
        : s?.subscriptionStatus === 'active'
          ? 'plan'
          : 'subscribe';

  const groups: GroupDef[] = [
    {
      id: 'identity',
      title: '1 · Identity',
      blurb: 'Who you are on the network — profile, documents, group structure.',
      modules: [
        {
          href: '/dashboard/my-business/profile',
          icon: Building2,
          code: '01',
          title: 'Profile',
          desc: 'Trading name, legal identity, contacts, banking, certifications.',
          accent: 'from-violet-50 to-white border-violet-100',
          metric: loading ? '—' : `${pct}%`,
          metricLabel: 'complete',
        },
        {
          href: '/dashboard/my-business/documents',
          icon: FileText,
          code: '02',
          title: 'Documents',
          desc: 'Company files, policies, certificates, and contracts.',
          accent: 'from-sky-50 to-white border-sky-100',
          metric: s?.documents ?? '—',
          metricLabel: 'files',
        },
        {
          href: '/dashboard/my-business/group',
          icon: Network,
          code: '03',
          title: 'Group',
          desc: 'Holding company, subsidiaries, associations — accept invites.',
          accent: 'from-indigo-50 to-white border-indigo-100',
          metric:
            (s?.groupInvitesPending || 0) > 0
              ? s?.groupInvitesPending
              : loading
                ? '—'
                : '0',
          metricLabel:
            (s?.groupInvitesPending || 0) > 0 ? 'to accept' : 'pending',
        },
      ],
    },
    {
      id: 'workspace',
      title: '2 · Workspace',
      blurb: 'Turn on the hubs you run, then set locale, FY, and discoverability.',
      modules: [
        {
          href: '/dashboard/my-business/modules',
          icon: LayoutGrid,
          code: '04',
          title: 'Modules',
          desc: 'Sector, industry packs, and sidebar hubs — Core OS then verticals.',
          accent: 'from-cyan-50 to-white border-cyan-100',
          metric: 'Setup',
          metricLabel: 'sidebar',
        },
        {
          href: '/dashboard/my-business/settings',
          icon: Settings,
          code: '05',
          title: 'Settings',
          desc: 'Financial year, timezone, currency, payment terms, discoverability.',
          accent: 'from-sky-50 to-white border-sky-100',
        },
      ],
    },
    {
      id: 'people',
      title: '3 · People',
      blurb: 'Invite the team with roles. Least privilege by design.',
      modules: [
        {
          href: '/dashboard/my-business/team',
          icon: Users,
          code: '06',
          title: 'Team',
          desc: 'Invite members, assign roles, choose which modules they see.',
          accent: 'from-sky-50 to-white border-sky-100',
          metric: s?.teamActive ?? '—',
          metricLabel: 'active',
        },
      ],
    },
    {
      id: 'trust',
      title: '4 · Trust',
      blurb: 'Prove legitimacy — CIPC, bank, OTIFEF, peer ratings.',
      modules: [
        {
          href: '/dashboard/my-business/trust',
          icon: BadgeCheck,
          code: '07',
          title: 'Trust score',
          desc: 'How trust is built — OTIFEF, peers, verification.',
          accent: 'from-emerald-50 to-white border-emerald-100',
        },
        {
          href: '/dashboard/my-business/verifications',
          icon: ShieldCheck,
          code: '08',
          title: 'Verify',
          desc: 'CIPC and bank verification status for this company.',
          accent: 'from-teal-50 to-white border-teal-100',
          metric: s?.is_verified ? 'OK' : '—',
          metricLabel: s?.is_verified ? 'verified' : 'pending',
        },
      ],
    },
    {
      id: 'money',
      title: '5 · Money',
      blurb: 'Plan, sales contractors, and referral earnings.',
      modules: [
        {
          href: '/dashboard/my-business/billing',
          icon: CreditCard,
          code: '09',
          title: 'Billing',
          desc: 'Trial, subscription, prepaid options.',
          accent: 'from-amber-50 to-white border-amber-100',
          metric: billingMetric,
          metricLabel: billingLabel,
        },
        {
          href: '/dashboard/my-business/sales-program',
          icon: Handshake,
          code: '10',
          title: 'Sales program',
          desc: 'Contractor portal, commissions, field sellers.',
          accent: 'from-violet-50 to-white border-violet-100',
        },
        {
          href: '/dashboard/my-business/referral-ops',
          icon: Sparkles,
          code: '11',
          title: 'Referrals',
          desc: 'Supply-chain referral earnings and ops.',
          accent: 'from-fuchsia-50 to-white border-fuchsia-100',
        },
      ],
    },
    {
      id: 'govern',
      title: '6 · Govern',
      blurb: 'Risks and production readiness — keep the company sharp.',
      modules: [
        {
          href: '/dashboard/my-business/riad-log',
          icon: AlertTriangle,
          code: '12',
          title: 'Risks',
          desc: 'Internal risks, issues, actions, decisions — plus supplier and customer RIAD.',
          accent: 'from-rose-50 to-white border-rose-100',
          metric: s?.openRiads ?? '—',
          metricLabel: 'open',
        },
        {
          href: '/dashboard/my-business/ops',
          icon: CheckCircle2,
          code: '13',
          title: 'Ops',
          desc: 'P0 readiness and settle health signals.',
          accent: 'from-cyan-50 to-white border-cyan-100',
        },
      ],
    },
  ];

  return (
    <BusinessPage>
      <RelationshipHeader
        eyebrow="Company"
        title="Company"
        titleAccent="overview"
        description="One company record: identity, the modules you run, the people who can see them, then trust and billing."
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
              href="/dashboard/my-business/modules"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <LayoutGrid className="w-4 h-4" /> Modules
            </Link>
          </div>
        }
      />

      <section className="mb-8 rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#0077b6]">
              This company
            </p>
            <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-900">
              {loading ? 'Loading…' : s?.trading_name || 'Your company'}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {s?.primary_currency || 'ZAR'} · {s?.timezone || 'Africa/Johannesburg'}
              {' · '}
              {s?.is_verified ? 'CIPC verified' : 'Verification pending'}
              {' · '}
              {s?.is_discoverable === false ? 'Hidden from the network' : 'Discoverable'}
            </p>
          </div>
          <div className="w-full shrink-0 lg:w-64">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Profile
              </span>
              <span className="text-3xl font-black tabular-nums tracking-tighter text-slate-900">
                {loading ? '—' : `${pct}%`}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00b4d8] to-[#0077b6]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-500">
              {pct >= DISCOVERABLE_MIN_COMPLETENESS_PCT
                ? 'Ready to be found on the network.'
                : 'The checklist under this card is what is still open.'}
            </p>
          </div>
        </div>
        {Object.keys(s?.completeness || {}).length > 0 &&
        (s?.is_discoverable === false || pct >= DISCOVERABLE_MIN_COMPLETENESS_PCT) ? (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
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
        ) : null}
        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-slate-600">
          A supplier or customer starts in your book. When they claim an invite they
          finish their own company profile, and your link stays.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold">
          <Link href="/dashboard/suppliers/add" className="text-[#0077b6] hover:underline">
            Add a supplier
          </Link>
          <span className="text-neutral-300" aria-hidden>
            ·
          </span>
          <Link href="/dashboard/customers/onboard" className="text-[#0077b6] hover:underline">
            Add a customer
          </Link>
          <span className="text-neutral-300" aria-hidden>
            ·
          </span>
          <Link
            href="/dashboard/invite-business"
            className="inline-flex items-center gap-0.5 text-[#0077b6] hover:underline"
          >
            Invite a business <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      {!loading && completeness ? (
        <div className="mb-8">
          <DiscoverableChecklist
            completeness={completeness}
            isDiscoverable={s?.is_discoverable}
          />
        </div>
      ) : null}

      {!loading && (s?.groupInvitesPending || 0) > 0 ? (
        <Link
          href="/dashboard/my-business/group"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3.5 text-sm shadow-sm hover:bg-amber-100/70"
        >
          <div className="min-w-0">
            <p className="font-bold text-amber-950">
              {s!.groupInvitesPending === 1
                ? '1 group / association invitation to accept'
                : `${s!.groupInvitesPending} group / association invitations to accept`}
            </p>
            <p className="mt-0.5 text-xs text-amber-900/80">
              Open Company → Group and accept or decline.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white">
            Review →
          </span>
        </Link>
      ) : null}

      {groups.map((g) => (
        <div key={g.id} className="mb-8">
          <SectionLabel>{g.title}</SectionLabel>
          <p className="text-sm text-neutral-500 mb-3 max-w-2xl">{g.blurb}</p>
          <HubModuleGrid modules={g.modules} />
        </div>
      ))}

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
