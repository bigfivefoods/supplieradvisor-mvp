'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Camera,
  FileText,
  HardHat,
  Sun,
  Users,
  Wallet,
} from 'lucide-react';
import { MemberAdvisorShell, type MemberAdvisorTab } from '@/components/advisors/MemberAdvisorShell';
import { ConstructionGantt, ConstructionTimeline } from '@/components/construction/ConstructionGantt';
import { ConstructionInstallPrompt } from '@/components/construction/ConstructionInstall';
import {
  ConstructionKpi,
  ConstructionMoneyBars,
  ConstructionStatusPill,
  ConstructionTable,
  constructionCardPad,
  constructionField,
} from '@/components/construction/ConstructionUi';
import {
  newConstructionId,
  resolvePaymentStatus,
  type ClientPortalView,
  type ConstructiongraphStore,
  type ContractorPortalView,
  type PublicPortalView,
} from '@/lib/construction/constructiongraph';
import { formatPct, formatRand, sastToday } from '@/lib/construction/format';

function sumEntered(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => value != null && Number.isFinite(Number(value)));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + Number(value), 0);
}

type OwnerTab = 'today' | 'projects' | 'plan' | 'money' | 'team';
type WorkerTab = 'today' | 'tasks' | 'diary' | 'site' | 'you';
type ClientTab = 'project' | 'plan' | 'money' | 'documents' | 'more';

function Card({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <article className={constructionCardPad} data-testid={testId}>
      {children}
    </article>
  );
}

export function OwnerApp({
  store,
  officeHref,
  onToggleWorkersMoney,
}: {
  store: ConstructiongraphStore;
  officeHref: string;
  onToggleWorkersMoney?: (next: boolean) => void;
}) {
  const [tab, setTab] = useState<OwnerTab>('today');
  const today = sastToday();
  const seeMoney = Boolean(store.settings.workers_see_money);
  const tabs: MemberAdvisorTab<OwnerTab>[] = [
    { id: 'today', label: 'Today', icon: <Sun /> },
    { id: 'projects', label: 'Projects', icon: <HardHat /> },
    { id: 'plan', label: 'Plan', icon: <CalendarDays /> },
    { id: 'money', label: 'Money', icon: <Wallet />, emphasis: true },
    { id: 'team', label: 'Team', icon: <Users /> },
  ];
  const brand = 'ConstructionAdvisor®';
  return (
    <div data-testid="role-owner">
      <MemberAdvisorShell
        color="#00b4d8"
        solidBrand
        presence={false}
        mobileNav="bottom"
        appHref={officeHref}
        fromClass="from-sky-50"
        stackHeader
        header={
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f172a]/70">Owner</p>
            <h1 className="text-lg font-black leading-tight text-[#0f172a] sm:text-xl">{brand}</h1>
          </div>
        }
        tabs={tabs}
        tab={tab}
        onTab={setTab}
        navTestId="work-nav"
      >
        <ConstructionInstallPrompt />
        {tab === 'today' ? (
          <div className="space-y-3" data-testid="owner-today">
            <div className="grid grid-cols-2 gap-3">
              <ConstructionKpi icon={<HardHat />} label="On site" value={String(store.sites.filter((row) => row.status === 'on_site').length)} sub={`${store.sites.length} in the book`} />
              <ConstructionKpi icon={<Sun />} label="Diary today" value={String(store.diary.filter((row) => row.date === today).length)} sub={`${store.safety.filter((row) => row.status !== 'closed').length} safety items open`} tint="bg-white" />
            </div>
            {store.sites.filter((row) => row.status === 'on_site' && !store.diary.some((entry) => entry.site_id === row.id && entry.date === today)).map((site) => (
              <Card key={site.id}>
                <p className="font-black">{site.name}</p>
                <p className="text-sm text-slate-600">No diary yet for today.</p>
              </Card>
            ))}
            <Link className="inline-flex min-h-11 items-center font-black text-[#0f172a] underline decoration-[#00b4d8] decoration-2 underline-offset-4" href={officeHref}>Open the office</Link>
          </div>
        ) : null}
        {tab === 'projects' ? (
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="owner-projects">
            {store.sites.map((site) => (
              <li key={site.id}>
                <Card>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0f172a]/70">{site.code}</p>
                  <p className="font-black">{site.name}</p>
                  <p className="text-sm text-slate-600">{site.client || 'No client yet'}</p>
                  <div className="mt-2"><ConstructionStatusPill status={site.status} /></div>
                </Card>
              </li>
            ))}
            {!store.sites.length ? <Card>No projects yet</Card> : null}
          </ul>
        ) : null}
        {tab === 'plan' ? (
          <div className="space-y-3" data-testid="owner-plan">
            <ConstructionGantt rows={store.programme} today={today} readOnly />
            <h2 className="font-black">Schedule</h2>
            <ConstructionTimeline rows={store.programme} />
            {store.snags.length ? (
              <div data-testid="snag-board">
                <h2 className="font-black">Snags</h2>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  {(['open', 'in_progress', 'closed'] as const).map((status) => (
                    <div key={status} className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0f172a]">{status === 'in_progress' ? 'In progress' : status === 'open' ? 'Open' : 'Closed'}</p>
                      <ul className="mt-2 space-y-2">
                        {store.snags.filter((row) => (row.status || 'open') === status).map((row) => (
                          <li key={row.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-black">{row.item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <h2 className="font-black">Variations</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {store.variations.map((row) => (
                <Card key={row.id}>
                  <p className="font-black">{row.number} · {row.title || row.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ConstructionStatusPill status={row.status} />
                    {row.days ? <span className="text-sm text-slate-600">{row.days} days</span> : null}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
        {tab === 'money' ? (
          <div className="space-y-3" data-testid="money-panel">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <ConstructionKpi icon={<Wallet />} label="Claimed" value={formatRand(sumEntered(store.payments.map((row) => row.claimed_amount)))} sub="As entered" />
              <ConstructionKpi icon={<Wallet />} label="Certified" value={formatRand(sumEntered(store.payments.map((row) => row.certified_amount)))} sub="As entered" tint="bg-white" />
              <ConstructionKpi icon={<Wallet />} label="Paid" value={formatRand(sumEntered(store.payments.map((row) => row.paid_amount)))} sub="As entered" />
            </div>
            <Card>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0f172a]/70">Wallet</p>
              <p className="mb-3 text-sm text-slate-600">Amounts as entered. A blank paid figure stays a dash.</p>
              <ConstructionMoneyBars
                rows={[
                  { label: 'Claimed', value: sumEntered(store.payments.map((row) => row.claimed_amount)) },
                  { label: 'Certified', value: sumEntered(store.payments.map((row) => row.certified_amount)) },
                  { label: 'Paid', value: sumEntered(store.payments.map((row) => row.paid_amount)) },
                ]}
              />
            </Card>
            {store.payments.length ? (
              <ConstructionTable
                testId="owner-money-table"
                rows={store.payments}
                rowKey={(row) => row.id}
                columns={[
                  { key: 'number', header: 'Number', render: (row) => row.number },
                  { key: 'title', header: 'Title', render: (row) => row.title },
                  { key: 'claimed', header: 'Claimed', render: (row) => formatRand(row.claimed_amount) },
                  { key: 'certified', header: 'Certified', render: (row) => formatRand(row.certified_amount) },
                  { key: 'paid', header: 'Paid', render: (row) => formatRand(row.paid_amount) },
                  { key: 'status', header: 'Status', render: (row) => <ConstructionStatusPill status={resolvePaymentStatus(row, today)} /> },
                ]}
              />
            ) : <Card>No claims yet</Card>}
          </div>
        ) : null}
        {tab === 'team' ? (
          <div className="space-y-3" data-testid="owner-team">
            <Card>
              <p className="font-black">Workers and money</p>
              <p className="mt-1 text-sm text-slate-600">Site workers see certified and paid only when you allow it. The API enforces this.</p>
              <button
                type="button"
                data-testid="workers-money-toggle"
                className="mt-3 inline-flex min-h-11 items-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a]"
                onClick={() => onToggleWorkersMoney?.(!seeMoney)}
              >
                {seeMoney ? 'Hide certified and paid from workers' : 'Allow workers to see certified and paid'}
              </button>
            </Card>
            <h2 className="font-black">Site leads</h2>
            <ConstructionTable
              testId="owner-team-table"
              rows={store.sites}
              rowKey={(row) => row.id}
              columns={[
                { key: 'project', header: 'Project', render: (row) => `${row.code} · ${row.name}` },
                { key: 'lead', header: 'Site lead', render: (row) => row.site_manager_name || '—' },
                { key: 'phone', header: 'Phone', render: (row) => row.site_manager_phone || '—' },
                { key: 'status', header: 'Status', render: (row) => <ConstructionStatusPill status={row.status} /> },
              ]}
            />
            <h2 className="font-black">Trades on the sites</h2>
            <p className="text-sm text-slate-600">Subcontractors use TradeAdvisor®. Site Link coming next.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {store.subcontractors.map((row) => (
                <Card key={row.id} testId="site-link-slot">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black">{row.name}</p>
                      <p className="text-sm text-slate-600">{row.trade} · record only</p>
                    </div>
                    <ConstructionStatusPill status={row.status} />
                  </div>
                  <p className="mt-2 text-sm font-black text-[#0f172a]" data-testid="site-link-coming">Invite to TradeAdvisor® · Site Link coming next</p>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </MemberAdvisorShell>
    </div>
  );
}

export function WorkersApp({
  store,
  siteId,
  seeMoney,
  onLogTime,
  onPhotoNote,
}: {
  store: ConstructiongraphStore;
  siteId?: string | null;
  seeMoney: boolean;
  onLogTime?: (minutes: number, note: string) => void;
  onPhotoNote?: (caption: string) => void;
}) {
  const [tab, setTab] = useState<WorkerTab>('today');
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState('');
  const [caption, setCaption] = useState('');
  const today = sastToday();
  const sites = siteId ? store.sites.filter((row) => row.id === siteId) : store.sites;
  const siteIds = new Set(sites.map((row) => row.id));
  const tasks = store.programme.filter((row) => !siteId || row.site_id === siteId);
  const diary = (store.diary || []).filter((row) => !siteId || row.site_id === siteId);
  const snags = store.snags.filter((row) => !siteId || siteIds.has(String(row.site_id)));
  const materials = store.materials.filter((row) => !siteId || row.site_id === siteId);
  const photos = (store.photos || []).filter((row) => !siteId || row.site_id === siteId);
  const payments = seeMoney ? (store.payments || []).filter((row) => !siteId || row.site_id === siteId) : [];
  const tabs: MemberAdvisorTab<WorkerTab>[] = [
    { id: 'today', label: 'Today', icon: <Sun /> },
    { id: 'tasks', label: 'Tasks', icon: <HardHat /> },
    { id: 'diary', label: 'Diary', icon: <CalendarDays />, emphasis: true },
    { id: 'site', label: 'Site', icon: <Camera /> },
    { id: 'you', label: 'You', icon: <Wallet /> },
  ];
  return (
    <div data-testid="role-workers">
      <MemberAdvisorShell
        color="#00b4d8"
        solidBrand
        presence={false}
        mobileNav="bottom"
        appHref="/work/constructiongraph"
        fromClass="from-sky-50"
        stackHeader
        header={
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f172a]/70">Workers · ConstructionAdvisor®</p>
            <h1 className="text-lg font-black leading-tight text-[#0f172a] sm:text-xl">{sites[0]?.name || 'Site team'}</h1>
          </div>
        }
        tabs={tabs}
        tab={tab}
        onTab={setTab}
        navTestId="work-nav"
      >
        <ConstructionInstallPrompt />
        {tab === 'today' ? (
          <div className="space-y-3" data-testid="workers-today">
            {sites.map((site) => (
              <Card key={site.id}><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0f172a]/70">{site.code}</p><p className="font-black">{site.name}</p><p className="text-sm text-slate-600">{site.address}</p></Card>
            ))}
            {!sites.length ? <Card>No sites on this link.</Card> : null}
          </div>
        ) : null}
        {tab === 'tasks' ? (
          <div data-testid="workers-tasks">
            <ConstructionGantt rows={tasks} today={today} readOnly />
          </div>
        ) : null}
        {tab === 'diary' ? (
          <ul className="space-y-2" data-testid="workers-diary">
            {diary.map((row) => (
              <li key={row.id}><Card><p className="font-black">{row.date}</p><p className="text-sm text-slate-700">{row.weather} · {row.progress_note}</p></Card></li>
            ))}
            {!diary.length ? <Card>No diary entries yet. Start today&apos;s diary.</Card> : null}
          </ul>
        ) : null}
        {tab === 'site' ? (
          <div className="space-y-3" data-testid="workers-site">
            <h2 className="font-black">Snags</h2>
            {snags.map((row) => <Card key={row.id}><p className="font-black">{row.item}</p><p className="text-sm text-slate-600">{row.status}</p></Card>)}
            {!snags.length ? <Card>No open snags.</Card> : null}
            <h2 className="font-black">Materials</h2>
            {materials.map((row) => <Card key={row.id}><p className="font-black">{row.item}</p><p className="text-sm tabular-nums text-slate-600">{row.delivered_qty || 0} of {row.ordered_qty} {row.uom}</p></Card>)}
            <h2 className="font-black">Photos</h2>
            <p className="text-sm text-slate-600">Image files are not stored in ConstructionAdvisor®. A caption is the record.</p>
            {photos.map((row) => <Card key={row.id} testId="photo-note"><p className="font-black">{row.caption}</p></Card>)}
            {!photos.length ? <Card>No site photos yet.</Card> : null}
            {onPhotoNote ? (
              <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); if (!caption.trim()) return; onPhotoNote(caption.trim()); setCaption(''); }}>
                <input className={constructionField} data-testid="photo-caption" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Caption" />
                <button className="inline-flex min-h-11 items-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a]" type="submit">Save caption</button>
              </form>
            ) : null}
          </div>
        ) : null}
        {tab === 'you' ? (
          <div className="space-y-3" data-testid="workers-you">
            <Card>
              <p className="font-black">Time</p>
              {onLogTime ? (
                <form className="mt-2 space-y-2" onSubmit={(event) => { event.preventDefault(); onLogTime(minutes, note); setNote(''); }}>
                  <input className={constructionField} data-testid="crew-time" type="number" min={1} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
                  <input className={constructionField} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note" />
                  <button className="inline-flex min-h-11 items-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a]" type="submit">Log time</button>
                </form>
              ) : <p className="text-sm text-slate-600">{(store.time_entries || []).filter((row) => !siteId || row.site_id === siteId).length} time records on this site.</p>}
            </Card>
            {seeMoney ? (
              <div data-testid="workers-money">
                {payments.map((row) => (
                  <Card key={row.id}><p className="font-black">{row.number}</p><p className="text-sm tabular-nums">Certified {formatRand(row.certified_amount)} · Paid {formatRand(row.paid_amount)}</p></Card>
                ))}
                {!payments.length ? <Card>No certified amounts on this site.</Card> : null}
              </div>
            ) : (
              <Card testId="workers-money-hidden"><p className="font-black">Invoices stay with the owner.</p><p className="text-sm text-slate-600">Certified and paid amounts appear here only if the owner allows it.</p></Card>
            )}
          </div>
        ) : null}
      </MemberAdvisorShell>
    </div>
  );
}

export function ClientApp({ view }: { view: ClientPortalView }) {
  const [tab, setTab] = useState<ClientTab>('project');
  const tabs: MemberAdvisorTab<ClientTab>[] = [
    { id: 'project', label: 'Project', icon: <HardHat />, emphasis: true },
    { id: 'plan', label: 'Plan', icon: <CalendarDays /> },
    { id: 'money', label: 'Money', icon: <Wallet /> },
    { id: 'documents', label: 'Documents', icon: <FileText /> },
    { id: 'more', label: 'More', icon: <Camera /> },
  ];
  return (
    <div data-testid="role-client">
      <MemberAdvisorShell
        color="#00b4d8"
        solidBrand
        presence={false}
        mobileNav="bottom"
        appHref="/preview/constructiongraph"
        fromClass="from-sky-50"
        stackHeader
        header={
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f172a]/70">Client</p>
            <h1 className="text-lg font-black leading-tight text-[#0f172a] sm:text-xl">ConstructionAdvisor®</h1>
            <p className="text-sm font-semibold leading-tight text-[#0f172a]/80">{view.clientName}</p>
            {view.companyName && !view.companyName.includes('ConstructionAdvisor') ? (
              <p className="text-xs font-semibold text-[#0f172a]/70">{view.companyName}</p>
            ) : null}
          </div>
        }
        tabs={tabs}
        tab={tab}
        onTab={setTab}
      >
        <ConstructionInstallPrompt />
        {tab === 'project' ? (
          <ul className="space-y-2" data-testid="client-projects">
            {view.projects.map((row) => (
              <li key={row.siteId}>
                <Card>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0f172a]/70">{row.code}</p>
                  <p className="font-black">{row.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <ConstructionStatusPill status={row.status} />
                    <span>Plan {formatPct(row.plannedPct)}</span>
                    <span>Actual {formatPct(row.actualPct)}</span>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
        {tab === 'plan' ? (
          <div data-testid="client-plan" className="space-y-2">
            {view.activities.map((row) => (
              <Card key={row.id}>
                <p className="font-black">{row.activity}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span>{row.siteCode}</span>
                  <ConstructionStatusPill status={row.status} />
                  <span>Plan {formatPct(row.plannedPct)}</span>
                  <span>Actual {formatPct(row.actualPct)}</span>
                </div>
              </Card>
            ))}
            <h2 className="font-black">Variations</h2>
            {(view.variations || []).map((row) => <Card key={row.id}><p className="font-black">{row.number} · {row.title}</p><p className="text-sm text-slate-600">{row.status}{row.days ? ` · ${row.days} days` : ''}</p></Card>)}
            {!(view.variations || []).length ? <Card>No variations on your projects.</Card> : null}
          </div>
        ) : null}
        {tab === 'money' ? (
          <div className="space-y-2" data-testid="client-money">
            <Card>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0f172a]/70">Wallet</p>
              <p className="mb-3 text-sm text-slate-600">Certified and paid, as entered. View only.</p>
              <ConstructionMoneyBars
                rows={[
                  { label: 'Certified', value: sumEntered(view.payments.map((row) => row.certifiedAmount)) },
                  { label: 'Paid', value: sumEntered(view.payments.map((row) => row.paidAmount)) },
                ]}
              />
            </Card>
            {view.payments.map((row) => (
              <Card key={row.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-black">{row.number} · {row.title}</p>
                  <ConstructionStatusPill status={row.status} />
                </div>
                <p className="mt-2 text-sm tabular-nums text-slate-700">Certified {formatRand(row.certifiedAmount)} · Paid {formatRand(row.paidAmount)}</p>
              </Card>
            ))}
            {!view.payments.length ? <Card>No certificates yet.</Card> : null}
          </div>
        ) : null}
        {tab === 'documents' ? (
          <ul className="space-y-2" data-testid="client-documents">
            {(view.documents || []).map((row) => <li key={row.id}><Card><p className="font-black">{row.number} · {row.title}</p><p className="text-sm text-slate-600">Rev {row.revision || '—'} · {row.status}</p></Card></li>)}
            {!(view.documents || []).length ? <Card>Files are not stored in ConstructionAdvisor® yet. This register tracks what was issued.</Card> : null}
          </ul>
        ) : null}
        {tab === 'more' ? (
          <ul className="space-y-2" data-testid="client-photos">
            {(view.photos || []).map((row) => <li key={row.id}><Card><p className="font-black">{row.caption}</p></Card></li>)}
            {!(view.photos || []).length ? <Card>No site photos yet.</Card> : null}
          </ul>
        ) : null}
      </MemberAdvisorShell>
    </div>
  );
}

export function PublicProgramme({ view }: { view: PublicPortalView }) {
  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-[#f8fafc] p-4 text-[#0f172a]" data-testid="role-public">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f172a]">ConstructionAdvisor®</p>
      <h1 className="text-2xl font-black">{view.companyName}</h1>
      <ul className="mt-4 space-y-2">
        {view.projects.map((row) => (
          <li key={row.code} className={constructionCardPad}>
            <p className="font-black">{row.code} · {row.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <ConstructionStatusPill status={row.status} />
              <span>Plan {formatPct(row.plannedPct)}</span>
              <span>Actual {formatPct(row.actualPct)}</span>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function workersStoreFromPortal(view: ContractorPortalView): { siteName: string } {
  return { siteName: view.projectName };
}

export function newPhotoNote(siteId: string, caption: string) {
  return { id: newConstructionId('photo'), site_id: siteId, caption, taken_on: sastToday(), author_name: 'Site' };
}

export function newTimeEntry(siteId: string, minutes: number, note: string) {
  return { id: newConstructionId('time'), site_id: siteId, minutes, note, at: new Date().toISOString(), author_name: 'Site' };
}
