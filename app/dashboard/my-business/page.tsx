'use client';

/**
 * Company command tower — identity, modules, people, trust, commercial, ops.
 * World-class setup journey aligned with partner invite-to-complete.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
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

  const groups: GroupDef[] = [
    {
      id: 'identity',
      title: '1 · Identity & structure',
      blurb: 'Who you are on the network — profile, legal entity, group hierarchy.',
      modules: [
        {
          href: '/dashboard/my-business/profile',
          icon: Building2,
          code: '01',
          title: 'Company profile',
          desc: 'Trading name, contacts, industry, location, certifications, wallet.',
          accent: 'from-violet-50 to-white border-violet-100',
          metric: loading ? '—' : `${pct}%`,
          metricLabel: 'complete',
        },
        {
          href: '/dashboard/my-business/legal',
          icon: Scale,
          code: '02',
          title: 'Legal & registration',
          desc: 'Registration, B-BBEE, tax, regulatory posture.',
          accent: 'from-emerald-50 to-white border-emerald-100',
        },
        {
          href: '/dashboard/my-business/group',
          icon: Network,
          code: '03',
          title: 'Group structure',
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
      title: '2 · Workspace modules',
      blurb:
        'Turn on suppliers, customers, inventory, accounting — hide what you do not need.',
      modules: [
        {
          href: '/dashboard/my-business/modules',
          icon: LayoutGrid,
          code: '04',
          title: 'Modules',
          desc: 'Enable trade, ops, finance, people, compliance, intelligence.',
          accent: 'from-cyan-50 to-white border-cyan-100',
          metric: 'Setup',
          metricLabel: 'sidebar',
        },
        {
          href: '/dashboard/my-business/settings',
          icon: Settings,
          code: '05',
          title: 'Settings',
          desc: 'Timezone, currency, payment terms options, discoverability.',
          accent: 'from-sky-50 to-white border-sky-100',
        },
      ],
    },
    {
      id: 'people',
      title: '3 · People & access',
      blurb: 'Invite your team with roles. Least privilege by design.',
      modules: [
        {
          href: '/dashboard/my-business/team',
          icon: Users,
          code: '06',
          title: 'Team',
          desc: 'Invite members, assign roles, manage access rights.',
          accent: 'from-sky-50 to-white border-sky-100',
          metric: s?.teamActive ?? '—',
          metricLabel: 'active',
        },
        {
          href: '/dashboard/my-business/sales-program',
          icon: Handshake,
          code: '07',
          title: 'Sales program',
          desc: 'Contractor portal, commissions, field sellers.',
          accent: 'from-violet-50 to-white border-violet-100',
        },
      ],
    },
    {
      id: 'trust',
      title: '4 · Trust & verification',
      blurb: 'Prove legitimacy — CIPC, bank, OTIFEF, peer ratings.',
      modules: [
        {
          href: '/dashboard/my-business/trust',
          icon: BadgeCheck,
          code: '08',
          title: 'Trust score',
          desc: 'How trust is built — OTIFEF, peers, verification.',
          accent: 'from-emerald-50 to-white border-emerald-100',
        },
        {
          href: '/dashboard/my-business/verifications',
          icon: ShieldCheck,
          code: '09',
          title: 'Verifications',
          desc: 'CIPC / bank verification ops and status.',
          accent: 'from-teal-50 to-white border-teal-100',
          metric: s?.is_verified ? 'OK' : '—',
          metricLabel: s?.is_verified ? 'verified' : 'pending',
        },
      ],
    },
    {
      id: 'commercial',
      title: '5 · Commercial & vault',
      blurb: 'Billing, documents, referrals — keep the company solvent and documented.',
      modules: [
        {
          href: '/dashboard/my-business/billing',
          icon: CreditCard,
          code: '10',
          title: 'Billing',
          desc: 'Trial, subscription, prepaid options.',
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
          href: '/dashboard/my-business/documents',
          icon: FileText,
          code: '11',
          title: 'Documents',
          desc: 'Company files, policies, and contracts vault.',
          accent: 'from-amber-50 to-white border-amber-100',
          metric: s?.documents ?? '—',
          metricLabel: 'files',
        },
        {
          href: '/dashboard/my-business/referral-ops',
          icon: Sparkles,
          code: '12',
          title: 'Referral ops',
          desc: 'Supply-chain referral earnings and ops.',
          accent: 'from-fuchsia-50 to-white border-fuchsia-100',
        },
      ],
    },
    {
      id: 'control',
      title: '6 · Control tower',
      blurb: 'Readiness and risks — keep the company sharp.',
      modules: [
        {
          href: '/dashboard/my-business/ops',
          icon: CheckCircle2,
          code: '13',
          title: 'Ops readiness',
          desc: 'P0 readiness and settle health signals.',
          accent: 'from-cyan-50 to-white border-cyan-100',
        },
        {
          href: '/dashboard/my-business/riad-log',
          icon: AlertTriangle,
          code: '14',
          title: 'Company RIAD',
          desc: 'Internal risks, issues, actions, decisions.',
          accent: 'from-rose-50 to-white border-rose-100',
          metric: s?.openRiads ?? '—',
          metricLabel: 'open',
        },
      ],
    },
  ];

  return (
    <BusinessPage>
      <RelationshipHeader
        eyebrow="Company workspace"
        title="Company"
        titleAccent="setup"
        description="World-class company control: identity → modules → team → trust → billing. Invite customers or suppliers onto the platform — they finish their own company setup while staying linked to your book."
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

      {!loading && completeness ? (
        <div className="mb-5">
          <DiscoverableChecklist
            completeness={completeness}
            isDiscoverable={s?.is_discoverable}
          />
        </div>
      ) : null}

      {/* Setup journey */}
      <div className="mb-6 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50/50 to-cyan-50 p-5 sm:p-6">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#0077b6] mb-3">
          Recommended company journey
        </p>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {[
            {
              n: '1',
              t: 'Identity',
              d: 'Profile ≥ 80%',
              href: '/dashboard/my-business/profile',
            },
            {
              n: '2',
              t: 'Modules',
              d: 'Enable trade stack',
              href: '/dashboard/my-business/modules',
            },
            {
              n: '3',
              t: 'Team',
              d: 'Invite with roles',
              href: '/dashboard/my-business/team',
            },
            {
              n: '4',
              t: 'Trust',
              d: 'Verify & discover',
              href: '/dashboard/my-business/trust',
            },
            {
              n: '5',
              t: 'Invite partners',
              d: 'They complete setup',
              href: '/dashboard/invite-business',
            },
          ].map((step) => (
            <Link
              key={step.n}
              href={step.href}
              className="rounded-2xl border border-white bg-white/90 px-3 py-3 shadow-sm hover:border-[#00b4d8]/40 transition-colors"
            >
              <span className="text-[10px] font-black text-[#00b4d8]">
                {step.n}
              </span>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {step.t}
              </div>
              <div className="text-[11px] text-neutral-500">{step.d}</div>
            </Link>
          ))}
        </ol>
        <p className="text-xs text-slate-600 mt-4 max-w-3xl leading-relaxed">
          <strong>Partner invite model:</strong> you can start a supplier or customer
          in <em>your</em> book, then invite them to SupplierAdvisor. They complete
          their own company profile, modules, team, and billing — your CRM/SRM link
          stays intact when they claim.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/dashboard/suppliers/add"
            className="text-xs font-bold text-[#0077b6] underline"
          >
            Add & invite supplier
          </Link>
          <span className="text-neutral-300">·</span>
          <Link
            href="/dashboard/customers/onboard"
            className="text-xs font-bold text-[#0077b6] underline"
          >
            Add & invite customer
          </Link>
          <span className="text-neutral-300">·</span>
          <Link
            href="/dashboard/invite-business"
            className="text-xs font-bold text-[#0077b6] underline inline-flex items-center gap-0.5"
          >
            Invite any business <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

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

      <HubHero
        pill="Live identity · profile → modules → team"
        title={s?.trading_name || 'Your company, mastered.'}
        description="A complete, verified profile plus the right modules is the foundation of trust across CRM, SRM, and on-chain flows."
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
          label="Modules"
          value="Setup"
          sub="Sidebar capabilities"
          accent="cyan"
          icon={LayoutGrid}
          href="/dashboard/my-business/modules"
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
          href="/dashboard/my-business/verifications"
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
        <TelemetryCard
          label="Invite partner"
          value="Go"
          sub="Customer or supplier"
          accent="emerald"
          icon={UserPlus}
          href="/dashboard/invite-business"
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

      {groups.map((g) => (
        <div key={g.id} className="mb-8">
          <SectionLabel>{g.title}</SectionLabel>
          <p className="text-sm text-neutral-500 mb-3 max-w-2xl">{g.blurb}</p>
          <HubModuleGrid modules={g.modules} />
        </div>
      ))}

      <HubPrinciples
        items={[
          {
            title: 'Identity first',
            body: 'A complete, verified profile is the foundation of trust across CRM, SRM, and on-chain flows.',
          },
          {
            title: 'Modules that match the business',
            body: 'Enable only the capabilities you run — less noise, faster first trade.',
          },
          {
            title: 'Invite to complete',
            body: 'Start a partner in your book, invite them onto the platform, and let them finish their own company setup without losing your link.',
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
