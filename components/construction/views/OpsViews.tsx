'use client';

import { useState } from 'react';
import { BookOpen, CalendarDays, ClipboardList, Shield } from 'lucide-react';
import { ConstructionGantt, ConstructionTimeline } from '@/components/construction/ConstructionGantt';
import {
  ConstructionButton,
  ConstructionDate,
  ConstructionDrawer,
  ConstructionEmpty,
  ConstructionGhostButton,
  ConstructionPageHead,
  ConstructionSegmented,
  ConstructionStatusPill,
  ConstructionTable,
  constructionField,
} from '@/components/construction/ConstructionUi';
import { ScreenState, type DeskProps } from '@/components/construction/desk';
import {
  newConstructionId,
  type ConstructionProgrammeRow,
  type ConstructionVariation,
} from '@/lib/construction/constructiongraph';
import { sastToday } from '@/lib/construction/format';
import { forecastEnd, reviseEnd, shiftProgrammeRow } from '@/lib/construction/programme-model';
import { variationTotal } from '@/lib/construction/variations-model';
import { rowExpiry } from '@/lib/construction/safety-model';
import { formatRand } from '@/lib/construction/format';

export function ProgrammeView(props: DeskProps) {
  const [siteId, setSiteId] = useState(props.store.sites[0]?.id || '');
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState('');
  const [depends, setDepends] = useState('');
  const [confirm, setConfirm] = useState(false);
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="programme" onRetry={props.handlers.retry} />;
  }
  const today = sastToday();
  const rows = props.store.programme
    .filter((row) => !siteId || row.site_id === siteId)
    .slice()
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const empty = props.state === 'empty' || props.store.programme.length === 0;
  const readOnly = !props.caps.canEditProgramme;
  const ends = rows.map((row) => reviseEnd(row));
  const planEnd = ends.map((row) => row.planEnd).filter(Boolean).sort().at(-1) || '—';
  const revised = ends.map((row) => row.revisedEnd).filter(Boolean).sort().at(-1) || '—';
  const forecast = rows.map((row) => forecastEnd(row, today)).filter(Boolean).sort().at(-1) || '—';
  return (
    <div className="space-y-4" data-testid="programme-view">
      <ConstructionPageHead
        title="Programme"
        badge={props.badge}
        detail="Plan, baseline, and actual. An approved variation adds days beside the bar."
        actions={readOnly ? null : <ConstructionButton data-testid="programme-add" onClick={() => setOpen(true)}>Add task</ConstructionButton>}
      />
      <label className="block text-xs font-bold text-slate-700">
        Project
        <select data-testid="programme-project" className={constructionField} value={siteId} onChange={(event) => setSiteId(event.target.value)}>
          {props.store.sites.map((site) => <option key={site.id} value={site.id}>{site.code} · {site.name}</option>)}
        </select>
      </label>
      {props.caps.canEditProgramme ? (
        <ConstructionGhostButton data-testid="programme-baseline" onClick={() => {
          void props.handlers.run({ action: 'baseline_programme', siteId, confirmRebaseline: confirm }).then((result) => {
            const needs = Boolean(result && typeof result === 'object' && 'needsConfirm' in result && result.needsConfirm);
            setConfirm(needs);
          }).catch(() => setConfirm(true));
        }}>
          {confirm ? 'Confirm re-baseline' : 'Baseline'}
        </ConstructionGhostButton>
      ) : null}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Plan end</p><p className="font-black">{planEnd}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Revised end</p><p className="font-black">{revised}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Forecast</p><p className="font-black">{forecast}</p></div>
      </div>
      {empty ? (
        <ConstructionEmpty testId="programme-empty" icon={<CalendarDays />} title="No programme yet" hint="Add a task. Older rows without a kind still show as tasks." action={readOnly ? null : <ConstructionButton onClick={() => setOpen(true)}>Add task</ConstructionButton>} />
      ) : (
        <ConstructionGantt
          rows={rows}
          today={today}
          readOnly={readOnly}
          onShift={(rowId, days) => {
            const next = shiftProgrammeRow(props.store, rowId, days);
            const row = next.programme.find((item) => item.id === rowId);
            if (row) void props.handlers.merge({ programme: [row] });
          }}
        />
      )}
      {!empty ? (
        <>
          <h2 className="text-sm font-black text-[#0f172a]">Schedule</h2>
          <ConstructionTimeline rows={rows} />
          <h2 className="text-sm font-black text-[#0f172a]">Packages</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="package-board">
            {(['planned', 'in_progress', 'complete', 'delayed'] as const).map((status) => (
              <div key={status} className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0f172a]">
                  {status === 'in_progress' ? 'In progress' : status === 'planned' ? 'Planned' : status === 'complete' ? 'Complete' : 'Delayed'}
                </p>
                <ul className="mt-2 space-y-2">
                  {rows.filter((row) => row.kind !== 'milestone' && (row.status || 'planned') === status).map((row) => (
                    <li key={row.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      <p className="text-sm font-black text-slate-900">{row.activity}</p>
                      <p className="text-xs text-slate-600">{row.package_label || 'Package'}</p>
                    </li>
                  ))}
                  {rows.every((row) => row.kind === 'milestone' || (row.status || 'planned') !== status) ? (
                    <li className="text-xs text-slate-500">None</li>
                  ) : null}
                </ul>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <ConstructionDrawer open={open} title="New task" onClose={() => setOpen(false)} testId="programme-drawer">
        <label className="block text-xs font-bold text-slate-700">Activity<input data-testid="programme-activity" className={constructionField} value={activity} onChange={(event) => setActivity(event.target.value)} /></label>
        <label className="mt-3 block text-xs font-bold text-slate-700">Depends on
          <select data-testid="programme-depends" className={constructionField} value={depends} onChange={(event) => setDepends(event.target.value)}>
            <option value="">None</option>
            {rows.map((row) => <option key={row.id} value={row.id}>{row.activity}</option>)}
          </select>
        </label>
        <ConstructionButton className="mt-4" data-testid="programme-save" onClick={() => {
          if (!activity.trim()) return;
          const row: ConstructionProgrammeRow = {
            id: newConstructionId('prg'),
            site_id: siteId || props.store.sites[0]?.id,
            activity: activity.trim(),
            kind: 'task',
            planned_start: today,
            planned_end: today,
            depends_on: depends ? [depends] : [],
            status: 'planned',
            planned_pct: 0,
            actual_pct: 0,
          };
          void props.handlers.merge({ programme: [row] });
          setActivity('');
          setDepends('');
          setOpen(false);
        }}>Save task</ConstructionButton>
      </ConstructionDrawer>
    </div>
  );
}

export function VariationsView(props: DeskProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ConstructionVariation | null>(null);
  const [title, setTitle] = useState('');
  const [days, setDays] = useState('0');
  const [note, setNote] = useState('');
  const money = props.caps.canSeeMoney && props.role !== 'site_manager';
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="variations" onRetry={props.handlers.retry} />;
  }
  const empty = props.state === 'empty' || props.store.variations.length === 0;
  return (
    <div className="space-y-4" data-testid="variations-view">
      <ConstructionPageHead title="Variations" badge={props.badge} detail="Raise scope and days. Prices stay with the office." actions={props.caps.canRaiseVariation || props.role === 'owner' ? <ConstructionButton data-testid="variation-add" onClick={() => setOpen(true)}>Raise variation</ConstructionButton> : null} />
      {empty ? <ConstructionEmpty testId="variations-empty" icon={<ClipboardList />} title="No variations yet" hint="Raise a variation with the days it needs. Prices can be added by the office." action={<ConstructionButton onClick={() => setOpen(true)}>Raise variation</ConstructionButton>} /> : (
        <ConstructionTable testId="variations-table" rows={props.store.variations} rowKey={(row) => row.id} onRow={setSelected} columns={[
          { key: 'number', header: 'Number', render: (row) => row.number },
          { key: 'title', header: 'Title', render: (row) => row.title || row.description },
          { key: 'direction', header: 'Direction', render: (row) => row.direction ? <ConstructionStatusPill status={row.direction} /> : '—' },
          { key: 'project', header: 'Project', render: (row) => props.store.sites.find((site) => site.id === row.site_id)?.name || '—' },
          { key: 'price', header: 'Price', render: (row) => money && row.amount != null ? formatRand(variationTotal(row)) : '—' },
          { key: 'days', header: 'Days', render: (row) => String(row.days ?? '—') },
          { key: 'status', header: 'Status', render: (row) => <ConstructionStatusPill status={row.status} /> },
        ]} />
      )}
      <ConstructionDrawer open={open} title="Raise variation" onClose={() => setOpen(false)}>
        <label className="block text-xs font-bold text-slate-700">Title<input data-testid="variation-title" className={constructionField} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="mt-3 block text-xs font-bold text-slate-700">Days<input data-testid="variation-days" className={constructionField} inputMode="numeric" value={days} onChange={(event) => setDays(event.target.value)} /></label>
        <ConstructionButton className="mt-4" data-testid="variation-save" onClick={() => {
          if (!title.trim()) return;
          const row: ConstructionVariation = {
            id: newConstructionId('var'),
            number: `VO-${String(props.store.variations.length + 1).padStart(2, '0')}`,
            title: title.trim(),
            description: title.trim(),
            days: Number(days) || 0,
            status: 'submitted',
            direction: 'contractor_proposal',
            site_id: props.store.sites[0]?.id,
            programme_row_ids: props.store.programme[0] ? [props.store.programme[0].id] : [],
          };
          void props.handlers.merge({ variations: [row] });
          setSelected(row);
          setOpen(false);
        }}>Save variation</ConstructionButton>
      </ConstructionDrawer>
      <ConstructionDrawer open={Boolean(selected)} title={selected?.number || 'Variation'} onClose={() => setSelected(null)} testId="variation-drawer">
        {selected ? (
          <div className="space-y-3 text-sm text-slate-800">
            <p className="font-black text-slate-900">{selected.title || selected.description}</p>
            <p>{selected.description}</p>
            <ConstructionStatusPill status={selected.status} />
            {selected.lines?.length ? (
              <table className="w-full text-left text-sm">
                <thead><tr><th>Description</th><th>Qty</th>{money ? <th>Rate</th> : null}{money ? <th>Amount</th> : null}</tr></thead>
                <tbody>
                  {selected.lines.map((line, index) => (
                    <tr key={index}><td>{line.description}</td><td className="tabular-nums">{line.qty} {line.uom}</td>{money ? <td className="tabular-nums">{formatRand(line.rate)}</td> : null}{money ? <td className="tabular-nums">{formatRand(line.amount ?? (line.qty || 0) * (line.rate || 0))}</td> : null}</tr>
                  ))}
                </tbody>
              </table>
            ) : <p>No lines yet. The amount on file is {money ? formatRand(selected.amount) : 'hidden for this role'}.</p>}
            <p>Days {selected.days ?? 0}. Linked rows {(selected.programme_row_ids || []).join(', ') || '—'}</p>
            {props.caps.canApproveVariations ? (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Decision note<textarea className={constructionField} value={note} onChange={(event) => setNote(event.target.value)} /></label>
                <ConstructionButton data-testid="variation-approve" onClick={() => void props.handlers.run({ action: 'decide_variation', id: selected.id, decision: 'approved', name: 'Office', note, date: sastToday() })}>Approve</ConstructionButton>
                <ConstructionGhostButton onClick={() => void props.handlers.run({ action: 'decide_variation', id: selected.id, decision: 'rejected', name: 'Office', note, date: sastToday() })}>Reject</ConstructionGhostButton>
                <ConstructionGhostButton onClick={() => void props.handlers.run({ action: 'decide_variation', id: selected.id, decision: 'queried', name: 'Office', note, date: sastToday() })}>Query</ConstructionGhostButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </ConstructionDrawer>
    </div>
  );
}

export function DiaryView(props: DeskProps) {
  const today = sastToday();
  const [siteId, setSiteId] = useState(props.store.sites.find((site) => site.status === 'on_site')?.id || props.store.sites[0]?.id || '');
  const [mode, setMode] = useState<'day' | 'month'>('day');
  const [progress, setProgress] = useState('');
  const [weather, setWeather] = useState('Clear');
  const existing = (props.store.diary || []).find((row) => row.site_id === siteId && row.date.slice(0, 10) === today);
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="diary" onRetry={props.handlers.retry} />;
  }
  const empty = props.state === 'empty' || (props.store.diary || []).length === 0;
  const locked = Boolean(existing?.signed_off_at);
  return (
    <div className="space-y-4" data-testid="diary-view">
      <ConstructionPageHead title="Site diary" badge={props.badge} detail="One entry per project per day. Sign-off locks the day; later edits are addenda." />
      <ConstructionSegmented value={mode} onChange={setMode} label="Diary range" options={[{ id: 'day', label: 'Day' }, { id: 'month', label: 'Month' }]} />
      <label className="block text-xs font-bold text-slate-700">Project
        <select className={constructionField} value={siteId} onChange={(event) => setSiteId(event.target.value)}>
          {props.store.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
        </select>
      </label>
      {mode === 'month' ? (
        <ul className="grid grid-cols-7 gap-1 text-center text-xs">
          {(props.store.diary || []).filter((row) => row.site_id === siteId).map((row) => (
            <li key={row.id} data-row-id={row.id} className="rounded-xl bg-white p-2 shadow-sm">{row.date.slice(8, 10)}</li>
          ))}
        </ul>
      ) : null}
      {empty && !existing ? (
        <ConstructionEmpty testId="diary-empty" icon={<BookOpen />} title="No diary entries yet. Start today's diary." hint="Weather, labour, plant, and the day’s note live here." action={props.caps.canWriteDiary ? <ConstructionButton data-testid="diary-start" onClick={() => void props.handlers.merge({ diary: [{ id: newConstructionId('diary'), site_id: siteId, date: today, weather, progress_note: '', author_name: 'Site' }] })}>Start today’s diary</ConstructionButton> : null} />
      ) : (
        <form className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="diary-form" onSubmit={(event) => event.preventDefault()}>
          <div className="flex flex-wrap gap-2">
            {['Clear', 'Cloudy', 'Rain', 'Wind'].map((item) => (
              <button key={item} type="button" className={weather === item ? 'rounded-2xl bg-[#00b4d8] px-3 py-2 text-xs font-black text-[#0f172a]' : 'rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold'} onClick={() => setWeather(item)}>{item}</button>
            ))}
          </div>
          <label className="block text-xs font-bold text-slate-700">Progress<textarea data-testid="diary-progress" className={constructionField} value={progress || existing?.progress_note || ''} onChange={(event) => setProgress(event.target.value)} disabled={locked || !props.caps.canWriteDiary} /></label>
          {locked ? <p data-testid="diary-locked" className="text-sm font-bold text-slate-800">Signed off <ConstructionDate value={existing?.signed_off_at} /> by {existing?.signed_off_by || 'the site'}.</p> : null}
          {props.caps.canWriteDiary && existing && !locked ? (
            <ConstructionButton data-testid="diary-signoff" onClick={() => void props.handlers.merge({ diary: [{ ...existing, weather, progress_note: progress || existing.progress_note, signed_off_at: new Date().toISOString(), signed_off_by: 'Site' }] })}>Sign off</ConstructionButton>
          ) : null}
          {props.caps.canWriteDiary && !existing ? (
            <ConstructionButton data-testid="diary-start" onClick={() => void props.handlers.merge({ diary: [{ id: newConstructionId('diary'), site_id: siteId, date: today, weather, progress_note: progress, author_name: 'Site' }] })}>Start today’s diary</ConstructionButton>
          ) : null}
          <div data-testid="diary-print" className="text-xs text-slate-600">Print this day from the browser. Photos are not stored.</div>
        </form>
      )}
      <ul className="space-y-2">
        {(props.store.diary || []).map((row) => (
          <li key={row.id} data-row-id={row.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <ConstructionDate value={row.date} /> · {row.progress_note || 'No note'} {row.signed_off_at ? '· Signed off' : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SafetyView(props: DeskProps) {
  const [view, setView] = useState<'toolbox' | 'incidents' | 'permits' | 'inductions'>('toolbox');
  const [title, setTitle] = useState('');
  const [person, setPerson] = useState('');
  const [expires, setExpires] = useState('');
  const today = sastToday();
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="safety" onRetry={props.handlers.retry} />;
  }
  const rows = props.store.safety.filter((row) => {
    if (view === 'toolbox') return row.kind === 'toolbox';
    if (view === 'incidents') return row.kind === 'incident';
    if (view === 'permits') return row.kind === 'inspection' || row.kind === 'permit';
    return row.kind === 'induction' || row.kind === 'risk_assessment' || row.kind === 'method_statement';
  });
  const empty = props.state === 'empty' || rows.length === 0;
  return (
    <div className="space-y-4" data-testid="safety-view">
      <ConstructionPageHead title="Health and safety" badge={props.badge} detail="Toolbox talks, incidents, permits, and inductions. Dates are the only expiry signal." />
      <ConstructionSegmented testId="safety-views" value={view} onChange={setView} label="Safety views" options={[
        { id: 'toolbox', label: 'Toolbox talks' },
        { id: 'incidents', label: 'Incidents' },
        { id: 'permits', label: 'Inspections and permits' },
        { id: 'inductions', label: 'Inductions and documents' },
      ]} />
      {empty ? <ConstructionEmpty testId="safety-empty" icon={<Shield />} title="Nothing in this view yet" hint="Log a toolbox talk, an incident, a permit, or an induction." /> : (
        <ConstructionTable testId={`safety-${view}`} rows={rows} rowKey={(row) => row.id} columns={[
          { key: 'title', header: 'Title', render: (row) => row.title },
          { key: 'status', header: 'Status', render: (row) => <ConstructionStatusPill status={row.status} /> },
          { key: 'who', header: 'Who', render: (row) => row.person_name || row.company || row.action_owner || (row.attendees != null ? `${row.attendees} attending` : '—') },
          { key: 'when', header: 'Date', render: (row) => <ConstructionDate value={row.expires_on || row.valid_to || row.date} /> },
          { key: 'flag', header: 'Expiry', render: (row) => {
            const flag = rowExpiry(row, today);
            if (flag === 'none') return 'No expiry date';
            return <span className="inline-flex items-center gap-1"><Shield className="h-3 w-3" aria-hidden />{flag}</span>;
          } },
        ]} />
      )}
      {props.caps.canWriteSafety ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-black">Toolbox talk</p>
            <input data-testid="safety-toolbox-title" className={constructionField} value={view === 'toolbox' ? title : ''} placeholder="Title" onChange={(event) => { setView('toolbox'); setTitle(event.target.value); }} />
            <ConstructionButton className="mt-3" data-testid="safety-toolbox-add" onClick={() => void props.handlers.merge({ safety: [{ id: newConstructionId('saf'), kind: 'toolbox', title: title || 'Toolbox talk', date: today, attendees: 1, status: 'closed', site_id: props.store.sites[0]?.id }] })}>Log toolbox talk</ConstructionButton>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-black">Induction</p>
            <input data-testid="safety-person" className={constructionField} placeholder="Person" value={person} onChange={(event) => setPerson(event.target.value)} />
            <input data-testid="safety-expires" className={constructionField} type="date" value={expires} onChange={(event) => setExpires(event.target.value)} />
            <ConstructionButton className="mt-3" data-testid="safety-induction-add" onClick={() => void props.handlers.merge({ safety: [{ id: newConstructionId('saf'), kind: 'induction', title: 'Site induction', person_name: person || 'Person', company: props.store.subcontractors[0]?.name, expires_on: expires || undefined, status: 'open', site_id: props.store.sites[0]?.id }] })}>Log induction</ConstructionButton>
          </div>
        </div>
      ) : null}
      <p className="text-sm"><a className="font-bold text-[#0f172a]" href="/dashboard/sheq">Open the Core SHEQ hub</a></p>
    </div>
  );
}
