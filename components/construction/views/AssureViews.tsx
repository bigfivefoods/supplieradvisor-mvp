'use client';

import { useState } from 'react';
import { ClipboardCheck, FileStack, Package, ScrollText } from 'lucide-react';
import {
  ConstructionButton,
  ConstructionDrawer,
  ConstructionEmpty,
  ConstructionMoney,
  ConstructionPageHead,
  ConstructionProgress,
  ConstructionStatusPill,
  ConstructionTable,
  ConstructionUnavailable,
  constructionField,
} from '@/components/construction/ConstructionUi';
import { ScreenState, type DeskProps } from '@/components/construction/desk';
import { projectReport, newConstructionId, type ConstructionDrawing, type ConstructionMaterial, type ConstructionSnag } from '@/lib/construction/constructiongraph';
import { sastToday } from '@/lib/construction/format';
import { QrMark } from '@/components/construction/QrMark';

const DOCUMENTS_EMPTY =
  'Files are not stored in ConstructionAdvisor® yet. This register tracks what was issued, to whom, and which revision is current.';

export function DocumentsView(props: DeskProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [number, setNumber] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="documents" onRetry={props.handlers.retry} />;
  }
  const rows = props.store.drawings;
  const canWrite = props.caps.canWriteDiary || props.role === 'owner';
  return (
    <div className="space-y-4" data-testid="documents-view">
      <ConstructionPageHead
        title="Documents"
        badge={props.badge}
        detail={DOCUMENTS_EMPTY}
        actions={canWrite ? <ConstructionButton data-testid="document-add" onClick={() => setOpen(true)}>Record issue</ConstructionButton> : null}
      />
      {rows.length === 0 ? (
        <ConstructionEmpty testId="documents-empty" icon={<FileStack />} title="No documents yet" hint={DOCUMENTS_EMPTY} />
      ) : (
        <ConstructionTable
          testId="documents-table"
          rows={rows}
          rowKey={(row: ConstructionDrawing) => row.id}
          columns={[
            { key: 'number', header: 'Number', render: (row) => row.drawing_no },
            { key: 'title', header: 'Title', render: (row) => row.title },
            { key: 'revision', header: 'Revision', render: (row) => row.revision || '—' },
            { key: 'issued', header: 'Issued to', render: (row) => row.issued_to || '—' },
            { key: 'status', header: 'Status', render: (row) => <ConstructionStatusPill status={row.status} /> },
          ]}
        />
      )}
      <ConstructionDrawer open={open} title="Record a document" onClose={() => setOpen(false)} testId="document-drawer">
        <label className="block text-xs font-bold text-slate-700">Number<input data-testid="document-number" className={constructionField} value={number} onChange={(event) => setNumber(event.target.value)} /></label>
        <label className="mt-3 block text-xs font-bold text-slate-700">Title<input data-testid="document-title" className={constructionField} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="mt-3 block text-xs font-bold text-slate-700">Issued to<input data-testid="document-issued" className={constructionField} value={issuedTo} onChange={(event) => setIssuedTo(event.target.value)} /></label>
        <ConstructionButton className="mt-4" data-testid="document-save" onClick={() => {
          if (!title.trim()) return;
          const row: ConstructionDrawing = {
            id: newConstructionId('doc'),
            site_id: props.store.sites[0]?.id,
            drawing_no: number.trim() || 'DOC',
            title: title.trim(),
            revision: 'A',
            status: 'issued',
            doc_kind: 'drawing',
            issued_on: sastToday(),
            issued_to: issuedTo.trim(),
          };
          void props.handlers.merge({ drawings: [row] });
          setOpen(false);
        }}>Save register row</ConstructionButton>
      </ConstructionDrawer>
    </div>
  );
}

export function MaterialsView(props: DeskProps) {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState('');
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="materials" onRetry={props.handlers.retry} />;
  }
  const rows = props.store.materials;
  const canWrite = props.role === 'owner' || props.role === 'site_manager';
  return (
    <div className="space-y-4" data-testid="materials-view">
      <ConstructionPageHead title="Materials" badge={props.badge} detail="Orders and deliveries recorded against the project. No file upload." actions={canWrite ? <ConstructionButton data-testid="material-add" onClick={() => setOpen(true)}>Add material</ConstructionButton> : null} />
      {rows.length === 0 ? (
        <ConstructionEmpty testId="materials-empty" icon={<Package />} title="No materials yet" hint="Record an order when the site is waiting on a delivery." />
      ) : (
        <ConstructionTable
          testId="materials-table"
          rows={rows}
          rowKey={(row: ConstructionMaterial) => row.id}
          columns={[
            { key: 'item', header: 'Item', render: (row) => row.item },
            { key: 'ordered', header: 'Ordered', render: (row) => `${row.ordered_qty} ${row.uom}` },
            { key: 'delivered', header: 'Delivered', render: (row) => `${row.delivered_qty ?? 0} ${row.uom}` },
            { key: 'po', header: 'Order', render: (row) => row.po_number || '—' },
          ]}
        />
      )}
      <ConstructionDrawer open={open} title="Material" onClose={() => setOpen(false)}>
        <label className="block text-xs font-bold text-slate-700">Item<input data-testid="material-item" className={constructionField} value={item} onChange={(event) => setItem(event.target.value)} /></label>
        <ConstructionButton className="mt-4" data-testid="material-save" onClick={() => {
          if (!item.trim()) return;
          const row: ConstructionMaterial = { id: newConstructionId('mat'), site_id: props.store.sites[0]?.id, item: item.trim(), uom: 'no', ordered_qty: 1, delivered_qty: 0 };
          void props.handlers.merge({ materials: [row] });
          setOpen(false);
        }}>Save material</ConstructionButton>
      </ConstructionDrawer>
    </div>
  );
}

export function HandoverView(props: DeskProps) {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState('');
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="handover" onRetry={props.handlers.retry} />;
  }
  const rows = props.store.snags;
  const columns = ['open', 'in_progress', 'closed'] as const;
  const canWrite = props.role === 'owner' || props.role === 'site_manager';
  return (
    <div className="space-y-4" data-testid="handover-view">
      <ConstructionPageHead title="Handover" badge={props.badge} detail="Snags by status. Closing a snag records the day. Photos are not stored." actions={canWrite ? <ConstructionButton data-testid="snag-add" onClick={() => setOpen(true)}>Add snag</ConstructionButton> : null} />
      {rows.length === 0 ? (
        <ConstructionEmpty testId="handover-empty" icon={<ClipboardCheck />} title="No snags yet" hint="Add a snag when practical completion is close." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-3" data-testid="snag-board">
          {columns.map((status) => (
            <section key={status} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
              <h3 className="text-sm font-black text-slate-900"><ConstructionStatusPill status={status} /></h3>
              <ul className="mt-2 space-y-2">
                {rows.filter((row) => (row.status || 'open') === status).map((row) => (
                  <li key={row.id} data-row-id={row.id} className="rounded-2xl border border-slate-200 p-3">
                    <p className="font-bold text-slate-900">{row.item}</p>
                    <p className="text-xs text-slate-600">{row.location || 'No location'}</p>
                    {canWrite && status !== 'closed' ? (
                      <ConstructionButton className="mt-2" data-testid={`snag-close-${row.id}`} onClick={() => void props.handlers.merge({ snags: [{ ...row, status: 'closed', closed_on: sastToday() }] })}>Close</ConstructionButton>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <ConstructionDrawer open={open} title="New snag" onClose={() => setOpen(false)}>
        <label className="block text-xs font-bold text-slate-700">Item<input data-testid="snag-item" className={constructionField} value={item} onChange={(event) => setItem(event.target.value)} /></label>
        <ConstructionButton className="mt-4" data-testid="snag-save" onClick={() => {
          if (!item.trim()) return;
          const row: ConstructionSnag = { id: newConstructionId('snag'), site_id: props.store.sites[0]?.id, item: item.trim(), status: 'open', priority: 'normal' };
          void props.handlers.merge({ snags: [row] });
          setOpen(false);
        }}>Save snag</ConstructionButton>
      </ConstructionDrawer>
    </div>
  );
}

export function ReportsView(props: DeskProps) {
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="reports" onRetry={props.handlers.retry} />;
  }
  const money = props.caps.canSeeMoney && props.role !== 'site_manager' && Array.isArray(props.store.payments);
  const rows = props.store.sites.map((site) => projectReport(props.store, site.id)).filter((row) => row != null);
  return (
    <div className="space-y-4" data-testid="reports-view">
      <ConstructionPageHead title="Reports" badge={props.badge} detail="Per project, from the book. No invented benchmark." />
      {rows.length === 0 ? (
        <ConstructionEmpty testId="reports-empty" icon={<ScrollText />} title="No projects yet" hint="Reports appear when a project is on the book." />
      ) : (
        <div className="grid gap-3" data-testid="reports-list">
          {rows.map((row) => (
            <article key={row.siteId} data-row-id={row.siteId} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-black text-slate-900">{row.code} · {row.name}</h3>
                <ConstructionStatusPill status={row.status} />
              </div>
              <p className="text-sm text-slate-600">{row.clientName}</p>
              <div className="mt-3">
                <ConstructionProgress planned={row.plannedPct} actual={row.actualPct} />
              </div>
              <p className="mt-2 text-sm text-slate-700">Open snags {row.openSnags}</p>
              {money ? (
                <p className="mt-1 text-sm text-slate-700">Certified <ConstructionMoney value={row.certified} /> · costs <ConstructionMoney value={row.costs} />, as entered.</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function portalChip(row: { revoked_at?: string | null; expires_at?: string | null; legacy?: boolean; token_hint?: string }, today: string) {
  if (row.revoked_at) return 'Revoked';
  if (row.expires_at && String(row.expires_at).slice(0, 10) < today) return 'Expired';
  if (row.legacy || !row.token_hint) return 'Old format';
  return 'Active';
}

export function PortalDeskView(props: DeskProps) {
  const [expiry, setExpiry] = useState<'none' | '90' | '365'>('none');
  const [reveal, setReveal] = useState<{ token: string; path: string; hint: string } | null>(null);
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="portal" onRetry={props.handlers.retry} />;
  }
  if (!props.caps.canManagePortals) {
    return (
      <div className="space-y-4" data-testid="portal-view">
        <ConstructionPageHead title="Portal" badge={props.badge} detail="Links are issued by the owner." />
        <ConstructionUnavailable testId="portal-unavailable" />
      </div>
    );
  }
  const today = sastToday();
  const base = props.hrefBase || '';
  const cards = [
    { kind: 'public' as const, title: 'Open programme', action: 'ensure_portal' },
    { kind: 'client' as const, title: 'Client', action: 'ensure_client_portal', id: props.store.clients[0]?.id, keyName: 'clientId' },
    { kind: 'contractor' as const, title: 'Site team', action: 'ensure_contractor_portal', id: props.store.sites[0]?.id, keyName: 'siteId' },
    { kind: 'subcontractor' as const, title: 'Subcontractor', action: 'ensure_subcontractor_portal', id: props.store.subcontractors[0]?.id, keyName: 'subcontractorId' },
  ];
  return (
    <div className="space-y-4" data-testid="portal-view">
      <ConstructionPageHead title="Portal" badge={props.badge} detail="Issue a link, copy it once, and open the same screen the other party sees." />
      <label className="block text-xs font-bold text-slate-700">
        Expiry
        <select data-testid="portal-expiry" className={constructionField} value={expiry} onChange={(event) => setExpiry(event.target.value as 'none' | '90' | '365')}>
          <option value="none">No expiry</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
        </select>
      </label>
      <div className="grid gap-3 lg:grid-cols-2">
        {cards.map((card) => {
          const rows = props.store.portals.filter((row) => row.kind === card.kind);
          return (
            <article key={card.kind} data-testid={`portal-card-${card.kind}`} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-black text-slate-900">{card.title}</h3>
              <ul className="mt-2 space-y-2">
                {rows.length === 0 ? <li className="text-sm text-slate-600">No link yet.</li> : null}
                {rows.map((row) => (
                  <li key={row.id || row.token_hint || card.kind} className="flex flex-wrap items-center gap-2 text-sm">
                    <ConstructionStatusPill status={portalChip(row, today) === 'Old format' ? 'legacy' : portalChip(row, today).toLowerCase()} />
                    <span className="tabular-nums text-slate-600">····{row.token_hint || (row.token ? row.token.slice(-4) : '')}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <ConstructionButton
                  data-testid={`portal-issue-${card.kind}`}
                  onClick={() => {
                    const body: Record<string, unknown> = { action: card.action, expiresIn: expiry === 'none' ? null : Number(expiry) };
                    if (card.keyName && card.id) body[card.keyName] = card.id;
                    void props.handlers.run(body).then((result) => {
                      const issued = result && typeof result === 'object' && 'issued' in result ? (result.issued as { token?: string; path?: string; hint?: string }) : null;
                      if (issued?.token && issued.path) setReveal({ token: issued.token, path: issued.path, hint: issued.hint || issued.token.slice(-4) });
                    });
                  }}
                >
                  {rows.length ? 'Reissue' : 'Issue'}
                </ConstructionButton>
                {rows[0]?.id ? (
                  <button type="button" data-testid={`portal-revoke-${card.kind}`} className="inline-flex min-h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800" onClick={() => void props.handlers.run({ action: 'revoke_portal', id: rows[0]?.id })}>Revoke</button>
                ) : null}
                <a className="inline-flex min-h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800" data-testid={`portal-preview-${card.kind}`} href={base ? `${base}/portal?kind=${card.kind}` : `/construction/${rows[0]?.token || ''}`}>Preview</a>
              </div>
            </article>
          );
        })}
      </div>
      {reveal ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="portal-reveal">
          <p className="text-sm font-black text-slate-900">Copy this link now. It is shown once.</p>
          <p className="mt-1 break-all font-mono text-sm text-slate-800" data-testid="portal-token">{reveal.path}</p>
          <p className="text-xs text-slate-500">Hint ····{reveal.hint}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ConstructionButton data-testid="portal-copy" onClick={() => void navigator.clipboard?.writeText(reveal.path)}>Copy</ConstructionButton>
            <QrMark value={reveal.path} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
