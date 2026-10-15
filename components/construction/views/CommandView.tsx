'use client';

import { Hammer } from 'lucide-react';
import { attentionItems, bookIsEmpty, hasSampleRows } from '@/lib/construction/attention';
import { programmeReport } from '@/lib/construction/constructiongraph';
import { formatPct, formatRand, sastToday } from '@/lib/construction/format';
import {
  ConstructionButton,
  ConstructionEmpty,
  ConstructionPageHead,
  ConstructionProgress,
  ConstructionSection,
  ConstructionStat,
  ConstructionStatusPill,
  ConstructionUnavailable,
} from '@/components/construction/ConstructionUi';
import { deskHref, ScreenState, type DeskProps } from '@/components/construction/desk';

export const commandTestIds = ['command-view', 'command-loading', 'command-empty', 'command-error', 'command-kpi', 'site-action-bar'];

export function CommandView(props: DeskProps) {
  const blocked = ScreenState({ state: props.state, testId: 'command', onRetry: props.handlers.retry });
  if (props.state === 'loading' || props.state === 'error') return blocked;
  const { store, role, caps, handlers, badge, hrefBase } = props;
  const today = sastToday();
  const empty = props.state === 'empty' || (store.sites.length === 0 && store.clients.length === 0);
  const roll = programmeReport(store);
  const attention = attentionItems(store, role, today);
  const base = hrefBase || '/dashboard/constructiongraph';

  return (
    <div className="space-y-4 pb-24 sm:pb-0" data-testid="command-view">
      <ConstructionPageHead
        testId="command-head"
        title="Command"
        badge={badge}
        detail={
          role === 'site_manager'
            ? 'Today on site: diary, programme rows due, and open snags.'
            : role === 'office'
              ? 'Claims, certificates, retention, and a read-only look at the sites.'
              : 'Projects on site, the programme, and what needs a decision.'
        }
        actions={
          caps.canEditProjects ? (
            <a className="inline-flex min-h-11 items-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a]" data-primary="1" href={deskHref(base, 'sites')}>
              New project
            </a>
          ) : null
        }
      />
      {empty ? (
        <ConstructionEmpty
          testId="command-empty"
          icon={<Hammer />}
          title="No projects yet"
          hint="Add a client and a project, or load the sample project on an empty book."
          action={
            role === 'owner' && bookIsEmpty(store) ? (
              <ConstructionButton data-testid="load-sample" onClick={() => void handlers.run({ action: 'seed_demo' })}>
                Load sample project
              </ConstructionButton>
            ) : null
          }
        />
      ) : null}
      {role === 'site_manager' ? (
        <ConstructionSection title="Today" testId="command-today">
          <div className="grid gap-3 sm:grid-cols-2">
            {store.sites.filter((site) => site.status === 'on_site').map((site) => (
              <article key={site.id} data-row-id={site.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-black text-slate-900">{site.code} · {site.name}</p>
                <p className="text-xs text-slate-600">{site.client || 'No client yet'}</p>
                <div className="mt-2"><ConstructionStatusPill status={site.status} /></div>
              </article>
            ))}
          </div>
        </ConstructionSection>
      ) : null}
      {role === 'office' || role === 'owner' || role === 'viewer' ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="command-kpi">
          <ConstructionStat label="Projects on site" value={String(store.sites.filter((site) => site.status === 'on_site').length)} />
          <ConstructionStat label="Programme plan" value={store.programme.length ? formatPct(roll.plannedPct) : '—'} />
          <ConstructionStat label="Programme actual" value={store.programme.length ? formatPct(roll.actualPct) : '—'} />
          {caps.canSeeMoney && Object.prototype.hasOwnProperty.call(store, 'payments') ? (
            <>
              <ConstructionStat label="Certified to date" value={formatRand(roll.certified)} />
              <ConstructionStat label="Outstanding claims" value={formatRand(roll.outstandingBillings)} tone={roll.overduePayments ? 'warn' : 'default'} />
            </>
          ) : (
            <ConstructionStat label="Money" value="—" />
          )}
          <ConstructionStat label="Open snags" value={String(roll.openSnags)} />
          <ConstructionStat label="Variations waiting" value={String(store.variations.filter((row) => row.status === 'submitted' || row.status === 'queried').length)} />
        </div>
      ) : null}
      {!empty && !store.programme.length && role !== 'site_manager' ? (
        <p className="text-sm text-slate-600">No programme rows yet. The plan percentage stays blank until a row exists.</p>
      ) : null}
      <ConstructionSection title="Needs attention" hint="Built only from rows already in the book." testId="command-attention">
        {attention.length === 0 ? (
          <p className="text-sm text-slate-600">Nothing is waiting today.</p>
        ) : (
          <ul className="space-y-2">
            {attention.map((item) => (
              <li key={item.id}>
                <a href={item.href.replace('/dashboard/constructiongraph', base)} className="block rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm">
                  <span className="font-black text-slate-900">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-600">{item.detail}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </ConstructionSection>
      {role !== 'site_manager' ? (
        <ConstructionSection title="Projects" testId="command-projects">
          <div className="grid gap-3 sm:grid-cols-2">
            {store.sites.map((site) => {
              const report = roll.projects.find((row) => row.siteId === site.id);
              const nextMilestone = store.programme.find((row) => row.site_id === site.id && row.kind === 'milestone' && row.status !== 'complete');
              return (
                <a key={site.id} data-row-id={site.id} href={deskHref(base, 'sites')} className="block rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-slate-900">{site.code} · {site.name}</p>
                      <p className="text-xs text-slate-600">{site.client || 'No client yet'}</p>
                    </div>
                    <ConstructionStatusPill status={site.status} />
                  </div>
                  <div className="mt-3">
                    <ConstructionProgress planned={report?.plannedPct} actual={report?.actualPct} />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    Next milestone: {nextMilestone?.activity || '—'} · Open items {report?.openSnags ?? 0}
                  </p>
                </a>
              );
            })}
          </div>
        </ConstructionSection>
      ) : null}
      {role === 'owner' ? (
        <ConstructionSection title="Setup" hint="Each step turns on when the book has that row.">
          <ol className="grid gap-2 sm:grid-cols-2">
            {[
              ['Client', store.clients.length > 0],
              ['Project', store.sites.length > 0],
              ['Quote', store.quotes.length > 0],
              ['Programme', store.programme.length > 0],
              ['Subcontractor', store.subcontractors.length > 0],
              ['Diary', (store.diary || []).length > 0],
              ['Portal', store.portals.length > 0],
            ].map(([label, done]) => (
              <li key={String(label)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800">
                {done ? 'Done' : 'Still open'} · {label}
              </li>
            ))}
          </ol>
          {hasSampleRows(store) ? (
            <ConstructionButton className="mt-3" data-testid="remove-sample" onClick={() => void handlers.run({ action: 'remove_sample' })}>
              Remove sample
            </ConstructionButton>
          ) : null}
        </ConstructionSection>
      ) : null}
      {role === 'none' ? <ConstructionUnavailable /> : null}
      {role === 'site_manager' ? (
        <nav data-testid="site-action-bar" className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-slate-200 bg-white px-3 py-2 sm:hidden" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          <a className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-[#00b4d8] text-sm font-black text-[#0f172a]" href={deskHref(base, 'diary')}>Diary</a>
          <a className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-slate-200 text-sm font-black text-slate-800" href={deskHref(base, 'handover')}>Snag</a>
          <a className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-slate-200 text-sm font-black text-slate-800" href={deskHref(base, 'safety')}>Toolbox</a>
        </nav>
      ) : null}
    </div>
  );
}
