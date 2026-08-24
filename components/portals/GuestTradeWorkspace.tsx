'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CUSTOMER_DIMS,
  SUPPLIER_DIMS,
} from '@/lib/ratings/company-rating';
import { StarRating } from '@/components/ratings/StarRating';
import { formatMoney } from '@/lib/customers/types';
import { otifefBand } from '@/lib/suppliers/types';
import type { PublicPortalPayload } from '@/lib/portals/trade-portal';
import type { BookProfile } from '@/lib/portals/trade-portal-workspace';
import { addDays, isoDay } from '@/lib/projects/waterfall';
import { WaterfallGantt } from '@/components/projects/WaterfallGantt';

type Tab =
  | 'profile'
  | 'orders'
  | 'otifef'
  | 'statement'
  | 'stock'
  | 'riad'
  | 'messages'
  | 'reviews'
  | 'newpo'
  | 'projects';

const EMPTY_PROFILE: BookProfile = {
  trading_name: '',
  legal_name: '',
  contact_name: '',
  job_title: '',
  email: '',
  phone: '',
  website: '',
  vat_number: '',
  registration_number: '',
  address: '',
  city: '',
  country: '',
  payment_terms: '',
  industry: '',
};

function pct(n: number | null | undefined) {
  if (n == null) return '—';
  return `${Math.round(n)}%`;
}

export function GuestTradeWorkspace({
  token,
  portal,
  onRefresh,
}: {
  token: string;
  portal: PublicPortalPayload;
  onRefresh: () => void;
}) {
  const ws = portal.workspace;
  const isSupplier = portal.kind === 'supplier';
  const gaps = ws?.profileGaps || [];
  const tabs: Array<{ id: Tab; label: string }> = isSupplier
    ? [
        { id: 'profile', label: gaps.length ? `Profile (${gaps.length})` : 'Profile' },
        { id: 'orders', label: 'Purchase orders' },
        { id: 'otifef', label: 'OTIFEF metrics' },
        { id: 'projects', label: 'Projects' },
        { id: 'stock', label: 'Stock' },
        { id: 'riad', label: 'RIAD' },
        { id: 'messages', label: 'Messages' },
        { id: 'reviews', label: 'Ratings' },
      ]
    : [
        { id: 'profile', label: gaps.length ? `Profile (${gaps.length})` : 'Profile' },
        { id: 'orders', label: 'Sales orders' },
        { id: 'otifef', label: 'OTIFEF metrics' },
        { id: 'statement', label: 'Statement' },
        { id: 'projects', label: 'Projects' },
        { id: 'newpo', label: 'Raise a PO' },
        { id: 'riad', label: 'RIAD' },
        { id: 'messages', label: 'Messages' },
        { id: 'reviews', label: 'Ratings' },
      ];
  const [tab, setTab] = useState<Tab>(gaps.length ? 'profile' : 'orders');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const act = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/public/portals/trade/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setNote('Saved');
      onRefresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const ot = ws?.otifef;
  const band = otifefBand(ot?.overall || 0);
  const orders = isSupplier
    ? ws?.purchase_orders || portal.purchase_orders
    : [...(ws?.inbound_pos || []), ...(portal.orders || [])];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border ${
              tab === t.id
                ? 'bg-[#00b4d8] border-[#00b4d8] text-white'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {note ? (
        <p className="text-xs font-semibold text-[#0077b6]">{note}</p>
      ) : null}

      {gaps.length > 0 && tab !== 'profile' ? (
        <button
          type="button"
          onClick={() => setTab('profile')}
          className="w-full text-left rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          Complete your profile so {portal.host.name} has the right details on
          their books ({gaps.join(', ')}).
        </button>
      ) : null}

      {tab === 'profile' ? (
        <ProfilePanel
          profile={ws?.bookProfile || null}
          gaps={gaps}
          busy={busy}
          onAct={act}
        />
      ) : null}

      {tab === 'orders' ? (
        <OrdersPanel
          isSupplier={isSupplier}
          orders={orders}
          busy={busy}
          onAct={act}
        />
      ) : null}
      {tab === 'otifef' ? (
        <OtifefPanel
          ot={ot || null}
          isSupplier={isSupplier}
          band={band}
          orders={orders}
        />
      ) : null}
      {tab === 'statement' && !isSupplier ? (
        <StatementPanel
          invoices={portal.invoices || []}
          quotes={portal.quotes || []}
          hostName={portal.host.name}
        />
      ) : null}
      {tab === 'projects' ? (
        <ProjectsPanel items={ws?.projects || []} busy={busy} onAct={act} />
      ) : null}
      {tab === 'stock' && isSupplier ? (
        <StockPanel lines={ws?.stock || []} busy={busy} onAct={act} />
      ) : null}
      {tab === 'newpo' && !isSupplier ? (
        <NewPoPanel
          busy={busy}
          onAct={act}
          catalogue={ws?.catalogue || []}
          hostName={portal.host.name}
        />
      ) : null}
      {tab === 'riad' ? (
        <RiadPanel items={ws?.riad || []} busy={busy} onAct={act} />
      ) : null}
      {tab === 'messages' ? (
        <MessagesPanel items={ws?.messages || []} busy={busy} onAct={act} />
      ) : null}
      {tab === 'reviews' ? (
        <ReviewsPanel
          kind={portal.kind}
          items={ws?.ratings || []}
          busy={busy}
          onAct={act}
        />
      ) : null}
    </div>
  );
}

function ProfilePanel({
  profile,
  gaps,
  busy,
  onAct,
}: {
  profile: BookProfile | null;
  gaps: string[];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState<BookProfile>(profile || EMPTY_PROFILE);
  useEffect(() => {
    setForm(profile || EMPTY_PROFILE);
  }, [profile]);

  const set = (key: keyof BookProfile, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const fields: Array<{ key: keyof BookProfile; label: string; required?: boolean; span?: boolean }> =
    [
      { key: 'trading_name', label: 'Trading name', required: true },
      { key: 'legal_name', label: 'Legal name' },
      { key: 'contact_name', label: 'Contact name', required: true },
      { key: 'job_title', label: 'Job title' },
      { key: 'email', label: 'Email', required: true },
      { key: 'phone', label: 'Phone', required: true },
      { key: 'website', label: 'Website', span: true },
      { key: 'vat_number', label: 'VAT number' },
      { key: 'registration_number', label: 'Registration number' },
      { key: 'address', label: 'Street address', span: true },
      { key: 'city', label: 'City', required: true },
      { key: 'country', label: 'Country', required: true },
      { key: 'payment_terms', label: 'Payment terms' },
      { key: 'industry', label: 'Industry' },
    ];

  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-4 shadow-sm">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          On our books
        </p>
        <h2 className="text-lg font-black text-slate-900">Complete your profile</h2>
        <p className="text-sm text-neutral-600 mt-1">
          These fields write straight into our customer / supplier record. Keep
          them accurate so quotes, POs, and invoices match your legal entity.
        </p>
      </div>
      {gaps.length ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
          Still needed: {gaps.join(', ')}
        </p>
      ) : (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
          Profile is complete on our books.
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <label
            key={f.key}
            className={`text-[10px] font-bold uppercase tracking-wider text-neutral-400 ${
              f.span ? 'sm:col-span-2' : ''
            }`}
          >
            {f.label}
            {f.required ? <span className="text-rose-500"> *</span> : null}
            {f.key === 'address' ? (
              <textarea
                className="input mt-0.5 w-full !p-2.5 !text-sm min-h-[64px] font-medium normal-case tracking-normal"
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
              />
            ) : (
              <input
                className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                type={f.key === 'email' ? 'email' : 'text'}
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onAct({ action: 'profile', ...form })}
        className="btn-primary w-full !py-2.5 text-sm"
      >
        Save to our books
      </button>
    </div>
  );
}

function ProjectsPanel({
  items,
  busy,
  onAct,
}: {
  items: NonNullable<PublicPortalPayload['workspace']>['projects'];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<number | null>(items[0]?.id || null);
  const selected = items.find((p) => p.id === projectId) || items[0] || null;
  const from =
    items
      .map((p) => p.start_date)
      .filter(Boolean)
      .sort()[0] || isoDay(new Date());
  const to =
    items
      .map((p) => p.target_date)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || addDays(from, 56);
  const groups = items.map((p) => ({
    id: String(p.id),
    title: p.name,
    subtitle: p.status,
    bars: (p.tasks.length
      ? p.tasks
      : [
          {
            id: 0,
            title: p.name,
            column_key: p.status,
            start_date: p.start_date,
            due_date: p.target_date,
            phase_key: null,
          },
        ]
    ).map((t) => ({
      id: String(t.id || `p-${p.id}`),
      label: t.title,
      start: String(t.start_date || p.start_date || from).slice(0, 10),
      end: String(t.due_date || p.target_date || to).slice(0, 10),
      tone:
        t.column_key === 'done'
          ? ('emerald' as const)
          : t.column_key === 'in_progress'
            ? ('cyan' as const)
            : ('violet' as const),
    })),
  }));

  if (!items.length) {
    return (
      <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-6 space-y-2 shadow-sm">
        <p className="text-sm font-bold text-slate-900">No joint projects yet</p>
        <p className="text-sm text-neutral-600 leading-relaxed">
          When we open a shared waterfall project on your account, it appears
          here. You can move tasks, add work, and track the same plan we run
          internally — no login required.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3 text-sm text-slate-700">
        <p className="font-bold text-slate-900">Work this plan together</p>
        <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
          Same project we hold on our books. Update task status, add shared
          tasks, and keep dates aligned — changes sync both ways.
        </p>
      </div>
      <WaterfallGantt
        groups={groups}
        from={from}
        to={to}
        onSelect={(gid) => setProjectId(Number(gid))}
      />
      {selected ? (
        <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 space-y-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
              {selected.status}
            </p>
            <h3 className="font-black text-slate-900">{selected.name}</h3>
            {selected.description ? (
              <p className="text-sm text-neutral-600 mt-1">{selected.description}</p>
            ) : null}
          </div>
          {selected.tasks.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">{t.title}</p>
                <p className="text-[11px] text-neutral-500">
                  {[t.start_date, t.due_date ? `→ ${t.due_date}` : null]
                    .filter(Boolean)
                    .join(' ')}
                </p>
              </div>
              <div className="flex gap-1">
                {['todo', 'in_progress', 'done'].map((col) => (
                  <button
                    key={col}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void onAct({ action: 'task_update', id: t.id, column_key: col })
                    }
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                      t.column_key === col
                        ? 'bg-[#00b4d8] border-[#00b4d8] text-white'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {col.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              className="input flex-1 !py-2 !px-2.5 !text-sm"
              placeholder="Add a task we share"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !title.trim()}
              onClick={() => {
                const t = title;
                setTitle('');
                void onAct({
                  action: 'task_add',
                  project_id: selected.id,
                  title: t,
                });
              }}
              className="btn-primary !py-2 !px-3 text-xs"
            >
              Add
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OrdersPanel({
  isSupplier,
  orders,
  busy,
  onAct,
}: {
  isSupplier: boolean;
  orders: PublicPortalPayload['purchase_orders'];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<void>;
}) {
  if (!orders.length) {
    return (
      <p className="rounded-[1.5rem] border border-white/70 bg-white/90 p-6 text-sm text-neutral-500">
        No orders on this account yet.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li
          key={`${o.kind}-${o.id}`}
          className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-black text-slate-900">{o.number}</p>
              <p className="text-[11px] text-neutral-500">
                {[o.date, o.due ? `expected ${o.due}` : null, o.status]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {o.amount != null ? (
              <p className="font-black tabular-nums text-slate-900">
                {formatMoney(o.amount, o.currency)}
              </p>
            ) : null}
          </div>
          {o.otifef ? (
            <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px]">
              {[
                ['OTIFEF', o.otifef.pending ? '—' : pct(o.otifef.overall)],
                ['On time', o.otifef.pending ? '—' : pct(o.otifef.onTime)],
                ['In full', o.otifef.pending ? '—' : pct(o.otifef.inFull)],
                ['Error-free', o.otifef.pending ? '—' : pct(o.otifef.errorFree)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 py-1.5">
                  <div className="font-bold uppercase tracking-wider text-neutral-400">
                    {k}
                  </div>
                  <div className="font-black text-slate-800">{v}</div>
                </div>
              ))}
            </div>
          ) : null}
          {isSupplier ? (
            <SupplierOrderActions order={o} busy={busy} onAct={onAct} />
          ) : (
            <CustomerOrderActions order={o} busy={busy} onAct={onAct} />
          )}
        </li>
      ))}
    </ul>
  );
}

function SupplierOrderActions({
  order,
  busy,
  onAct,
}: {
  order: PublicPortalPayload['purchase_orders'][number];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [delivered, setDelivered] = useState(String(order.delivered ?? ''));
  const [stock, setStock] = useState('');
  const st = order.status.toLowerCase();
  return (
    <div className="mt-3 flex flex-wrap gap-2 items-end">
      {st === 'sent' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onAct({ action: 'po_update', id: order.id, status: 'accepted' })}
          className="btn-primary !py-1.5 !px-3 text-xs"
        >
          Accept order
        </button>
      ) : null}
      {st === 'accepted' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onAct({ action: 'po_update', id: order.id, status: 'invoiced' })}
          className="btn-secondary !py-1.5 !px-3 text-xs"
        >
          Mark shipped / invoiced
        </button>
      ) : null}
      <label className="text-[10px] font-bold uppercase text-neutral-400">
        Delivered qty
        <input
          className="input mt-0.5 !py-1 !px-2 !text-xs w-24"
          value={delivered}
          onChange={(e) => setDelivered(e.target.value)}
        />
      </label>
      <label className="text-[10px] font-bold uppercase text-neutral-400">
        Stock on hand
        <input
          className="input mt-0.5 !py-1 !px-2 !text-xs w-24"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void onAct({
            action: 'po_update',
            id: order.id,
            delivered_quantity: delivered ? Number(delivered) : undefined,
            stock_on_hand: stock ? Number(stock) : undefined,
          })
        }
        className="btn-secondary !py-1.5 !px-3 text-xs"
      >
        Update qty
      </button>
    </div>
  );
}

function CustomerOrderActions({
  order,
  busy,
  onAct,
}: {
  order: PublicPortalPayload['purchase_orders'][number];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [url, setUrl] = useState(order.attachment_url || '');
  const [date, setDate] = useState(order.due || '');
  const [qty, setQty] = useState(String(order.ordered ?? ''));
  if (order.kind !== 'purchase_order') {
    return (
      <p className="mt-2 text-[11px] text-neutral-500">
        Status is updated by {order.status ? `us · ${order.status}` : 'us'}.
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2 items-end">
      <label className="text-[10px] font-bold uppercase text-neutral-400">
        Expected date
        <input
          type="date"
          className="input mt-0.5 !py-1 !px-2 !text-xs"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label className="text-[10px] font-bold uppercase text-neutral-400">
        Volume
        <input
          className="input mt-0.5 !py-1 !px-2 !text-xs w-24"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </label>
      <label className="text-[10px] font-bold uppercase text-neutral-400 grow min-w-[10rem]">
        Attach PO URL
        <input
          className="input mt-0.5 !py-1 !px-2 !text-xs w-full"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void onAct({
            action: 'po_update',
            id: order.id,
            promised_date: date || undefined,
            order_quantity: qty ? Number(qty) : undefined,
            attachment_url: url || undefined,
          })
        }
        className="btn-secondary !py-1.5 !px-3 text-xs"
      >
        Save
      </button>
    </div>
  );
}

function StockPanel({
  lines,
  busy,
  onAct,
}: {
  lines: NonNullable<PublicPortalPayload['workspace']>['stock'];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<void>;
}) {
  if (!lines.length) {
    return (
      <p className="rounded-[1.5rem] border border-white/70 bg-white/90 p-6 text-sm text-neutral-500">
        Stock lines appear from open purchase orders. Accept an order, then confirm
        what you have on hand.
      </p>
    );
  }
  return (
    <ul className="rounded-[1.5rem] border border-white/70 bg-white/90 divide-y divide-slate-100 overflow-hidden">
      {lines.map((l, i) => (
        <li key={`${l.po_id}-${l.sku}-${i}`} className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900">{l.name}</p>
              <p className="text-[11px] text-neutral-500">
                {[l.sku, l.po_id ? `PO #${l.po_id}` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
            {l.po_id ? (
              <StockQuick poId={l.po_id} current={l.qty_on_hand} busy={busy} onAct={onAct} />
            ) : (
              <span className="text-sm font-black tabular-nums">
                {l.qty_on_hand ?? '—'}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StockQuick({
  poId,
  current,
  busy,
  onAct,
}: {
  poId: number;
  current: number | null;
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [v, setV] = useState(current != null ? String(current) : '');
  return (
    <div className="flex items-center gap-1.5">
      <input
        className="input !py-1 !px-2 !text-xs w-20"
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void onAct({
            action: 'po_update',
            id: poId,
            stock_on_hand: Number(v),
          })
        }
        className="btn-secondary !py-1 !px-2 text-xs"
      >
        Set
      </button>
    </div>
  );
}

function NewPoPanel({
  busy,
  onAct,
  catalogue,
  hostName,
}: {
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<void>;
  catalogue: Array<{
    id: number;
    name: string;
    sku: string | null;
    product_type: string | null;
    uom: string | null;
    unit_price: number;
    currency: string;
    short_description: string | null;
  }>;
  hostName: string;
}) {
  type Line = {
    key: string;
    product_id: number | null;
    name: string;
    sku: string | null;
    qty: number;
    unit_price: number;
    uom: string | null;
  };
  const [lines, setLines] = useState<Line[]>([]);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');
  const [freeName, setFreeName] = useState('');
  const [freeQty, setFreeQty] = useState('1');
  const [freePrice, setFreePrice] = useState('');
  const [chipQty, setChipQty] = useState(1);

  const total = useMemo(
    () => lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_price || 0), 0),
    [lines]
  );

  const addFromCatalogue = (c: (typeof catalogue)[number]) => {
    const qty = Math.max(1, Number(chipQty) || 1);
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.product_id === c.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Number(next[idx].qty || 0) + qty };
        return next;
      }
      return [
        ...prev,
        {
          key: `p-${c.id}-${Date.now()}`,
          product_id: c.id,
          name: c.name,
          sku: c.sku,
          qty,
          unit_price: Number(c.unit_price) || 0,
          uom: c.uom || 'ea',
        },
      ];
    });
  };

  const addFreeLine = () => {
    const name = freeName.trim();
    if (!name) return;
    const qty = Math.max(1, Number(freeQty) || 1);
    setLines((prev) => [
      ...prev,
      {
        key: `f-${Date.now()}`,
        product_id: null,
        name,
        sku: null,
        qty,
        unit_price: Number(freePrice) || 0,
        uom: 'ea',
      },
    ]);
    setFreeName('');
    setFreeQty('1');
    setFreePrice('');
  };

  const updateLine = (key: string, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          Raise a PO
        </p>
        <h2 className="text-lg font-black text-slate-900">Order from {hostName}</h2>
        <p className="text-sm text-neutral-600 mt-1">
          Select products, set quantities and expected date, then send. Lines land on our books as
          a purchase order.
        </p>
      </div>

      {catalogue.length > 0 ? (
        <div className="rounded-2xl border border-cyan-100 bg-sky-50/60 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
              Catalogue · {catalogue.length} item{catalogue.length === 1 ? '' : 's'}
            </p>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
              Qty
              <input
                type="number"
                min={1}
                step={1}
                className="input !py-1 !px-2 !text-xs w-16 tabular-nums"
                value={chipQty}
                onChange={(e) => setChipQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
            {catalogue.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => addFromCatalogue(c)}
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:border-[#00b4d8] hover:bg-[#e0f7fc] text-left"
                title={c.short_description || c.name}
              >
                <span>{c.name}</span>
                {c.sku ? (
                  <span className="font-normal text-neutral-400">{c.sku}</span>
                ) : null}
                <span className="font-normal text-neutral-500 tabular-nums">
                  R{Number(c.unit_price || 0).toLocaleString()}
                  {c.uom ? `/${c.uom}` : ''}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-neutral-500">
            Tap a product to add it (qty above). Same product merges quantity.
          </p>
        </div>
      ) : (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          No sellable catalogue published yet — use free-text lines below, or ask us to publish
          finished goods.
        </p>
      )}

      {lines.length > 0 ? (
        <ul className="space-y-2">
          {lines.map((l) => (
            <li
              key={l.key}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 space-y-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">{l.name}</p>
                  <p className="text-[11px] text-neutral-500">
                    {[l.sku, l.product_id ? `ID ${l.product_id}` : 'Free-text', l.uom]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeLine(l.key)}
                  className="text-[11px] font-bold text-rose-600"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-bold uppercase text-neutral-400">
                  Qty
                  <input
                    type="number"
                    min={1}
                    className="input mt-0.5 w-full !py-1.5 !px-2 !text-sm"
                    value={l.qty}
                    onChange={(e) =>
                      updateLine(l.key, { qty: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </label>
                <label className="text-[10px] font-bold uppercase text-neutral-400">
                  Unit price (R)
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input mt-0.5 w-full !py-1.5 !px-2 !text-sm"
                    value={l.unit_price}
                    onChange={(e) =>
                      updateLine(l.key, { unit_price: Number(e.target.value) || 0 })
                    }
                  />
                </label>
              </div>
              <p className="text-xs font-semibold text-slate-700 tabular-nums text-right">
                Line: R{(Number(l.qty) * Number(l.unit_price)).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="rounded-2xl border border-dashed border-slate-200 p-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
          Free-text line (optional)
        </p>
        <input
          className="input w-full !p-2.5 !text-sm"
          placeholder="Item name"
          value={freeName}
          onChange={(e) => setFreeName(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input !p-2.5 !text-sm"
            placeholder="Qty"
            value={freeQty}
            onChange={(e) => setFreeQty(e.target.value)}
          />
          <input
            className="input !p-2.5 !text-sm"
            placeholder="Unit price (R)"
            value={freePrice}
            onChange={(e) => setFreePrice(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={busy || !freeName.trim()}
          onClick={addFreeLine}
          className="btn-secondary !py-1.5 !px-3 text-xs"
        >
          Add line
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <label className="text-[10px] font-bold uppercase text-neutral-400">
          Expected date
          <input
            type="date"
            className="input mt-0.5 w-full !p-2.5 !text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="text-[10px] font-bold uppercase text-neutral-400">
          Order total
          <div className="mt-0.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm font-black tabular-nums text-slate-900">
            R{total.toLocaleString()}
          </div>
        </label>
      </div>
      <textarea
        className="input w-full !p-3 !text-sm min-h-[64px]"
        placeholder="Notes / delivery instructions / batch details"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <input
        className="input w-full !p-3 !text-sm"
        placeholder="Attach PO URL (optional)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        type="button"
        disabled={busy || lines.length === 0}
        onClick={() =>
          void onAct({
            action: 'po_create',
            description: notes || undefined,
            promised_date: date || undefined,
            total_amount: total,
            attachment_url: url || undefined,
            items: lines.map((l) => ({
              name: l.name,
              sku: l.sku,
              qty: l.qty,
              quantity: l.qty,
              unit_price: l.unit_price,
              product_id: l.product_id,
              uom: l.uom,
            })),
          })
        }
        className="btn-primary w-full !py-2.5 text-sm"
      >
        Send purchase order
        {lines.length ? ` · ${lines.length} line${lines.length === 1 ? '' : 's'}` : ''}
      </button>
    </div>
  );
}


function RiadPanel({
  items,
  busy,
  onAct,
}: {
  items: NonNullable<PublicPortalPayload['workspace']>['riad'];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('issue');
  const [desc, setDesc] = useState('');
  const [comment, setComment] = useState<Record<number, string>>({});
  return (
    <div className="space-y-3">
      <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-neutral-400">
          Log a RIAD
        </p>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="input !p-2 !text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="risk">Risk</option>
            <option value="issue">Issue</option>
            <option value="action">Action</option>
            <option value="decision">Decision</option>
          </select>
          <input
            className="input !p-2 !text-sm"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <textarea
          className="input w-full !p-2 !text-sm min-h-[64px]"
          placeholder="Detail"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !title.trim()}
          onClick={() =>
            void onAct({
              action: 'riad_add',
              entry_type: type,
              title,
              description: desc,
            })
          }
          className="btn-primary !py-2 !px-3 text-xs"
        >
          Add to register
        </button>
      </div>
      {items.map((r) => (
        <div
          key={r.id}
          className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
            {r.entry_type} · {r.status}
          </p>
          <p className="font-bold text-slate-900">{r.title}</p>
          {r.description ? (
            <p className="text-sm text-neutral-600 mt-1">{r.description}</p>
          ) : null}
          {r.notes ? (
            <pre className="mt-2 text-[11px] text-neutral-500 whitespace-pre-wrap font-sans">
              {r.notes}
            </pre>
          ) : null}
          <div className="mt-2 flex gap-2">
            <input
              className="input flex-1 !py-1.5 !px-2 !text-xs"
              placeholder="Add a comment"
              value={comment[r.id] || ''}
              onChange={(e) =>
                setComment((m) => ({ ...m, [r.id]: e.target.value }))
              }
            />
            <button
              type="button"
              disabled={busy || !comment[r.id]}
              onClick={() =>
                void onAct({
                  action: 'riad_comment',
                  id: r.id,
                  notes: comment[r.id],
                })
              }
              className="btn-secondary !py-1.5 !px-2 text-xs"
            >
              Comment
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MessagesPanel({
  items,
  busy,
  onAct,
}: {
  items: NonNullable<PublicPortalPayload['workspace']>['messages'];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 space-y-3">
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500">No messages yet.</p>
        ) : (
          items.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl px-3 py-2 text-sm ${
                m.author === 'guest'
                  ? 'bg-cyan-50 text-slate-900 ml-8'
                  : 'bg-slate-50 text-slate-800 mr-8'
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                {m.author === 'guest' ? 'You' : 'Us'}
              </p>
              <p>{m.body}</p>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1 !p-2.5 !text-sm"
          placeholder="Message the team"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !body.trim()}
          onClick={() => {
            const t = body;
            setBody('');
            void onAct({ action: 'message', body: t });
          }}
          className="btn-primary !py-2 !px-3 text-sm"
        >
          Send
        </button>
      </div>
    </div>
  );
}


function OtifefPanel({
  ot,
  isSupplier,
  band,
  orders,
}: {
  ot: {
    overall?: number | null;
    onTime?: number | null;
    inFull?: number | null;
    errorFree?: number | null;
    totalPOs?: number;
  } | null;
  isSupplier: boolean;
  band: { label: string; className: string };
  orders: PublicPortalPayload['purchase_orders'];
}) {
  if (!ot || (!(ot.totalPOs && ot.totalPOs > 0) && !(ot.overall && ot.overall > 0))) {
    return (
      <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-6 text-sm text-neutral-500">
        OTIFEF metrics appear once there are deliveries on this account.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
              OTIFEF
            </p>
            <p className="text-3xl font-black tabular-nums text-slate-900">
              {pct(ot.overall)}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {isSupplier
                ? 'Your delivery performance on our purchase orders'
                : 'Our delivery performance on your orders'}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${band.className}`}>
            {band.label}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['On time', ot.onTime],
            ['In full', ot.inFull],
            ['Error-free', ot.errorFree],
          ].map(([label, v]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-2 py-2"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                {label}
              </div>
              <div className="text-lg font-black tabular-nums text-slate-900">
                {pct(v as number)}
              </div>
            </div>
          ))}
        </div>
        {ot.totalPOs != null ? (
          <p className="mt-3 text-[11px] text-neutral-500">
            Based on {ot.totalPOs} order{ot.totalPOs === 1 ? '' : 's'}
          </p>
        ) : null}
      </section>
      {orders.filter((o) => o.otifef).length > 0 ? (
        <ul className="space-y-2">
          {orders
            .filter((o) => o.otifef)
            .map((o) => (
              <li
                key={`${o.kind}-${o.id}`}
                className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{o.number}</p>
                  <p className="text-[11px] text-neutral-500">{o.status}</p>
                </div>
                <div className="flex gap-2 text-[10px] font-bold tabular-nums">
                  <span className="rounded-full bg-slate-50 px-2 py-0.5">
                    OTIFEF {o.otifef?.pending ? '—' : pct(o.otifef?.overall)}
                  </span>
                  <span className="rounded-full bg-slate-50 px-2 py-0.5">
                    OT {o.otifef?.pending ? '—' : pct(o.otifef?.onTime)}
                  </span>
                  <span className="rounded-full bg-slate-50 px-2 py-0.5">
                    IF {o.otifef?.pending ? '—' : pct(o.otifef?.inFull)}
                  </span>
                  <span className="rounded-full bg-slate-50 px-2 py-0.5">
                    EF {o.otifef?.pending ? '—' : pct(o.otifef?.errorFree)}
                  </span>
                </div>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}

function StatementPanel({
  invoices,
  quotes,
  hostName,
}: {
  invoices: PublicPortalPayload['invoices'];
  quotes: PublicPortalPayload['quotes'];
  hostName: string;
}) {
  const open = invoices.filter((i) => {
    const st = i.status.toLowerCase();
    return st !== 'paid' && st !== 'void' && st !== 'cancelled';
  });
  const due = open.reduce(
    (n, i) => n + Math.max(0, Number(i.amount || 0) - Number(i.paid || 0)),
    0
  );
  const currency = open[0]?.currency || invoices[0]?.currency || 'ZAR';

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          Statement · {hostName}
        </p>
        <p className="mt-1 text-3xl font-black tabular-nums text-slate-900">
          {formatMoney(due, currency)}
        </p>
        <p className="text-xs text-neutral-500 mt-0.5">
          Open balance · {open.length} invoice{open.length === 1 ? '' : 's'} outstanding
        </p>
      </section>

      <section className="rounded-[1.5rem] border border-white/70 bg-white/90 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-900">Invoices</h3>
        </div>
        {invoices.length === 0 ? (
          <p className="px-5 py-8 text-sm text-neutral-500">No invoices on this account yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {invoices.map((r) => {
              const remaining = Math.max(
                0,
                Number(r.amount || 0) - Number(r.paid || 0)
              );
              return (
                <li
                  key={`inv-${r.id}`}
                  className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm">{r.number}</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {[r.date, r.due ? `due ${r.due}` : null, r.status]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black tabular-nums text-slate-900">
                      {formatMoney(r.amount, r.currency)}
                    </p>
                    {remaining > 0 && remaining !== Number(r.amount || 0) ? (
                      <p className="text-[11px] text-amber-700 font-semibold">
                        Open {formatMoney(remaining, r.currency)}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {quotes.length > 0 ? (
        <section className="rounded-[1.5rem] border border-white/70 bg-white/90 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900">Quotes</h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {quotes.map((r) => (
              <li
                key={`q-${r.id}`}
                className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <p className="font-bold text-slate-900 text-sm">{r.number}</p>
                  <p className="text-[11px] text-neutral-500">
                    {[r.date, r.status].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {r.amount != null ? (
                  <p className="text-sm font-black tabular-nums">
                    {formatMoney(r.amount, r.currency)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ReviewsPanel({
  kind,
  items,
  busy,
  onAct,
}: {
  kind: PublicPortalPayload['kind'];
  items: NonNullable<PublicPortalPayload['workspace']>['ratings'];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<void>;
}) {
  const dims = kind === 'supplier' ? CUSTOMER_DIMS : SUPPLIER_DIMS;
  const [overall, setOverall] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const payload = useMemo(() => {
    const p: Record<string, unknown> = { action: 'rate', overall, comment };
    for (const d of dims) p[d.key] = scores[d.key] || null;
    return p;
  }, [overall, scores, comment, dims]);

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-3">
        <p className="text-sm font-bold text-slate-900">Rate us</p>
        <p className="text-xs text-neutral-500">
          Same 1–5 stars and dimensions as the rest of SupplierAdvisor.
        </p>
        <StarRating value={overall} onChange={setOverall} size="md" label="Overall" />
        {dims.map((d) => (
          <div key={d.key} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-800">{d.label}</p>
              <p className="text-[11px] text-neutral-500">{d.hint}</p>
            </div>
            <StarRating
              value={scores[d.key] || 0}
              onChange={(n) => setScores((s) => ({ ...s, [d.key]: n }))}
              size="sm"
              label={d.label}
            />
          </div>
        ))}
        <textarea
          className="input w-full !p-2 !text-sm min-h-[64px]"
          placeholder="Comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || overall < 1}
          onClick={() => void onAct(payload)}
          className="btn-primary !py-2 !px-4 text-sm"
        >
          Publish review
        </button>
      </div>
      {items.map((r) => (
        <div
          key={`${r.direction}-${r.id}`}
          className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-700">{r.author}</p>
            <StarRating value={r.overall} readOnly size="sm" />
          </div>
          {r.comment ? (
            <p className="text-sm text-neutral-600 mt-2">{r.comment}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
