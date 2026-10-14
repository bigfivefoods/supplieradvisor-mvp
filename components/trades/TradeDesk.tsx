'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ClipboardList,
  Loader2,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  HubModuleGrid,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import {
  TradegraphPage,
  TradegraphRequired,
} from '@/components/trades/TradegraphShell';
import { readPhotoFile } from '@/components/trades/photo';
import {
  acceptQuote,
  addJobUpdate,
  complianceLabel,
  complianceReminders,
  customerAppPath,
  formatZar,
  invoiceJob,
  joinPath,
  materialOrderCents,
  quoteTotals,
  recordPayment,
  requestToQuote,
  seedDemoTradegraph,
  summariseTradegraph,
  type TradegraphStore,
} from '@/lib/trades/tradegraph';

export type TradeView =
  | 'command'
  | 'customers'
  | 'jobs'
  | 'materials'
  | 'schedule'
  | 'compliance';

const MODULES: HubModule[] = [
  {
    href: '/dashboard/tradegraph/customers',
    icon: Users,
    code: '01',
    title: 'Customers',
    desc: 'The people you quote, invoice and invite into the job app.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/tradegraph/jobs',
    icon: ClipboardList,
    code: '02',
    title: 'Quotes, jobs, invoices',
    desc: 'A request becomes a quote, a job, then a rand invoice.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/tradegraph/materials',
    icon: Truck,
    code: '03',
    title: 'Materials',
    desc: 'Order from suppliers already on SupplierAdvisor®.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/tradegraph/schedule',
    icon: CalendarDays,
    code: '04',
    title: 'Schedule',
    desc: 'Who is on site, and when.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/tradegraph/compliance',
    icon: ShieldCheck,
    code: '05',
    title: 'Compliance',
    desc: 'Electrical CoC, PIRB and other certificates before they expire.',
    accent: 'from-rose-50 to-white border-rose-100',
  },
];

export function TradeDesk({
  view,
  preview = false,
}: {
  view: TradeView;
  preview?: boolean;
}) {
  const [store, setStore] = useState<TradegraphStore | null>(
    preview ? seedDemoTradegraph('2026-10-14T08:00:00.000Z') : null
  );
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(!preview);

  const refresh = useCallback(async () => {
    if (preview) return;
    const companyId = getSelectedCompanyId();
    if (!companyId) {
      setError('Choose a company first.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/trades/tradegraph?companyId=${companyId}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as { store?: TradegraphStore; error?: string };
      if (!res.ok || !data.store) {
        setError(data.error || 'Could not open TradeAdvisor®');
        return;
      }
      setStore(data.store);
      setError('');
    } catch {
      setError('Could not open TradeAdvisor®');
    } finally {
      setLoading(false);
    }
  }, [preview]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function post(action: string, extra: Record<string, unknown> = {}) {
    if (preview) {
      setNotice('Sample book — open the dashboard after sign-in to save.');
      return;
    }
    const companyId = getSelectedCompanyId();
    if (!companyId || !store) return;
    const res = await fetch('/api/trades/tradegraph', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, action, ...extra }),
    });
    const data = (await res.json()) as {
      store?: TradegraphStore;
      error?: string;
      inviteUrl?: string;
      email?: string;
      otpHint?: string;
    };
    if (!res.ok || !data.store) {
      setError(data.error || 'Save failed');
      return;
    }
    setStore(data.store);
    setError('');
    if (data.inviteUrl) {
      setNotice(
        data.email === 'sent'
          ? `Invite emailed. Link: ${data.inviteUrl}`
          : `Email is not configured. Share this link (code ${data.otpHint || ''}): ${data.inviteUrl}`
      );
    }
  }

  const body = (
    <TradegraphPage>
      <RelationshipHeader
        eyebrow="TradeAdvisor®"
        title={titleFor(view)}
        description="Quotes, jobs and invoices in rand, on SupplierAdvisor®."
      />
      {error ? (
        <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 break-all">
          {notice}
        </p>
      ) : null}
      {loading || !store ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening the book…
        </p>
      ) : (
        <DeskBody
          view={view}
          store={store}
          preview={preview}
          onPost={post}
          onLocal={(next) => {
            setStore(next);
            setNotice('Updated in this sample. Nothing was saved.');
          }}
        />
      )}
    </TradegraphPage>
  );

  if (preview) return body;
  return <TradegraphRequired>{body}</TradegraphRequired>;
}

function AlertsEmail({
  store,
  preview,
  onPost,
}: {
  store: TradegraphStore;
  preview: boolean;
  onPost: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const [email, setEmail] = useState(store.settings.notify_email || '');
  return (
    <form
      className="mt-4 rounded-3xl border border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (preview) return;
        void onPost('save_settings', { settings: { notify_email: email.trim() } });
      }}
    >
      <h2 className="font-black">Alerts</h2>
      <p className="mt-1 text-sm text-slate-600">
        Customers are emailed and, if they allow it, pushed when a job status changes, when an invoice is issued, and when their statement changes. New job requests come to this address and to this company&apos;s push alerts.
      </p>
      <label className="mt-3 block text-sm font-semibold">
        Tradesperson email
        <input
          type="email"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@workshop.co.za"
        />
      </label>
      <button
        type="submit"
        className="mt-3 rounded-full bg-[#00b4d8] px-4 py-2 text-sm font-bold text-white"
      >
        Save alerts email
      </button>
    </form>
  );
}

function titleFor(view: TradeView): string {
  if (view === 'customers') return 'Customers';
  if (view === 'jobs') return 'Jobs';
  if (view === 'materials') return 'Materials';
  if (view === 'schedule') return 'Schedule';
  if (view === 'compliance') return 'Compliance';
  return 'Command';
}

function DeskBody({
  view,
  store,
  preview,
  onPost,
  onLocal,
}: {
  view: TradeView;
  store: TradegraphStore;
  preview: boolean;
  onPost: (action: string, extra?: Record<string, unknown>) => Promise<void>;
  onLocal: (store: TradegraphStore) => void;
}) {
  const today = '2026-10-14';
  const summary = summariseTradegraph(store, today);
  const alerts = complianceReminders(store.compliance, today);
  if (view === 'command') {
    return (
      <div>
        <HubTelemetryGrid>
          <TelemetryCard label="Customers" value={String(summary.customers)} />
          <TelemetryCard label="Open quotes" value={String(summary.open_quotes)} />
          <TelemetryCard label="Active jobs" value={String(summary.active_jobs)} />
          <TelemetryCard label="Balance" value={formatZar(summary.balance_cents)} />
        </HubTelemetryGrid>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={customerAppPath(preview ? 'demo' : store.settings.public_token)}
            className="rounded-full bg-[#00b4d8] px-4 py-2 text-sm font-bold text-white"
          >
            Customer app
          </Link>
          <Link
            href={joinPath(preview ? 'demo' : store.settings.public_token)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold"
          >
            Join link
          </Link>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold"
            onClick={() =>
              void (preview
                ? onLocal(seedDemoTradegraph(new Date().toISOString()))
                : onPost('seed_demo'))
            }
          >
            Load sample book
          </button>
        </div>
        <AlertsEmail store={store} preview={preview} onPost={onPost} />
        {alerts.length ? (
          <ul className="mt-4 space-y-2">
            {alerts.map((alert) => (
              <li key={alert.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                {complianceLabel(alert.kind)} {alert.number}{' '}
                {alert.level === 'overdue' ? `expired ${-alert.days} days ago` : `expires in ${alert.days} days`}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-6">
          <HubModuleGrid modules={MODULES} />
        </div>
      </div>
    );
  }
  if (view === 'customers') return <Customers store={store} onPost={onPost} />;
  if (view === 'jobs') return <Jobs store={store} preview={preview} onPost={onPost} onLocal={onLocal} />;
  if (view === 'materials') return <Materials store={store} onPost={onPost} />;
  if (view === 'schedule') return <Schedule store={store} onPost={onPost} />;
  return <Compliance store={store} alerts={alerts} onPost={onPost} />;
}

function Customers({
  store,
  onPost,
}: {
  store: TradegraphStore;
  onPost: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    suburb: '',
    city: 'Cape Town',
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="rounded-3xl border border-slate-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onPost('save_customer', { customer: form });
        }}
      >
        <h2 className="font-black">Add a customer</h2>
        {(['name', 'email', 'phone', 'address', 'suburb', 'city'] as const).map((key) => (
          <label key={key} className="mt-3 block text-sm font-semibold capitalize">
            {key}
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal"
              value={form[key]}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
            />
          </label>
        ))}
        <button type="submit" className="mt-4 rounded-full bg-[#00b4d8] px-4 py-2 text-sm font-bold text-white">
          Save customer
        </button>
      </form>
      <ul className="space-y-3">
        {store.customers.map((customer) => (
          <li key={customer.id} className="rounded-3xl border border-slate-200 bg-white p-4">
            <h3 className="font-black">{customer.name}</h3>
            <p className="text-sm text-slate-600">
              {customer.email} · {customer.phone}
            </p>
            <p className="text-sm text-slate-600">
              {customer.address}, {customer.suburb}
            </p>
            <button
              type="button"
              className="mt-3 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold"
              onClick={() => void onPost('invite_customer', { customerId: customer.id })}
            >
              Invite to the job app
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Jobs({
  store,
  preview,
  onPost,
  onLocal,
}: {
  store: TradegraphStore;
  preview: boolean;
  onPost: (action: string, extra?: Record<string, unknown>) => Promise<void>;
  onLocal: (store: TradegraphStore) => void;
}) {
  const now = new Date().toISOString();
  const [jobError, setJobError] = useState('');
  function applyLocal(next: () => TradegraphStore) {
    try {
      onLocal(next());
      setJobError('');
    } catch (err) {
      setJobError(err instanceof Error ? err.message : 'Could not update that record');
    }
  }
  return (
    <div className="space-y-6">
      {jobError ? <p className="text-sm font-semibold text-rose-700">{jobError}</p> : null}
      <section>
        <h2 className="font-black">Requests</h2>
        <ul className="mt-2 space-y-2">
          {store.requests.map((row) => (
            <li key={row.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
              <p className="font-bold">{row.description}</p>
              <p className="text-slate-600">
                {row.address} · {row.preferred_dates} · {row.status}
              </p>
              {row.status === 'new' ? (
                <button
                  type="button"
                  className="mt-2 rounded-full bg-[#00b4d8] px-3 py-1 text-xs font-bold text-white"
                  onClick={() =>
                    preview
                      ? applyLocal(() => requestToQuote(store, row.id, now))
                      : void onPost('quote_from_request', { requestId: row.id })
                  }
                >
                  Make a quote
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-black">Quotes</h2>
        <ul className="mt-2 space-y-2">
          {store.quotes.map((quote) => {
            const money = quoteTotals(quote.lines, store.settings.vat_rate);
            return (
              <li key={quote.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                <p className="font-bold">
                  {quote.number} · {quote.title} · {quote.status}
                </p>
                <p>
                  {formatZar(money.subtotal_cents)} ex VAT · {formatZar(money.total_cents)} incl VAT
                </p>
                {quote.status === 'sent' || quote.status === 'draft' ? (
                  <button
                    type="button"
                    className="mt-2 rounded-full bg-[#00b4d8] px-3 py-1 text-xs font-bold text-white"
                    onClick={() =>
                      preview
                        ? applyLocal(() => acceptQuote(store, quote.id, now))
                        : void onPost('accept_quote', { quoteId: quote.id })
                    }
                  >
                    Accept and open job
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h2 className="font-black">Jobs</h2>
        <ul className="mt-2 space-y-2">
          {store.jobs.map((job) => (
            <li key={job.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
              <p className="font-bold">
                {job.number} · {job.title} · {job.progress_pct}%
              </p>
              <p className="text-slate-600">{job.address}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold"
                  onClick={() => {
                    const note = 'Progress shared with the customer.';
                    if (preview) {
                      applyLocal(() =>
                        addJobUpdate(
                          store,
                          job.id,
                          { note, progress_pct: Math.min(100, job.progress_pct + 20), photo_url: null, shared: true },
                          now
                        )
                      );
                    } else {
                      void onPost('add_update', {
                        jobId: job.id,
                        note,
                        progress_pct: Math.min(100, job.progress_pct + 20),
                        shared: true,
                      });
                    }
                  }}
                >
                  Share progress
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold"
                  onClick={() =>
                    preview
                      ? applyLocal(() => invoiceJob(store, job.id, now))
                      : void onPost('invoice_job', { jobId: job.id })
                  }
                >
                  Create invoice
                </button>
                <label className="text-xs font-bold">
                  Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-1 block"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file || preview) return;
                      void readPhotoFile(file).then((photo) =>
                        onPost('add_update', {
                          jobId: job.id,
                          note: 'Photo from site.',
                          progress_pct: job.progress_pct,
                          photo_url: photo,
                          shared: true,
                        })
                      );
                    }}
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-black">Invoices</h2>
        <ul className="mt-2 space-y-2">
          {store.invoices.map((invoice) => (
            <li key={invoice.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
              <p className="font-bold">
                {invoice.number} · {formatZar(invoice.total_cents)} · {invoice.status}
              </p>
              {invoice.status !== 'paid' && invoice.status !== 'void' ? (
                <button
                  type="button"
                  className="mt-2 rounded-full bg-[#00b4d8] px-3 py-1 text-xs font-bold text-white"
                  onClick={() =>
                    preview
                      ? applyLocal(() => recordPayment(store, invoice.id, 100_000, 'EFT', now))
                      : void onPost('record_payment', {
                          invoiceId: invoice.id,
                          amount_cents: 100_000,
                          method: 'EFT',
                        })
                  }
                >
                  Record R1 000.00 EFT
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Materials({
  store,
  onPost,
}: {
  store: TradegraphStore;
  onPost: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const [supplierName, setSupplierName] = useState('');
  const [description, setDescription] = useState('');
  const [suppliers, setSuppliers] = useState<Array<{ id: number; name: string }>>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);

  useEffect(() => {
    const companyId = getSelectedCompanyId();
    if (!companyId) return;
    void fetch(`/api/suppliers?companyId=${companyId}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { suppliers?: Array<{ id?: number; trading_name?: string; legal_name?: string }> }) => {
        const rows = (data.suppliers || [])
          .map((row) => ({
            id: Number(row.id),
            name: String(row.trading_name || row.legal_name || 'Supplier'),
          }))
          .filter((row) => Number.isFinite(row.id));
        setSuppliers(rows.slice(0, 40));
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="rounded-3xl border border-slate-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const picked = suppliers.find((row) => row.id === supplierId);
          void onPost('save_material', {
            order: {
              supplier_id: supplierId,
              supplier_name: picked?.name || supplierName,
              status: 'ordered',
              lines: [{ description, qty: 1, unit_cents: 0 }],
            },
          });
        }}
      >
        <h2 className="font-black">Order materials</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pick a supplier from your SupplierAdvisor® book, or type a name.
        </p>
        <label className="mt-3 block text-sm font-semibold">
          Supplier book
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={supplierId ?? ''}
            onChange={(event) => setSupplierId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Not linked yet</option>
            {suppliers.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Or supplier name
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={supplierName}
            onChange={(event) => setSupplierName(event.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Material
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <button type="submit" className="mt-4 rounded-full bg-[#00b4d8] px-4 py-2 text-sm font-bold text-white">
          Place order
        </button>
        <Link href="/dashboard/suppliers" className="mt-3 block text-sm font-bold text-[#0077b6]">
          Open suppliers
        </Link>
      </form>
      <ul className="space-y-2">
        {store.materials.map((order) => (
          <li key={order.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
            <p className="font-bold">
              {order.supplier_name} · {order.status}
            </p>
            <p>{formatZar(materialOrderCents(order))}</p>
            <p className="text-slate-600">{order.lines.map((line) => line.description).join(', ')}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Schedule({
  store,
  onPost,
}: {
  store: TradegraphStore;
  onPost: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [starts, setStarts] = useState('');
  return (
    <div>
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const start = new Date(starts);
          if (!title.trim() || Number.isNaN(start.getTime())) return;
          void onPost('save_slot', {
            slot: {
              title: title.trim(),
              starts_at: start.toISOString(),
              ends_at: new Date(start.getTime() + 2 * 3600 * 1000).toISOString(),
              address: '',
            },
          });
        }}
      >
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Visit"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <input
          type="datetime-local"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={starts}
          onChange={(event) => setStarts(event.target.value)}
        />
        <button type="submit" className="rounded-full bg-[#00b4d8] px-4 py-2 text-sm font-bold text-white">
          Add to schedule
        </button>
      </form>
      <ul className="space-y-2">
        {store.schedule.map((slot) => (
          <li key={slot.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
            <p className="font-bold">{slot.title}</p>
            <p className="text-slate-600">
              {slot.starts_at.replace('T', ' ').slice(0, 16)} · {slot.address}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Compliance({
  store,
  alerts,
  onPost,
}: {
  store: TradegraphStore;
  alerts: ReturnType<typeof complianceReminders>;
  onPost: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    kind: 'coc',
    number: '',
    holder: '',
    expires_on: '',
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="rounded-3xl border border-slate-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onPost('save_compliance', { cert: form });
        }}
      >
        <h2 className="font-black">Add a certificate</h2>
        <label className="mt-3 block text-sm font-semibold">
          Kind
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={form.kind}
            onChange={(event) => setForm({ ...form, kind: event.target.value })}
          >
            <option value="coc">Electrical CoC</option>
            <option value="pirb">PIRB</option>
            <option value="gas">Gas CoC</option>
            <option value="other">Other</option>
          </select>
        </label>
        {(['number', 'holder', 'expires_on'] as const).map((key) => (
          <label key={key} className="mt-3 block text-sm font-semibold">
            {key === 'expires_on' ? 'Expires' : key}
            <input
              type={key === 'expires_on' ? 'date' : 'text'}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={form[key]}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
            />
          </label>
        ))}
        <button type="submit" className="mt-4 rounded-full bg-[#00b4d8] px-4 py-2 text-sm font-bold text-white">
          Save certificate
        </button>
      </form>
      <ul className="space-y-2">
        {store.compliance.map((cert) => {
          const alert = alerts.find((row) => row.id === cert.id);
          return (
            <li key={cert.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
              <p className="font-bold">
                {complianceLabel(cert.kind)} · {cert.number}
              </p>
              <p className="text-slate-600">
                {cert.holder} · expires {cert.expires_on}
                {alert ? ` · ${alert.level}` : ''}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
