'use client';

/**
 * SupplierAdvisor platform admin console — system + management reports.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  Loader2,
  Network,
  RefreshCw,
  Search,
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
  { href: '/dashboard/platform/members', label: 'SA Members' },
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
    physiographEnabled?: number;
    dentalgraphEnabled?: number;
    medicalgraphEnabled?: number;
    psychiatrygraphEnabled?: number;
    hiregraphEnabled?: number;
    retailgraphEnabled?: number;
  };
  recentCompanies?: Array<{
    id: number;
    trading_name: string | null;
    company_name?: string | null;
    contact_name?: string | null;
    email?: string | null;
    subscription_status: string | null;
    verification_status: string | null;
    created_at: string | null;
    city: string | null;
    country: string | null;
    owner_emails?: string[];
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
                href: '/dashboard/platform/members',
                title: 'SA Member access',
                body: 'Who opened the consumer app, last login, PWA/site, time in session.',
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
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const privyEmail =
    user?.email?.address ||
    (user as { google?: { email?: string } } | null)?.google?.email ||
    null;
  const [signupQuery, setSignupQuery] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const signups = management?.recentCompanies || [];
  const filteredSignups = useMemo(() => {
    const q = signupQuery.trim().toLowerCase();
    if (!q) return signups;
    return signups.filter((row) => {
      const hay = [
        row.trading_name,
        row.company_name,
        row.contact_name,
        row.email,
        row.subscription_status,
        row.verification_status,
        row.city,
        row.country,
        String(row.id),
        ...(row.owner_emails || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [signups, signupQuery]);

  const downloadLandscapePdf = async () => {
    setPdfBusy(true);
    try {
      const q = new URLSearchParams();
      if (privyUserId) q.set('privyUserId', privyUserId);
      if (privyEmail) q.set('email', String(privyEmail).toLowerCase());
      const res = await fetch(
        `/api/system/platform-console/management-pdf?${q}`,
        {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: {
            ...(privyUserId ? { 'x-privy-user-id': privyUserId } : {}),
            ...(privyEmail
              ? { 'x-platform-email': String(privyEmail).toLowerCase() }
              : {}),
          },
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'PDF failed');
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download =
        res.headers
          .get('Content-Disposition')
          ?.match(/filename="([^"]+)"/)?.[1] ||
        'SupplierAdvisor-Platform-Management-A4-Landscape.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('A4 landscape platform management report downloaded');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'PDF failed');
    } finally {
      setPdfBusy(false);
    }
  };

  if (!management) return null;
  const c = management.companies;
  const p = management.people;
  const n = management.network;
  const com = management.commercial;
  const t = management.trade;
  const mod = management.modules;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-sky-200 bg-gradient-to-r from-[#0077b6] via-[#00b4d8] to-emerald-600 px-4 py-3 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/80">
            Platform pack · one-page A4 landscape
          </p>
          <h2 className="text-base sm:text-lg font-black leading-tight">
            Management report pack
          </h2>
          <p className="text-xs text-white/90 mt-0.5">
            Sign-ups, commercial, network, trade funnel and Advisor adoption —
            download as a board-ready one-pager.
          </p>
        </div>
        <button
          type="button"
          disabled={pdfBusy}
          onClick={() => void downloadLandscapePdf()}
          className="inline-flex items-center gap-1.5 rounded-full bg-white text-[#0077b6] px-3 py-2 text-xs font-black hover:bg-sky-50 disabled:opacity-50"
        >
          {pdfBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Download A4 landscape PDF
        </button>
      </div>

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
              ['CropAdvisor®', mod?.fieldgraphEnabled],
              ['QuarryAdvisor®', mod?.quarrygraphEnabled],
              ['GymAdvisor®', mod?.fitgraphEnabled],
              ['PhysioAdvisor®', mod?.physiographEnabled],
              ['DentalAdvisor®', mod?.dentalgraphEnabled],
              ['MedicalAdvisor®', mod?.medicalgraphEnabled],
              ['PsychiatryAdvisor®', mod?.psychiatrygraphEnabled],
              ['HireAdvisor®', mod?.hiregraphEnabled],
              ['RetailAdvisor®', mod?.retailgraphEnabled],
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

      <Section
        title="Sign-ups · latest first"
        icon={Building2}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-[11px] text-slate-500">
            {signups.length} companies
            {signupQuery.trim()
              ? ` · showing ${filteredSignups.length} match${filteredSignups.length === 1 ? '' : 'es'}`
              : ' · newest at the top'}
          </p>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="search"
              value={signupQuery}
              onChange={(e) => setSignupQuery(e.target.value)}
              placeholder="Search name, email, city…"
              className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-sm"
            />
          </div>
        </div>
        {signups.length === 0 ? (
          <p className="text-sm text-slate-500">No sign-ups loaded.</p>
        ) : filteredSignups.length === 0 ? (
          <p className="text-sm text-slate-500">No matches for that search.</p>
        ) : (
          <div className="overflow-x-auto max-h-[min(70vh,42rem)] overflow-y-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="pb-2 pt-2 pl-3 pr-2">#</th>
                  <th className="pb-2 pt-2 pr-2">Signed up</th>
                  <th className="pb-2 pt-2 pr-2">Company</th>
                  <th className="pb-2 pt-2 pr-2">Contact / email</th>
                  <th className="pb-2 pt-2 pr-2">Sub</th>
                  <th className="pb-2 pt-2 pr-2">Verify</th>
                  <th className="pb-2 pt-2 pr-3">Place</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSignups.map((row, idx) => {
                  const displayName =
                    row.trading_name ||
                    row.company_name ||
                    row.contact_name ||
                    `Company #${row.id}`;
                  const emails = [
                    ...(row.email ? [row.email] : []),
                    ...(row.owner_emails || []).filter(
                      (e) => e && e !== row.email
                    ),
                  ];
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 align-top"
                    >
                      <td className="py-2 pl-3 pr-2 text-[11px] tabular-nums text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2 pr-2 text-xs text-slate-600 whitespace-nowrap">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </td>
                      <td className="py-2 pr-2">
                        <div className="font-semibold text-slate-900">
                          {displayName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          id {row.id}
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-xs text-slate-600">
                        {row.contact_name &&
                        row.contact_name !== displayName ? (
                          <div className="font-medium text-slate-800">
                            {row.contact_name}
                          </div>
                        ) : null}
                        {emails.length ? (
                          <div className="space-y-0.5">
                            {emails.slice(0, 3).map((e) => (
                              <div key={e} className="break-all">
                                {e}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-xs font-bold text-slate-600 capitalize">
                        {row.subscription_status || '—'}
                      </td>
                      <td className="py-2 pr-2 text-xs font-bold text-slate-600 capitalize">
                        {row.verification_status || '—'}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-500">
                        {[row.city, row.country].filter(Boolean).join(', ') ||
                          '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

