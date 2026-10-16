'use client';

import {
  Building2,
  CalendarClock,
  Clock3,
  HandCoins,
  Landmark,
  ListChecks,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { RECOVER_PRODUCT_NAME } from '@/lib/recovery/brand';
import { formatRecoverMoney } from '@/lib/recovery/money';
import { queueNavLabel } from '@/lib/recovery/roles';
import type { RecoverDeskPayload, RecoverWorkspace } from '@/lib/recovery/types';
import { AgentArt, DeskArt, PendingArt } from './RecoverArt';
import type { RecoverRole } from '@/lib/recovery/roles';
import {
  RecoverBanner,
  RecoverButton,
  RecoverDemoGate,
  RecoverEmpty,
  RecoverKpi,
  RecoverModuleCard,
  RecoverPanel,
  RecoverPendingBanner,
  RecoverRoleChip,
  RecoverScreen,
  dash,
  formatRand,
} from './RecoverChrome';
import {
  AgeingBuckets,
  AgentDesk,
  NeedsAttention,
  PromiseTimeline,
  RecoveryFunnel,
  WorkloadStrip,
} from './RecoverPreviews';
import { useRecoverDesk, useRecoverHref, useRecoverIllustration, useRecoverLinks } from './useRecoverDesk';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function cfdcDue(workspace: RecoverWorkspace | null) {
  if (!workspace || workspace.operator_type !== 'agency') return false;
  if (!workspace.cfdc_registration_no.trim()) return true;
  if (!workspace.cfdc_expiry) return true;
  return workspace.cfdc_expiry < todayIso();
}

function deskDescription(role: RecoverRole, placed: number): string {
  if (role === 'agent') {
    return 'Your queue is the only work on this desk. Accounts show up here after a creditor book is placed.';
  }
  if (role === 'finance') {
    return placed > 0
      ? 'Finance sees trust and remittance. Recovered and trust figures stay blank until those books exist.'
      : 'Finance sees trust and remittance. Recovered and trust figures stay blank until a book is placed.';
  }
  if (role === 'compliance') {
    return 'Compliance watches the operator profile and the Council registration. Collection work is not open yet.';
  }
  if (role === 'viewer') {
    return placed > 0
      ? 'This is a read-only look at the collections desk.'
      : 'This is a read-only look at the collections desk. Nothing has been placed yet.';
  }
  if (placed > 0) {
    return `${placed} accounts are on the book. Open accounts, the team, or a new import.`;
  }
  return 'Collections workspace. Set the operator, the team, and the first creditor book.';
}

export function RecoverCommand() {
  const { desk, error, loading } = useRecoverDesk();
  return (
    <RecoverScreen
      testId="recover-command"
      title={RECOVER_PRODUCT_NAME}
      description={desk ? deskDescription(desk.role, desk.book?.placedCount ?? 0) : 'Opening the collections desk.'}
      action={desk ? <RecoverRoleChip role={desk.role} /> : null}
    >
      {error ? <RecoverBanner testId="recover-banner-error" tone="error">{error}</RecoverBanner> : null}
      {loading || !desk ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : (
        <CommandBody desk={desk} />
      )}
    </RecoverScreen>
  );
}

function CommandBody({ desk }: { desk: RecoverDeskPayload }) {
  if (!desk.ready) {
    return (
      <div className="space-y-4">
        <RecoverPendingBanner role={desk.role} />
        <RecoverEmpty
          testId="recover-pending-stage"
          icon={Landmark}
          title="No accounts yet"
          body="Set up the workspace after approval. Add the operator, the team, and the first creditor book. Accounts appear here once that book is imported."
          art={<PendingArt />}
        />
      </div>
    );
  }
  if (desk.role === 'agent') return <AgentHome desk={desk} />;
  return <OwnerHome desk={desk} />;
}

function OwnerHome({ desk }: { desk: RecoverDeskPayload }) {
  const picture = useRecoverIllustration();
  const showTrust = desk.capabilities.canSeeTrust;
  const showCfdc =
    (desk.role === 'owner' || desk.role === 'manager' || desk.role === 'compliance') &&
    cfdcDue(desk.workspace);
  const counts = desk.counts;
  const checklist = [
    {
      label: 'Workspace created',
      done: Boolean(desk.workspace),
      href: '/dashboard/recovergraph/settings/team',
    },
    {
      label: 'Operator type chosen',
      done: Boolean(desk.workspace?.operator_type),
      href: '/dashboard/recovergraph/settings/team',
    },
    {
      label:
        desk.workspace && desk.workspace.operator_type !== 'agency'
          ? 'CFDC not required for this operator'
          : 'CFDC registration current',
      done: desk.workspace ? !cfdcDue(desk.workspace) : false,
      href: '/dashboard/recovergraph/settings/team',
    },
    {
      label: 'Staff added',
      done: (counts.staff ?? 0) > 0,
      href: '/dashboard/recovergraph/settings/team',
    },
    {
      label: 'First creditor',
      done: (counts.creditors ?? 0) > 0,
      href: '/dashboard/recovergraph/creditors',
    },
    {
      label: 'First mandate',
      done: (counts.mandates ?? 0) > 0,
      href: '/dashboard/recovergraph/mandates',
    },
    {
      label: 'First import',
      done: Boolean(desk.book?.imported),
      href: '/dashboard/recovergraph/imports',
    },
    {
      label: 'First account assigned',
      done: (desk.book?.assignedCount ?? 0) > 0,
      href: '/dashboard/recovergraph/accounts',
    },
  ];

  return (
    <>
      <RecoverDemoGate desk={desk} />
      {showCfdc ? (
        <RecoverBanner testId="recover-banner-cfdc" tone="cfdc">
          This agency needs a current Council for Debt Collectors registration before collection work starts.
        </RecoverBanner>
      ) : null}

      <section className="sa-hero mb-6 sm:mb-8">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full blur-3xl"
          style={{ background: 'var(--sa-page-glow-1)' }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 left-1/4 h-36 w-36 rounded-full blur-3xl"
          style={{ background: 'var(--sa-page-glow-2, rgba(0,180,216,0.08))' }}
          aria-hidden
        />
        <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="max-w-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#0077b6] shadow-sm">
              <span className="relative flex h-1.5 w-1.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              {desk.workspace?.display_name || 'Workspace not created'}
            </div>
            <h2 className="mb-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Today’s picture
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              {picture
                ? 'Illustration · sample data. These figures are a picture of a book, not a live workspace.'
                : desk.book && desk.book.placedCount > 0
                  ? `${desk.book.placedCount} accounts are on the book. Recovered, in trust, and clocks stay blank until those books exist.`
                  : 'No accounts placed yet. Placed, recovered, trust, and clock figures stay blank until those books exist.'}
            </p>
          </div>
          <DeskArt />
        </div>
      </section>

      <div
        data-testid="recover-hero-kpis"
        className="mb-8 grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
      >
            <RecoverKpi
              testId="recover-kpi-placed"
              label="Placed"
              value={picture ? picture.placed : desk.book && desk.book.placedCount > 0 ? String(desk.book.placedCount) : '—'}
              sub={
                picture
                  ? 'Illustration · sample data'
                  : desk.book && desk.book.placedCount > 0
                    ? `${formatRecoverMoney(desk.book.placedBalanceCents)}. Placed balance; payments are not recorded yet.`
                    : 'No accounts placed yet'
              }
              icon={Scale}
              tint="border-sky-100 bg-sky-50"
            />
            <RecoverKpi
              testId="recover-kpi-recovered"
              label="Recovered"
              value={picture ? picture.recovered : '—'}
              sub={picture ? 'Illustration · sample data' : 'Nothing recovered yet'}
              icon={HandCoins}
              tint="border-cyan-100 bg-cyan-50"
            />
            {showTrust ? (
              <RecoverKpi
                testId="recover-kpi-trust"
                label="In trust"
                value={picture ? picture.trust : '—'}
                sub={picture ? 'Illustration · sample data' : 'Trust ledger is not open yet'}
                icon={Landmark}
                tint="border-emerald-100 bg-emerald-50"
              />
            ) : null}
            <RecoverKpi
              testId="recover-kpi-clocks"
              label="Clocks expiring"
              value={picture ? picture.clocks : '—'}
              sub={picture ? 'Illustration · sample data' : 'No clocks are running'}
              icon={Clock3}
              tint="border-amber-100 bg-amber-50"
            />
      </div>

      {!picture && desk.book && desk.book.placedCount > 0 ? (
        <p className="mb-6 text-sm text-slate-700" data-testid="recover-placed-live">
          {desk.book.placedCount} accounts placed. Recovered, in trust, and clocks stay blank until those books exist.
        </p>
      ) : null}
      {picture ? (
        <div className="mb-8 grid gap-4">
          <NeedsAttention items={picture.attention} />
          {picture.scope === 'book' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <RecoveryFunnel />
              <AgeingBuckets />
            </div>
          ) : null}
          <PromiseTimeline items={picture.promises} />
          {picture.scope === 'book' ? <WorkloadStrip /> : null}
        </div>
      ) : desk.book && desk.book.placedCount > 0 ? null : (
        <div className="mb-8">
          <RecoverEmpty
            testId="recover-accounts-empty"
            icon={ListChecks}
            title="No accounts yet"
            body="Create the workspace, add the team, then place the first creditor book. Accounts appear here once that book is imported."
          />
        </div>
      )}

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <RecoverPanel title="Setup" testId="recover-setup-checklist">
          <ol className="space-y-2">
            {checklist.map((item) => (
              <li key={item.label}>
                <SetupLink
                  href={item.href}
                  className="recover-focus flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ListChecks className="h-4 w-4 text-[#0077b6]" aria-hidden />
                    {item.label}
                  </span>
                  <span
                    className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-bold uppercase tracking-wide ${
                      item.done
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-white text-[#0077b6]'
                    }`}
                  >
                    {item.done ? 'Done' : 'Open'}
                  </span>
                </SetupLink>
              </li>
            ))}
          </ol>
        </RecoverPanel>
        <RecoverPanel title="Next">
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            {desk.workspace
              ? 'Open creditors and mandates to record who places accounts, then import the book.'
              : 'Create the workspace profile before inviting staff or reading a book.'}
          </p>
          <RecoverButton
            href={
              desk.capabilities.canEditSettings
                ? '/dashboard/recovergraph/settings/team'
                : '/dashboard/recovergraph/creditors'
            }
          >
            {desk.capabilities.canEditSettings ? 'Open team & registrations' : 'Open creditors'}
          </RecoverButton>
        </RecoverPanel>
      </div>

      <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-[#0077b6]">Workbenches</h2>
      <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <RecoverModuleCard
          href="/dashboard/recovergraph/queue"
          icon={ListChecks}
          code="01"
          title={queueNavLabel(desk.role)}
          desc={desk.book && desk.book.assignedCount > 0 ? `${desk.book.assignedCount} accounts are assigned.` : 'Accounts waiting for work. None are assigned yet.'}
          metric={desk.book && desk.book.assignedCount > 0 ? String(desk.book.assignedCount) : '—'}
          metricLabel="Accounts"
          accent="from-cyan-50 to-white border-cyan-100"
        />
        <RecoverModuleCard
          href="/dashboard/recovergraph/creditors"
          icon={Building2}
          code="02"
          title="Creditors"
          desc="Clients who place accounts."
          metric={dash(counts.creditors)}
          metricLabel="Records"
          accent="from-sky-50 to-white border-sky-100"
        />
        <RecoverModuleCard
          href="/dashboard/recovergraph/mandates"
          icon={ShieldCheck}
          code="03"
          title="Mandates"
          desc="Authority to collect on a creditor book."
          metric={dash(counts.mandates)}
          metricLabel="Records"
          accent="from-emerald-50 to-white border-emerald-100"
        />
        {desk.capabilities.canManageStaff ? (
          <RecoverModuleCard
            href="/dashboard/recovergraph/settings/team"
            icon={Users}
            code="04"
            title="Team & registrations"
            desc="Operator, Council registration, and staff roles."
            metric={dash(counts.staff)}
            metricLabel="Staff"
            accent="from-amber-50 to-white border-amber-100"
          />
        ) : null}
        <RecoverModuleCard
          href="/dashboard/recovergraph/settings/portals"
          icon={Landmark}
          code="05"
          title="Portals"
          desc="Creditor, debtor, and attorney access. Not open yet."
          accent="from-teal-50 to-white border-teal-100"
        />
        <RecoverModuleCard
          href="/dashboard/recovergraph/queue"
          icon={CalendarClock}
          code="06"
          title="Promises"
          desc="Promise-to-pay dates. Live promises are not loaded in this version."
          accent="from-sky-50 to-white border-sky-100"
        />
      </div>
    </>
  );
}

function AgentHome({ desk }: { desk: RecoverDeskPayload }) {
  const picture = useRecoverIllustration();
  const name = desk.workspace?.display_name || RECOVER_PRODUCT_NAME;
  const target = desk.self?.monthly_target_cents;
  return (
    <div data-testid="recover-agent-home" className="space-y-6">
      <RecoverDemoGate desk={desk} />
      <section className="sa-hero mb-2">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full blur-3xl"
          style={{ background: 'var(--sa-page-glow-1)' }}
          aria-hidden
        />
        <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="max-w-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#0077b6] shadow-sm">
              My work
            </div>
            <h2 className="mb-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Good day
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              {name}. Your queue is the only work surface on this desk. Trust, settings, and other people’s books stay off this page.
            </p>
          </div>
          <AgentArt />
        </div>
      </section>
      <div className="space-y-4">
        {picture ? (
          <AgentDesk picture={picture} />
        ) : (
          <RecoverEmpty
            testId="recover-queue-empty"
            icon={ListChecks}
            title="My queue"
            body="No accounts assigned yet. Accounts appear here once a creditor book is imported."
            action={<RecoverButton href="/dashboard/recovergraph/queue">Open my queue</RecoverButton>}
          />
        )}
        <RecoverPanel title="Monthly target" testId="recover-target-empty">
          <p className="sa-metric-value tabular-nums text-slate-900">{formatRand(target)}</p>
          {target == null ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">No monthly target set.</p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Illustration · sample data</p>
          )}
          {target == null ? (
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              A target appears here when a manager sets one on your staff row. Until then the figure stays blank.
            </p>
          ) : null}
        </RecoverPanel>
      </div>
    </div>
  );
}

function SetupLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  const mapped = useRecoverHref(href);
  const links = useRecoverLinks();
  if (links === 'soon') {
    return (
      <span className={className}>
        {children}
        <span className="sr-only">Launching soon</span>
      </span>
    );
  }
  return (
    <a href={mapped} className={className}>
      {children}
    </a>
  );
}
