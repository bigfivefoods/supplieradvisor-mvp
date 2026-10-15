'use client';

import { useMemo, useState } from 'react';
import { FileText, HardHat, Package, Users } from 'lucide-react';
import {
  ConstructionButton,
  ConstructionDrawer,
  ConstructionEmpty,
  ConstructionMoney,
  ConstructionPageHead,
  ConstructionSegmented,
  ConstructionStatusPill,
  ConstructionTable,
  ConstructionUnavailable,
  constructionField,
} from '@/components/construction/ConstructionUi';
import { ScreenState, type DeskProps } from '@/components/construction/desk';
import {
  newConstructionId,
  quoteBoqTotal,
  type ConstructionClient,
  type ConstructionQuote,
  type ConstructionSite,
  type ConstructionSubcontractor,
} from '@/lib/construction/constructiongraph';
import { formatRand } from '@/lib/construction/format';

function useOpen<T>() {
  const [row, setRow] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  return { row, setRow, creating, setCreating, close: () => { setRow(null); setCreating(false); } };
}

export function ClientsView(props: DeskProps) {
  const form = useOpen<ConstructionClient>();
  const [draft, setDraft] = useState({ name: '', city: '', contact: '' });
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="clients" onRetry={props.handlers.retry} />;
  }
  const empty = props.state === 'empty' || props.store.clients.length === 0;
  const money = props.caps.canSeeMoney && Object.prototype.hasOwnProperty.call(props.store, 'payments');
  return (
    <div className="space-y-4" data-testid="clients-view">
      <ConstructionPageHead
        title="Clients"
        badge={props.badge}
        detail="Each client can hold many projects. Open a row to edit or issue a client link."
        actions={props.caps.canEditProjects ? <ConstructionButton data-testid="client-add" onClick={() => { setDraft({ name: '', city: '', contact: '' }); form.setCreating(true); }}>Add client</ConstructionButton> : null}
      />
      {empty ? (
        <ConstructionEmpty testId="clients-empty" icon={<Users />} title="No clients yet" hint="Add the first client, then attach a project." action={props.caps.canEditProjects ? <ConstructionButton onClick={() => form.setCreating(true)}>Add client</ConstructionButton> : null} />
      ) : (
        <ConstructionTable
          testId="clients-table"
          rows={props.store.clients}
          rowKey={(row) => row.id}
          onRow={(row) => form.setRow(row)}
          columns={[
            { key: 'name', header: 'Client', render: (row) => row.name },
            { key: 'projects', header: 'Projects', render: (row) => String(props.store.sites.filter((site) => site.client_id === row.id).length) },
            { key: 'value', header: 'Contract value', render: (row) => money ? formatRand(props.store.sites.filter((site) => site.client_id === row.id).reduce((sum, site) => sum + (Number(site.contract_value) || 0), 0)) : '—' },
            { key: 'activity', header: 'Last activity', render: (row) => row.city || '—' },
          ]}
        />
      )}
      <ConstructionDrawer open={form.creating || Boolean(form.row)} title={form.row ? form.row.name : 'New client'} onClose={form.close} testId="client-drawer">
        <label className={ConstructionLabelFix}>Name<input data-testid="client-name" className={constructionField} value={form.row?.name || draft.name} onChange={(event) => form.row ? form.setRow({ ...form.row, name: event.target.value }) : setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="mt-3 block text-xs font-bold text-slate-700">City<input className={constructionField} value={form.row?.city || draft.city} onChange={(event) => form.row ? form.setRow({ ...form.row, city: event.target.value }) : setDraft({ ...draft, city: event.target.value })} /></label>
        <label className="mt-3 block text-xs font-bold text-slate-700">Contact<input className={constructionField} value={form.row?.contact || draft.contact} onChange={(event) => form.row ? form.setRow({ ...form.row, contact: event.target.value }) : setDraft({ ...draft, contact: event.target.value })} /></label>
        {props.caps.canEditProjects ? (
          <ConstructionButton className="mt-4" data-testid="client-save" onClick={() => {
            const name = (form.row?.name || draft.name).trim();
            if (!name) return;
            const row = form.row || { id: newConstructionId('cli'), name, city: draft.city, contact: draft.contact };
            void props.handlers.merge({ clients: [{ ...row, name }] });
            form.close();
          }}>Save client</ConstructionButton>
        ) : null}
        {form.row && props.caps.canManagePortals ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-black text-slate-900">Client link</p>
            <p className="mt-1 text-xs text-slate-600">Issue a link for this client. The full link is shown once.</p>
            <ConstructionButton className="mt-3" data-testid="portal-issue-client" onClick={() => void props.handlers.run({ action: 'ensure_client_portal', clientId: form.row?.id })}>Issue client link</ConstructionButton>
          </div>
        ) : null}
      </ConstructionDrawer>
    </div>
  );
}

const ConstructionLabelFix = 'block text-xs font-bold text-slate-700';

export function QuotesView(props: DeskProps) {
  const [filter, setFilter] = useState<'all' | 'draft' | 'issued' | 'accepted' | 'declined'>('all');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="quotes" onRetry={props.handlers.retry} />;
  }
  if (!props.caps.canSeeCostsAndBoq) return <div className="space-y-4" data-testid="quotes-view"><ConstructionPageHead title="Quotes" badge={props.badge} detail="BOQ quotes are limited to money roles." /><ConstructionUnavailable testId="quotes-empty" /></div>;
  const rows = props.store.quotes.filter((row) => filter === 'all' || row.status === filter);
  const empty = props.state === 'empty' || props.store.quotes.length === 0;
  return (
    <div className="space-y-4" data-testid="quotes-view">
      <ConstructionPageHead title="Quotes" badge={props.badge} detail="Amounts are shown as entered. This book does not calculate VAT." actions={<ConstructionButton data-testid="quote-add" onClick={() => setOpen(true)}>New quote</ConstructionButton>} />
      <ConstructionSegmented testId="quotes-filter" label="Quote status" value={filter} onChange={setFilter} options={[{ id: 'all', label: 'All' }, { id: 'draft', label: 'Draft' }, { id: 'issued', label: 'Issued' }, { id: 'accepted', label: 'Accepted' }, { id: 'declined', label: 'Lost' }]} />
      {empty ? <ConstructionEmpty testId="quotes-empty" icon={<FileText />} title="No quotes yet" hint="Build a BOQ and issue it to the client." action={<ConstructionButton onClick={() => setOpen(true)}>New quote</ConstructionButton>} /> : (
        <ConstructionTable testId="quotes-table" rows={rows} rowKey={(row) => row.id} columns={[
          { key: 'number', header: 'Quote', render: (row) => `${row.number} · ${row.title}` },
          { key: 'status', header: 'Status', render: (row) => <ConstructionStatusPill status={row.status} /> },
          { key: 'total', header: 'As entered', render: (row) => <ConstructionMoney value={quoteBoqTotal(props.store, row.id)} /> },
        ]} />
      )}
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="boq-lines">
        <h3 className="text-sm font-black text-slate-900">BOQ lines</h3>
        <ul className="mt-2 space-y-2">
          {props.store.boq.map((row) => (
            <li key={row.id} data-row-id={row.id} className="flex items-center justify-between gap-3 text-sm">
              <span>{row.item_no} · {row.description}</span>
              <span className="tabular-nums">{row.rate == null ? '—' : formatRand((Number(row.qty) || 0) * (Number(row.rate) || 0))}</span>
            </li>
          ))}
        </ul>
      </section>
      <ConstructionDrawer open={open} title="New quote" onClose={() => setOpen(false)} testId="quote-drawer">
        <label className={ConstructionLabelFix}>Title<input data-testid="quote-title" className={constructionField} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <ConstructionButton className="mt-4" data-testid="quote-save" onClick={() => {
          if (!title.trim()) return;
          const row: ConstructionQuote = { id: newConstructionId('qt'), number: `QT-${Date.now().toString(36)}`, title: title.trim(), status: 'draft' };
          void props.handlers.merge({ quotes: [row] });
          setOpen(false);
        }}>Save quote</ConstructionButton>
      </ConstructionDrawer>
    </div>
  );
}

export function ProjectsView(props: DeskProps) {
  const [mode, setMode] = useState<'cards' | 'table'>('cards');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ConstructionSite | null>(null);
  const [tab, setTab] = useState<'overview' | 'programme' | 'money' | 'team' | 'documents' | 'snags'>('overview');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="projects" onRetry={props.handlers.retry} />;
  }
  const empty = props.state === 'empty' || props.store.sites.length === 0;
  const money = props.caps.canSeeMoney;
  return (
    <div className="space-y-4" data-testid="projects-view">
      <ConstructionPageHead title="Projects" badge={props.badge} detail="Contracts, site managers, and the status of each project." actions={props.caps.canEditProjects ? <ConstructionButton data-testid="project-add" onClick={() => setOpen(true)}>New project</ConstructionButton> : null} />
      <ConstructionSegmented value={mode} onChange={setMode} label="Project layout" options={[{ id: 'cards', label: 'Cards' }, { id: 'table', label: 'Table' }]} />
      {empty ? <ConstructionEmpty testId="projects-empty" icon={<HardHat />} title="No projects yet" hint="Create a project and link it to a client." action={props.caps.canEditProjects ? <ConstructionButton onClick={() => setOpen(true)}>New project</ConstructionButton> : null} /> : mode === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {props.store.sites.map((site) => (
            <button key={site.id} type="button" data-row-id={site.id} data-testid="project-card" className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm" onClick={() => { setSelected(site); setTab('overview'); }}>
              <p className="text-sm font-black text-slate-900">{site.code} · {site.name}</p>
              <p className="text-xs text-slate-600">{site.client || 'No client yet'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <ConstructionStatusPill status={site.status} />
                {site.contract_type ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-700">{site.contract_type}</span> : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <ConstructionTable testId="projects-table" rows={props.store.sites} rowKey={(row) => row.id} onRow={(row) => setSelected(row)} columns={[
          { key: 'code', header: 'Project', render: (row) => `${row.code} · ${row.name}` },
          { key: 'client', header: 'Client', render: (row) => row.client || '—' },
          { key: 'status', header: 'Status', render: (row) => <ConstructionStatusPill status={row.status} /> },
          { key: 'value', header: 'Contract', render: (row) => money && row.contract_value != null ? formatRand(row.contract_value) : '—' },
        ]} />
      )}
      <ConstructionDrawer open={open} title="New project" onClose={() => setOpen(false)} testId="project-create">
        <label className={ConstructionLabelFix}>Name<input data-testid="project-name" className={constructionField} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="mt-3 block text-xs font-bold text-slate-700">Code<input data-testid="project-code" className={constructionField} value={code} onChange={(event) => setCode(event.target.value)} /></label>
        <ConstructionButton className="mt-4" data-testid="project-save" onClick={() => {
          if (!name.trim() || !code.trim()) return;
          void props.handlers.merge({ sites: [{ id: newConstructionId('site'), name: name.trim(), code: code.trim(), status: 'tender' }] });
          setOpen(false);
          setName('');
          setCode('');
        }}>Save project</ConstructionButton>
      </ConstructionDrawer>
      <ConstructionDrawer open={Boolean(selected)} title={selected ? `${selected.code} · ${selected.name}` : 'Project'} onClose={() => setSelected(null)} testId="project-drawer">
        {selected ? (
          <div className="space-y-3">
            <ConstructionSegmented value={tab} onChange={setTab} label="Project sections" options={[
              { id: 'overview', label: 'Overview' },
              { id: 'programme', label: 'Programme' },
              ...(props.caps.canSeeMoney ? [{ id: 'money' as const, label: 'Money' }] : []),
              { id: 'team', label: 'Team' },
              { id: 'documents', label: 'Documents' },
              { id: 'snags', label: 'Snags' },
            ]} />
            {tab === 'overview' ? (
              <div className="space-y-2 text-sm text-slate-700">
                <ConstructionStatusPill status={selected.status} />
                <p>Site manager: {selected.site_manager_name || '—'}</p>
                <p>Phone: {selected.site_manager_phone || '—'}</p>
                <p>Contract: {selected.contract_type || '—'}</p>
                {props.caps.canEditProjectNotes ? (
                  <ConstructionButton onClick={() => void props.handlers.merge({ sites: [{ id: selected.id, status: selected.status === 'on_site' ? 'practical_completion' : 'on_site', notes: selected.notes, sample: selected.sample } as ConstructionSite] })}>Update status</ConstructionButton>
                ) : null}
              </div>
            ) : null}
            {tab === 'programme' ? <ul>{props.store.programme.filter((row) => row.site_id === selected.id).map((row) => <li key={row.id} data-row-id={row.id}>{row.activity}</li>)}</ul> : null}
            {tab === 'money' && props.caps.canSeeMoney ? <p className="text-sm">{selected.contract_value != null ? <ConstructionMoney value={selected.contract_value} /> : '—'}</p> : null}
            {tab === 'team' ? <ul>{props.store.subcontractors.filter((row) => row.site_id === selected.id).map((row) => <li key={row.id} data-row-id={row.id}>{row.name}</li>)}</ul> : null}
            {tab === 'documents' ? <ul>{props.store.drawings.filter((row) => row.site_id === selected.id).map((row) => <li key={row.id} data-row-id={row.id}>{row.title}</li>)}</ul> : null}
            {tab === 'snags' ? <ul>{props.store.snags.filter((row) => row.site_id === selected.id).map((row) => <li key={row.id} data-row-id={row.id}>{row.item}</li>)}</ul> : null}
          </div>
        ) : null}
      </ConstructionDrawer>
    </div>
  );
}

export function SubcontractorsView(props: DeskProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ConstructionSubcontractor | null>(null);
  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="subcontractors" onRetry={props.handlers.retry} />;
  }
  const money = props.caps.canSeeCostsAndBoq;
  const empty = props.state === 'empty' || props.store.subcontractors.length === 0;
  const rows = useMemo(() => props.store.subcontractors, [props.store.subcontractors]);
  return (
    <div className="space-y-4" data-testid="subcontractors-view">
      <ConstructionPageHead title="Subcontractors" badge={props.badge} detail="Trade, package, and the documents recorded against each company." actions={props.caps.canEditProjects ? <ConstructionButton data-testid="sub-add" onClick={() => setOpen(true)}>Add subcontractor</ConstructionButton> : null} />
      {empty ? <ConstructionEmpty testId="subcontractors-empty" icon={<Package />} title="No subcontractors yet" hint="This list is a record of the trades on a site. They use TradeAdvisor®." action={props.caps.canEditProjects ? <ConstructionButton onClick={() => setOpen(true)}>Add subcontractor</ConstructionButton> : null} /> : (
        <ConstructionTable testId="subcontractors-table" rows={rows} rowKey={(row) => row.id} onRow={setSelected} columns={[
          { key: 'trade', header: 'Trade', render: (row) => row.trade },
          { key: 'package', header: 'Package', render: (row) => row.package_label || '—' },
          { key: 'project', header: 'Project', render: (row) => props.store.sites.find((site) => site.id === row.site_id)?.name || '—' },
          { key: 'value', header: 'Contract', render: (row) => money && row.contract_value != null ? formatRand(row.contract_value) : '—' },
          { key: 'status', header: 'Status', render: (row) => <ConstructionStatusPill status={row.status} /> },
          { key: 'contact', header: 'Contact', render: (row) => row.phone || row.email || row.contact || '—' },
          { key: 'light', header: 'Documents', render: (row) => {
            const docs = props.store.safety.filter((item) => (item.company || '').toLowerCase() === row.name.toLowerCase());
            return docs.length ? `${docs.length} on file` : 'None on file';
          } },
        ]} />
      )}
      <ConstructionDrawer open={open} title="New subcontractor" onClose={() => setOpen(false)}>
        <label className={ConstructionLabelFix}>Name<input data-testid="sub-name" className={constructionField} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="mt-3 block text-xs font-bold text-slate-700">Trade<input data-testid="sub-trade" className={constructionField} value={trade} onChange={(event) => setTrade(event.target.value)} /></label>
        <ConstructionButton className="mt-4" onClick={() => {
          if (!name.trim()) return;
          void props.handlers.merge({ subcontractors: [{ id: newConstructionId('sub'), name: name.trim(), trade: trade.trim() || 'Trade', status: 'tendering' }] });
          setOpen(false);
        }}>Save subcontractor</ConstructionButton>
      </ConstructionDrawer>
      <ConstructionDrawer open={Boolean(selected)} title={selected?.name || 'Subcontractor'} onClose={() => setSelected(null)} testId="sub-drawer">
        {selected ? (
          <div className="space-y-3 text-sm">
            <p className="font-black">{selected.name}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0f172a]">Programme</p>
            <ul className="space-y-1">
              {props.store.programme.filter((row) => row.subcontractor_id === selected.id || row.package_label === selected.package_label).map((row) => (
                <li key={row.id} data-row-id={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Programme</span>
                  <span className="mt-0.5 block font-black text-[#0f172a]">{row.activity}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0f172a]">Snags</p>
            <ul className="space-y-1">
              {props.store.snags.filter((row) => row.assigned_to === selected.name).map((row) => (
                <li key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Snag</span>
                  <span className="mt-0.5 block font-black text-[#0f172a]">{row.item}</span>
                </li>
              ))}
            </ul>
            <div data-testid="site-link-slot">
              <p className="font-black">Invite to TradeAdvisor®</p>
              <p className="text-sm font-black text-[#0f172a]" data-testid="site-link-coming">Site Link coming next</p>
              <button type="button" disabled className="mt-2 inline-flex min-h-11 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-500">Invite to TradeAdvisor®</button>
            </div>
          </div>
        ) : null}
      </ConstructionDrawer>
    </div>
  );
}
