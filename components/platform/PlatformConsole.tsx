'use client';

/**
 * SupplierAdvisor platform admin console — system + management reports.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  Network,
  RefreshCw,
  Server,
  Shield,
  Users2,
  Wallet,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import {
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';
import { setSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

export const PLATFORM_NAV: readonly NavItem[] = [
  { href: '/dashboard/platform', label: 'Console', exact: true },
  { href: '/dashboard/platform/system', label: 'System' },
  { href: '/dashboard/platform/management', label: 'Management' },
  { href: '/dashboard/my-business/ops', label: 'Ops board' },
  { href: '/dashboard/my-business/platform', label: 'Gov control' },
] as const;

type SystemReport = {
  at?: string;
  company?: { id?: number | null; trading_name?: string; owners?: string[] };
  deploy?: { commitShort?: string; commit?: string; env?: string };
  health?: {
    ok?: boolean;
    score?: number;
    blockers?: string[];
    warnings?: string[];
  };
  integrations?: Record<string, boolean>;
  paystack?: {
    lastAt?: string | null;
    ageHours?: number | null;
    last24hCount?: number;
    stale?: boolean;
    status?: string;
  };
  schema?: Record<string, boolean | null>;
  settleLive?: { ok?: boolean; smokePath?: string };
  cipc?: {
    paidNotBadged?: number;
    slaBreaches?: number;
    sample?: Array<{ id: number; name: string | null; hours: number | null }>;
  };
  tables?: Array<{
    name: string;
    ok: boolean;
    count: number | null;
    error?: string;
  }>;
};

type ManagementReport = {
  at?: string;
  companies?: {
    total?: number;
    discoverable?: number;
    withActiveMembers?: number;
    new7d?: number;
    new30d?: number;
    bySubscription?: Record<string, number>;
    byVerification?: Record<string, number>;
  };
  people?: {
    activeMemberships?: number;
    distinctUsers?: number;
    owners?: number;
    invitesPending?: number;
  };
  network?: {
    connectionsActive?: number;
    connectionsPending?: number;
    invites24h?: number;
    marketplaceListings?: number | null;
  };
  commercial?: {
    trial?: number;
    activePaid?: number;
    lifetime?: number;
    pastDueOrCancelled?: number;
    foundingWaitlist?: number | null;
  };
  trade?: {
    activity24h?: number;
    firstTrade24h?: number;
    claimsPending?: number;
    claimsConfirmed24h?: number;
    ratingsPublished24h?: number;
    posOpen?: number | null;
  };
  modules?: {
    schoolsEnabled?: number;
    healthEnabled?: number;
    fieldgraphEnabled?: number;
    quarrygraphEnabled?: number;
    fitgraphEnabled?: number;
  };
  recentCompanies?: Array<{
    id: number;
    trading_name: string | null;
    subscription_status: string | null;
    verification_status: string | null;
    created_at: string | null;
    city: string | null;
    country: string | null;
  }>;
  opsAnalytics?: Record<string, number>;
};

type ConsoleData = {
  access?: { ok?: boolean; via?: string | null; companyId?: number | null };
  company?: { id?: number; trading_name?: string | null } | null;
  system?: SystemReport;
  management?: ManagementReport;
  ensure?: { created?: boolean; companyId?: number; ownersAttached?: string[] } | null;
  owner_emails?: string[];
};

function MetricCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const tones = {
    default: 'border-slate-200 bg-white',
    good: 'border-emerald-200 bg-emerald-50/60',
    warn: 'border-amber-200 bg-amber-50/60',
    bad: 'border-rose-200 bg-rose-50/60',
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${tones[tone]}`}>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black tabular-nums tracking-tight text-slate-900">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] font-medium text-slate-500">{hint}</div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#00b4d8]" />
          <h2 className="text-sm font-black text-slate-900">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function BoolPill({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-rose-200 bg-rose-50 text-rose-800'
      }`}
    >
      {ok ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <AlertTriangle className="h-3 w-3" />
      )}
      {label}
    </span>
  );
}

function DistTable({ data }: { data?: Record<string, number> }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return <p className="text-sm text-slate-500">No data yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
            <th className="pb-2 pr-3">Status</th>
            <th className="pb-2 text-right">Count</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td className="py-1.5 pr-3 font-semibold text-slate-800">{k}</td>
              <td className="py-1.5 text-right font-black tabular-nums text-slate-900">
                {v}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PlatformNav() {
  return <RelationshipNav items={PLATFORM_NAV} />;
}

export function usePlatformConsole() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const privyEmail =
    user?.email?.address ||
    (user as { google?: { email?: string } } | null)?.google?.email ||
    null;

  const [data, setData] = useState<ConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ ensure: '1' });
      if (privyUserId) q.set('privyUserId', privyUserId);
      if (privyEmail) q.set('email', String(privyEmail).toLowerCase());
      const res = await fetch(`/api/system/platform-console?${q}`, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          ...(privyUserId ? { 'x-privy-user-id': privyUserId } : {}),
          ...(privyEmail ? { 'x-platform-email': String(privyEmail).toLowerCase() } : {}),
        },
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        setError(json.error || 'Not authorised');
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load console');
      setForbidden(false);
      setData(json);
      if (json.ensure?.created) {
        toast.success('SupplierAdvisor platform company created');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [privyUserId, privyEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  const switchToPlatform = () => {
    const id = data?.company?.id || data?.access?.companyId || data?.ensure?.companyId;
    if (!id) {
      toast.error('Platform company not ready yet — refresh');
      return;
    }
    setSelectedCompanyId(Number(id), {
      name: data?.company?.trading_name || 'SupplierAdvisor',
    });
    toast.success('Switched to SupplierAdvisor workspace');
    window.location.href = '/dashboard/platform';
  };

  return { data, loading, error, forbidden, load, switchToPlatform };
}

export function PlatformShell({
  title,
  description,
  children,
  onRefresh,
  loading,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onRefresh?: () => void;
  loading?: boolean;
}) {
  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard"
        backLabel="Control Tower"
        eyebrow="Platform · SupplierAdvisor"
        title={title}
        titleAccent="console"
        description={description}
        action={
          onRefresh ? (
            <button
              type="button"
              onClick={() => onRefresh()}
              className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          ) : undefined
        }
      />
      <PlatformNav />
      {children}
    </RelationshipPage>
  );
}

export function PlatformGateState({
  loading,
  forbidden,
  error,
  onRetry,
}: {
  loading: boolean;
  forbidden: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }
  if (forbidden || error) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <Shield className="mx-auto mb-3 h-10 w-10 text-slate-400" />
        <p className="font-black text-slate-900">
          {forbidden ? 'Platform console locked' : 'Could not load'}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          {error ||
            'This admin portal is only for SupplierAdvisor owners (craig@bigfivefoods.com and craig@bigfivegroup.africa).'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="btn-secondary mt-6 !py-2 !px-4 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }
  return null;
}

export function PlatformOverview({
  data,
  onSwitch,
}: {
  data: ConsoleData;
  onSwitch: () => void;
}) {
  const sys = data.system;
  const mgt = data.management;
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50 via-white to-violet-50 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0077b6]">
              Control plane company
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {data.company?.trading_name || 'SupplierAdvisor'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Admin and management console for the entire SupplierAdvisor® system —
              system health, commercial footprint, network growth, and ops readiness.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Owners:{' '}
              <span className="font-semibold text-slate-700">
                {(data.owner_emails || []).join(' · ') ||
                  'craig@bigfivefoods.com · craig@bigfivegroup.africa'}
              </span>
              {data.access?.via ? (
                <span className="ml-2 rounded-full bg-white px-2 py-0.5 font-bold text-[#0077b6] border border-cyan-100">
                  via {data.access.via}
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onSwitch}
            className="btn-primary !py-2.5 !px-4 text-sm"
          >
            Open as workspace
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="System health"
          value={sys?.health?.score != null ? `${sys.health.score}` : '—'}
          hint={sys?.health?.ok ? 'Ready' : 'Blockers present'}
          tone={sys?.health?.ok ? 'good' : 'bad'}
        />
        <MetricCard
          label="Companies"
          value={mgt?.companies?.total ?? '—'}
          hint={`+${mgt?.companies?.new7d ?? 0} in 7d`}
        />
        <MetricCard
          label="Active people"
          value={mgt?.people?.distinctUsers ?? '—'}
          hint={`${mgt?.people?.owners ?? 0} owners`}
        />
        <MetricCard
          label="Activity 24h"
          value={mgt?.trade?.activity24h ?? '—'}
          hint={`${mgt?.trade?.firstTrade24h ?? 0} first trades`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Quick links" icon={Workflow}>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              {
                href: '/dashboard/platform/system',
                title: 'System reports',
                body: 'Integrations, schema, Paystack, CIPC SLA, deploy identity.',
              },
              {
                href: '/dashboard/platform/management',
                title: 'Management reports',
                body: 'Companies, subscriptions, network, trade funnel, modules.',
              },
              {
                href: '/dashboard/my-business/ops',
                title: 'Ops board',
                body: 'Paystack pulse and production readiness checklist.',
              },
              {
                href: '/dashboard/my-business/platform',
                title: 'Gov activation',
                body: 'Pending education / health department approvals.',
              },
            ].map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:border-[#00b4d8] hover:bg-cyan-50/40"
              >
                <div className="text-sm font-black text-slate-900">{c.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{c.body}</p>
              </Link>
            ))}
          </div>
        </Section>

        <Section title="Readiness" icon={Server}>
          {sys?.health?.blockers?.length ? (
            <ul className="mb-3 space-y-1.5">
              {sys.health.blockers.map((b) => (
                <li
                  key={b}
                  className="flex gap-2 text-sm text-rose-800"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> No critical blockers
            </p>
          )}
          {sys?.health?.warnings?.length ? (
            <ul className="space-y-1.5">
              {sys.health.warnings.slice(0, 6).map((w) => (
                <li key={w} className="flex gap-2 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No warnings.</p>
          )}
          <p className="mt-4 text-[11px] text-slate-400">
            Deploy {sys?.deploy?.commitShort || sys?.deploy?.commit || '—'} ·
            report {sys?.at ? new Date(sys.at).toLocaleString() : '—'}
          </p>
        </Section>
      </div>
    </div>
  );
}

export function SystemReportView({ system }: { system?: SystemReport }) {
  if (!system) return null;
  const integ = system.integrations || {};
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Health score"
          value={system.health?.score ?? '—'}
          tone={system.health?.ok ? 'good' : 'bad'}
        />
        <MetricCard
          label="CIPC paid not badged"
          value={system.cipc?.paidNotBadged ?? 0}
          tone={(system.cipc?.slaBreaches || 0) > 0 ? 'warn' : 'default'}
          hint={`${system.cipc?.slaBreaches ?? 0} SLA breaches`}
        />
        <MetricCard
          label="Paystack 24h"
          value={system.paystack?.last24hCount ?? 0}
          hint={
            system.paystack?.stale
              ? 'Webhook quiet'
              : system.paystack?.lastAt
                ? `Last ${system.paystack.lastAt}`
                : 'No events'
          }
          tone={system.paystack?.stale ? 'warn' : 'good'}
        />
        <MetricCard
          label="Settle path"
          value={system.settleLive?.ok ? 'Live' : 'Incomplete'}
          tone={system.settleLive?.ok ? 'good' : 'warn'}
        />
      </div>

      <Section title="Integrations" icon={Server}>
        <div className="flex flex-wrap gap-2">
          <BoolPill ok={integ.paystackSecret} label="Paystack secret" />
          <BoolPill ok={integ.paystackPublic} label="Paystack public" />
          <BoolPill ok={integ.resend} label="Resend email" />
          <BoolPill ok={integ.cronSecret} label="Cron secret" />
          <BoolPill ok={integ.verifynow} label="VerifyNow" />
          <BoolPill ok={integ.xai} label="xAI / SAM" />
          <BoolPill ok={integ.opsAlertEmail} label="Ops alert email" />
          <BoolPill ok={integ.twilio} label="Twilio" />
          <BoolPill ok={integ.privy} label="Privy" />
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Schema probes" icon={Workflow}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(system.schema || {}).map(([k, v]) => (
              <BoolPill
                key={k}
                ok={v === true}
                label={`${k}${v === null ? ' ?' : ''}`}
              />
            ))}
          </div>
        </Section>
        <Section title="Core tables" icon={Building2}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="pb-2">Table</th>
                  <th className="pb-2">OK</th>
                  <th className="pb-2 text-right">Rows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(system.tables || []).map((t) => (
                  <tr key={t.name}>
                    <td className="py-1.5 font-mono text-xs text-slate-800">
                      {t.name}
                    </td>
                    <td className="py-1.5">
                      {t.ok ? (
                        <span className="text-emerald-700 font-bold text-xs">yes</span>
                      ) : (
                        <span className="text-rose-700 font-bold text-xs">no</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-semibold">
                      {t.count ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {(system.cipc?.sample?.length || 0) > 0 && (
        <Section title="CIPC SLA sample" icon={AlertTriangle}>
          <ul className="divide-y divide-slate-100">
            {system.cipc!.sample!.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="font-semibold text-slate-800">
                  {s.name || `Company #${s.id}`}
                </span>
                <span className="text-xs font-bold text-amber-800">
                  {s.hours != null ? `${Math.round(s.hours)}h since paid` : 'paid'}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Deploy identity" icon={Server}>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-black uppercase text-slate-400">Commit</dt>
            <dd className="font-mono font-semibold text-slate-900">
              {system.deploy?.commitShort || system.deploy?.commit || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-black uppercase text-slate-400">
              Report time
            </dt>
            <dd className="font-semibold text-slate-900">
              {system.at ? new Date(system.at).toLocaleString() : '—'}
            </dd>
          </div>
        </dl>
      </Section>
    </div>
  );
}

export function ManagementReportView({
  management,
}: {
  management?: ManagementReport;
}) {
  if (!management) return null;
  const c = management.companies;
  const p = management.people;
  const n = management.network;
  const com = management.commercial;
  const t = management.trade;
  const mod = management.modules;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total companies" value={c?.total ?? '—'} />
        <MetricCard
          label="With members"
          value={c?.withActiveMembers ?? '—'}
          hint={`${c?.discoverable ?? 0} discoverable`}
        />
        <MetricCard label="New 7d" value={c?.new7d ?? 0} hint={`${c?.new30d ?? 0} in 30d`} />
        <MetricCard
          label="Memberships"
          value={p?.activeMemberships ?? '—'}
          hint={`${p?.invitesPending ?? 0} invites pending`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Commercial" icon={Wallet}>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Trial" value={com?.trial ?? 0} />
            <MetricCard label="Active paid" value={com?.activePaid ?? 0} tone="good" />
            <MetricCard label="Lifetime" value={com?.lifetime ?? 0} />
            <MetricCard
              label="Past due / cancel"
              value={com?.pastDueOrCancelled ?? 0}
              tone={(com?.pastDueOrCancelled || 0) > 0 ? 'warn' : 'default'}
            />
          </div>
          {com?.foundingWaitlist != null ? (
            <p className="mt-3 text-xs text-slate-500">
              Founding waitlist: <strong>{com.foundingWaitlist}</strong>
            </p>
          ) : null}
        </Section>

        <Section title="Network" icon={Network}>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Active edges" value={n?.connectionsActive ?? 0} />
            <MetricCard label="Pending" value={n?.connectionsPending ?? 0} />
            <MetricCard label="Invites 24h" value={n?.invites24h ?? 0} />
            <MetricCard
              label="Listings"
              value={n?.marketplaceListings ?? '—'}
            />
          </div>
        </Section>

        <Section title="Trade funnel" icon={Activity}>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Activity 24h" value={t?.activity24h ?? 0} />
            <MetricCard label="First trade 24h" value={t?.firstTrade24h ?? 0} />
            <MetricCard
              label="Claims pending"
              value={t?.claimsPending ?? 0}
              tone={(t?.claimsPending || 0) > 0 ? 'warn' : 'default'}
            />
            <MetricCard label="Claims confirmed" value={t?.claimsConfirmed24h ?? 0} />
            <MetricCard label="Ratings 24h" value={t?.ratingsPublished24h ?? 0} />
            <MetricCard label="Open POs" value={t?.posOpen ?? '—'} />
          </div>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Subscription mix" icon={Wallet}>
          <DistTable data={c?.bySubscription} />
        </Section>
        <Section title="Verification mix" icon={Shield}>
          <DistTable data={c?.byVerification} />
        </Section>
        <Section title="Industry modules on" icon={Workflow}>
          <div className="space-y-2 text-sm">
            {[
              ['Schools / NSNP', mod?.schoolsEnabled],
              ['Health / DoH', mod?.healthEnabled],
              ['Fieldgraph®', mod?.fieldgraphEnabled],
              ['Quarrygraph®', mod?.quarrygraphEnabled],
              ['Fitgraph®', mod?.fitgraphEnabled],
            ].map(([label, val]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <span className="font-semibold text-slate-800">{label}</span>
                <span className="font-black tabular-nums text-slate-900">
                  {val ?? 0}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="People" icon={Users2}>
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricCard label="Distinct users" value={p?.distinctUsers ?? 0} />
          <MetricCard label="Active memberships" value={p?.activeMemberships ?? 0} />
          <MetricCard label="Owners" value={p?.owners ?? 0} />
          <MetricCard label="Invites pending" value={p?.invitesPending ?? 0} />
        </div>
      </Section>

      <Section title="Recent companies" icon={Building2}>
        {(management.recentCompanies || []).length === 0 ? (
          <p className="text-sm text-slate-500">No companies loaded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="pb-2 pr-2">Company</th>
                  <th className="pb-2 pr-2">Sub</th>
                  <th className="pb-2 pr-2">Verify</th>
                  <th className="pb-2 pr-2">Place</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {management.recentCompanies!.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 pr-2 font-semibold text-slate-900">
                      {row.trading_name || `#${row.id}`}
                    </td>
                    <td className="py-2 pr-2 text-xs font-bold text-slate-600">
                      {row.subscription_status || '—'}
                    </td>
                    <td className="py-2 pr-2 text-xs font-bold text-slate-600">
                      {row.verification_status || '—'}
                    </td>
                    <td className="py-2 pr-2 text-xs text-slate-500">
                      {[row.city, row.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="py-2 text-xs text-slate-500">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

