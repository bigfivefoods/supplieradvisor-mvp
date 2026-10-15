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
import { ConstructionGantt } from '@/components/construction/ConstructionGantt';
import { ConstructionInstallPrompt } from '@/components/construction/ConstructionInstall';
import { constructionCardPad, constructionField } from '@/components/construction/ConstructionUi';
import {
  newConstructionId,
  type ClientPortalView,
  type ConstructiongraphStore,
  type ContractorPortalView,
  type PublicPortalView,
} from '@/lib/construction/constructiongraph';
import { formatRand, sastToday } from '@/lib/construction/format';

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
        header={
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f172a]/70">Owner · ConstructionAdvisor®</p>
            <h1 className="truncate text-xl font-black text-[#0f172a]">{brand}</h1>
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
            <Card>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">Today</p>
              <p className="mt-1 text-lg font-black">{store.sites.filter((row) => row.status === 'on_site').length} projects on site</p>
              <p className="text-sm text-slate-600">{store.diary.filter((row) => row.date === today).length} diary entries for today. {store.safety.filter((row) => row.status !== 'closed').length} health and safety items still open.</p>
            </Card>
            {store.sites.filter((row) => row.status === 'on_site' && !store.diary.some((entry) => entry.site_id === row.id && entry.date === today)).map((site) => (
              <Card key={site.id}>
                <p className="font-black">{site.name}</p>
                <p className="text-sm text-slate-600">No diary yet for today.</p>
              </Card>
            ))}
            <Link className="inline-flex min-h-11 items-center font-black text-[#0077b6]" href={officeHref}>Open the office</Link>
          </div>
        ) : null}
        {tab === 'projects' ? (
          <ul className="space-y-2" data-testid="owner-projects">
            {store.sites.map((site) => (
              <li key={site.id}><Card><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">{site.code}</p><p className="font-black">{site.name}</p><p className="text-sm text-slate-600">{site.status} · {site.client}</p></Card></li>
            ))}
            {!store.sites.length ? <Card>No projects yet</Card> : null}
          </ul>
        ) : null}
        {tab === 'plan' ? (
          <div className="space-y-3" data-testid="owner-plan">
            <ConstructionGantt rows={store.programme} today={today} readOnly />
            <h2 className="font-black">Variations</h2>
            {store.variations.map((row) => (
              <Card key={row.id}><p className="font-black">{row.number} · {row.title || row.description}</p><p className="text-sm text-slate-600">{row.status}{row.days ? ` · ${row.days} days` : ''}</p></Card>
            ))}
          </div>
        ) : null}
        {tab === 'money' ? (
          <div className="space-y-3" data-testid="money-panel">
            <Card>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">Wallet</p>
              <p className="text-sm text-slate-600">Amounts as entered.</p>
            </Card>
            {store.payments.map((row) => (
              <Card key={row.id}>
                <p className="font-black">{row.number} · {row.title}</p>
                <p className="text-sm tabular-nums text-slate-700">Claimed {formatRand(row.claimed_amount)} · Certified {formatRand(row.certified_amount)} · Paid {formatRand(row.paid_amount)}</p>
              </Card>
            ))}
            {!store.payments.length ? <Card>No claims yet</Card> : null}
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
                {seeMoney ? 'Workers can see certified and paid' : 'Workers cannot see certified and paid'}
              </button>
            </Card>
            {store.sites.map((site) => (
              <Card key={site.id}><p className="font-black">{site.site_manager_name || 'Site team'}</p><p className="text-sm text-slate-600">{site.name}{site.site_manager_phone ? ` · ${site.site_manager_phone}` : ''}</p></Card>
            ))}
            <h2 className="font-black">Trades on the sites</h2>
            <p className="text-sm text-slate-600">Subcontractors use TradeAdvisor®. Site Link coming next.</p>
            {store.subcontractors.map((row) => (
              <Card key={row.id} testId="site-link-slot">
                <p className="font-black">{row.name}</p>
                <p className="text-sm text-slate-600">{row.trade} · record only</p>
                <p className="mt-2 text-sm font-black text-[#0077b6]" data-testid="site-link-coming">Invite to TradeAdvisor® · Site Link coming next</p>
              </Card>
            ))}
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
        header={
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f172a]/70">Workers · ConstructionAdvisor®</p>
            <h1 className="truncate text-xl font-black text-[#0f172a]">{sites[0]?.name || 'Site team'}</h1>
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
              <Card key={site.id}><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">{site.code}</p><p className="font-black">{site.name}</p><p className="text-sm text-slate-600">{site.address}</p></Card>
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
        header={
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f172a]/70">Client · ConstructionAdvisor®</p>
            <h1 className="truncate text-xl font-black text-[#0f172a]">{view.companyName}</h1>
            <p className="truncate text-sm font-semibold text-[#0f172a]/80">{view.clientName}</p>
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
              <li key={row.siteId}><Card><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">{row.code}</p><p className="font-black">{row.name}</p><p className="text-sm text-slate-600">{row.status} · plan {row.plannedPct}% · actual {row.actualPct}%</p></Card></li>
            ))}
          </ul>
        ) : null}
        {tab === 'plan' ? (
          <div data-testid="client-plan" className="space-y-2">
            {view.activities.map((row) => (
              <Card key={row.id}><p className="font-black">{row.activity}</p><p className="text-sm text-slate-600">{row.siteCode} · {row.status} · plan {row.plannedPct}% · actual {row.actualPct}%</p></Card>
            ))}
            <h2 className="font-black">Variations</h2>
            {(view.variations || []).map((row) => <Card key={row.id}><p className="font-black">{row.number} · {row.title}</p><p className="text-sm text-slate-600">{row.status}{row.days ? ` · ${row.days} days` : ''}</p></Card>)}
            {!(view.variations || []).length ? <Card>No variations on your projects.</Card> : null}
          </div>
        ) : null}
        {tab === 'money' ? (
          <div className="space-y-2" data-testid="client-money">
            <Card><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">Wallet</p><p className="text-sm text-slate-600">Certified and paid, as entered. View only.</p></Card>
            {view.payments.map((row) => (
              <Card key={row.id}><p className="font-black">{row.number} · {row.title}</p><p className="text-sm tabular-nums text-slate-700">Certified {formatRand(row.certifiedAmount)} · Paid {formatRand(row.paidAmount)}</p></Card>
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
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0077b6]">ConstructionAdvisor®</p>
      <h1 className="text-2xl font-black">{view.companyName}</h1>
      <ul className="mt-4 space-y-2">
        {view.projects.map((row) => (
          <li key={row.code} className={constructionCardPad}><p className="font-black">{row.code} · {row.name}</p><p className="text-sm text-slate-600">{row.status} · plan {row.plannedPct}% · actual {row.actualPct}%</p></li>
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
