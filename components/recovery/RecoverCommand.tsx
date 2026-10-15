'use client';

import {
  Building2,
  Clock3,
  HandCoins,
  Landmark,
  ListChecks,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  RECOVER_DEMO_BANNER,
  RECOVER_PENDING_BANNER,
  RECOVER_PRODUCT_NAME,
} from '@/lib/recovery/brand';
import { queueNavLabel } from '@/lib/recovery/roles';
import type { RecoverDeskPayload, RecoverWorkspace } from '@/lib/recovery/types';
import {
  RecoverBanner,
  RecoverButton,
  RecoverEmpty,
  RecoverKpi,
  RecoverModuleCard,
  RecoverPanel,
  RecoverRoleChip,
  RecoverScreen,
  dash,
  formatRand,
} from './RecoverChrome';
import { useRecoverDesk } from './useRecoverDesk';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function cfdcDue(workspace: RecoverWorkspace | null) {
  if (!workspace || workspace.operator_type !== 'agency') return false;
  if (!workspace.cfdc_registration_no.trim()) return true;
  if (!workspace.cfdc_expiry) return true;
  return workspace.cfdc_expiry < todayIso();
}

export function RecoverCommand() {
  const { desk, error, loading } = useRecoverDesk();
  return (
    <RecoverScreen
      testId="recover-command"
      title={RECOVER_PRODUCT_NAME}
      description="Collections workspace. Set the operator, the team, and the first creditor book. Accounts are not loaded in this version."
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
      <RecoverBanner testId="recover-banner-pending" tone="pending">
        {RECOVER_PENDING_BANNER}
      </RecoverBanner>
    );
  }
  if (desk.role === 'agent') return <AgentHome desk={desk} />;
  return <OwnerHome desk={desk} />;
}

function OwnerHome({ desk }: { desk: RecoverDeskPayload }) {
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
  ];

  return (
    <>
      {!desk.workspace?.real_data_enabled ? (
        <RecoverBanner testId="recover-banner-demo" tone="demo">
          {RECOVER_DEMO_BANNER}
        </RecoverBanner>
      ) : null}
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
        <div className="relative max-w-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#0077b6] shadow-sm">
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
            No accounts placed yet. Placed, recovered, trust, and clock figures stay blank until those books exist.
          </p>
        </div>
      </section>

      <div
        data-testid="recover-hero-kpis"
        className="mb-8 grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
      >
            <RecoverKpi
              testId="recover-kpi-placed"
              label="Placed"
              value="—"
              sub="No accounts placed yet"
              icon={Scale}
            />
            <RecoverKpi
              testId="recover-kpi-recovered"
              label="Recovered"
              value="—"
              sub="Nothing recovered yet"
              icon={HandCoins}
            />
            {showTrust ? (
              <RecoverKpi
                testId="recover-kpi-trust"
                label="In trust"
                value="—"
                sub="Trust ledger is not open yet"
                icon={Landmark}
              />
            ) : null}
            <RecoverKpi
              testId="recover-kpi-clocks"
              label="Clocks expiring"
              value="—"
              sub="No clocks are running"
              icon={Clock3}
            />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <RecoverPanel title="Setup" testId="recover-setup-checklist">
          <ol className="space-y-2">
            {checklist.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="recover-focus flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ListChecks className="h-4 w-4 text-[#0077b6]" aria-hidden />
                    {item.label}
                  </span>
                  <span
                    className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-[10px] font-black uppercase tracking-wide ${
                      item.done
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-white text-[#0077b6]'
                    }`}
                  >
                    {item.done ? 'Done' : 'Open'}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </RecoverPanel>
        <RecoverPanel title="Next">
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            {desk.workspace
              ? 'Creditors and mandates are read-only here. Create the customer record in Customers, then place the book in a later release.'
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RecoverModuleCard
          href="/dashboard/recovergraph/queue"
          icon={ListChecks}
          code="01"
          title={queueNavLabel(desk.role)}
          desc="Accounts waiting for work. None are assigned yet."
          metric="—"
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
      </div>
    </>
  );
}

function AgentHome({ desk }: { desk: RecoverDeskPayload }) {
  const name = desk.workspace?.display_name || RECOVER_PRODUCT_NAME;
  const target = desk.self?.monthly_target_cents;
  return (
    <div data-testid="recover-agent-home">
      {!desk.workspace?.real_data_enabled ? (
        <RecoverBanner testId="recover-banner-demo" tone="demo">
          {RECOVER_DEMO_BANNER}
        </RecoverBanner>
      ) : null}
      <section className="sa-hero mb-6 sm:mb-8">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full blur-3xl"
          style={{ background: 'var(--sa-page-glow-1)' }}
          aria-hidden
        />
        <div className="relative max-w-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#0077b6] shadow-sm">
            My work
          </div>
          <h2 className="mb-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Good day
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            {name}. Your queue is the only work surface on this desk.
          </p>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <RecoverEmpty
          testId="recover-queue-empty"
          icon={ListChecks}
          title="My queue"
          body="No accounts assigned yet. Accounts appear here once a creditor book is imported."
          action={<RecoverButton href="/dashboard/recovergraph/queue">Open my queue</RecoverButton>}
        />
        <RecoverPanel title="Monthly target" testId="recover-target-empty">
          <p className="sa-metric-value tabular-nums text-slate-900">{formatRand(target)}</p>
          {target == null ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">No monthly target set.</p>
          ) : null}
        </RecoverPanel>
      </div>
    </div>
  );
}
