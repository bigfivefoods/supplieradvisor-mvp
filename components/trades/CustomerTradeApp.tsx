'use client';

import { useEffect, useState } from 'react';
import { Bell, Download, FileText, HardHat, Plus } from 'lucide-react';
import { TradeBookProvider } from '@/components/trades/TradeBook';
import { ClientPwa } from '@/components/trades/ClientPwa';
import {
  customerPortalView,
  formatZar,
  quoteTotals,
  seedDemoTradegraph,
  type CustomerPortal,
} from '@/lib/trades/tradegraph';
import { readPhotoFile } from '@/components/trades/photo';

type Tab = 'jobs' | 'statement' | 'request' | 'install';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

export function CustomerTradeApp({ token, customerId = 'tc_naledi' }: { token: string; customerId?: string }) {
  if (token === 'demo') {
    return (
      <TradeBookProvider>
        <ClientPwa customerId={customerId} />
      </TradeBookProvider>
    );
  }
  return <LiveCustomerTradeApp token={token} />;
}

function LiveCustomerTradeApp({ token }: { token: string }) {
  const demo = token === 'demo';
  const [tab, setTab] = useState<Tab>('jobs');
  const [brand, setBrand] = useState(demo ? 'Harbour Trades' : 'TradeAdvisor®');
  const [portal, setPortal] = useState<CustomerPortal | null>(
    demo
      ? customerPortalView(seedDemoTradegraph('2026-10-14T08:00:00.000Z'), 'tc_demo_thandi')
      : null
  );
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<'email' | 'code' | 'in'>(demo ? 'in' : 'email');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [alerts, setAlerts] = useState<'unknown' | 'on' | 'off' | 'unavailable'>('unknown');
  const [request, setRequest] = useState({
    description: '',
    address: '',
    preferred_dates: '',
    photo_urls: [] as string[],
  });

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    void (async () => {
      try {
        const brandRes = await fetch(
          `/api/public/tradegraph?token=${encodeURIComponent(token)}`,
          { cache: 'no-store' }
        );
        const brandJson = (await brandRes.json()) as { brand?: string };
        if (!cancelled && brandJson.brand) setBrand(brandJson.brand);
        const magic = new URLSearchParams(window.location.search).get('magic');
        if (magic) {
          const signed = await fetch('/api/public/tradegraph', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'magic', token, magic }),
          });
          if (signed.ok) {
            window.history.replaceState({}, '', window.location.pathname);
            await loadHome();
            return;
          }
        }
        const home = await fetch('/api/public/tradegraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'home', token }),
        });
        if (!home.ok) return;
        const data = (await home.json()) as { portal?: CustomerPortal };
        if (!cancelled && data.portal) {
          setPortal(data.portal);
          setPhase('in');
          if (data.portal.brand?.brand_name) setBrand(data.portal.brand.brand_name);
        }
      } catch {
        if (!cancelled) setMessage('Reconnect to load your jobs.');
      }
    })();
    return () => {
      cancelled = true;
    };
    async function loadHome() {
      const home = await fetch('/api/public/tradegraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'home', token }),
      });
      const data = (await home.json()) as { portal?: CustomerPortal };
      if (data.portal) {
        setPortal(data.portal);
        setPhase('in');
      }
    }
  }, [demo, token]);

  async function sendCode() {
    setBusy(true);
    setMessage('');
    try {
      await fetch('/api/public/tradegraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_otp', token, email }),
      });
      setPhase('code');
      setMessage('If this email is on the book, the code is on its way.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/public/tradegraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', token, email, code }),
      });
      const data = (await res.json()) as { error?: string; portal?: CustomerPortal };
      if (!res.ok) {
        setMessage(data.error || 'That code does not match.');
        return;
      }
      const home = await fetch('/api/public/tradegraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'home', token }),
      });
      const loaded = (await home.json()) as { portal?: CustomerPortal; error?: string };
      if (!loaded.portal) {
        setMessage(loaded.error || 'Signed in, but the book is not ready yet.');
        return;
      }
      setPortal(loaded.portal);
      setPhase('in');
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest() {
    if (demo) {
      setMessage('This is the sample app. Your tradesperson’s invite sends the request for real.');
      setTab('jobs');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/public/tradegraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_job', token, ...request }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error || 'Could not send the request');
        return;
      }
      setMessage('Request sent. It will show on your tradesperson’s quote list.');
      setRequest({ description: '', address: '', preferred_dates: '', photo_urls: [] });
      setTab('jobs');
    } finally {
      setBusy(false);
    }
  }

  async function allowAlerts() {
    if (demo) {
      setMessage('This sample does not register a device. Your invite turns alerts on for real.');
      return;
    }
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setAlerts('unavailable');
      setMessage('This browser cannot show alerts. Email updates still arrive if your tradesperson sends them.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const keyRes = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
      const keyData = (await keyRes.json()) as { configured?: boolean; publicKey?: string };
      if (!keyData.configured || !keyData.publicKey) {
        setAlerts('unavailable');
        setMessage('Alerts are not available on this book yet. You can still open jobs here.');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setAlerts('off');
        setMessage('Alerts stay off until this browser allows notifications.');
        return;
      }
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await fetch('/api/public/tradegraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'push_subscribe',
          token,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error || 'Could not turn alerts on.');
        return;
      }
      setAlerts('on');
      setMessage('Alerts are on for job updates, invoices, and statement changes.');
    } catch {
      setMessage('Could not turn alerts on. The rest of the app still works.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50 to-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 bg-[#00b4d8] text-[#0f172a] shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0f172a]/70">
            TradeAdvisor®
          </p>
          <h1 className="truncate text-xl font-black">{brand}</h1>
        </div>
        {demo ? (
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">
            Sample
          </span>
        ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 pb-28">
        {message ? (
          <p className="mb-3 rounded-2xl bg-sky-50 px-3 py-2 text-sm text-sky-950">{message}</p>
        ) : null}
        {phase !== 'in' ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Open your jobs</h2>
            <p className="mt-1 text-sm text-slate-600">
              Use the email your tradesperson has on file. SupplierAdvisor® sends a code or a magic link. No password.
            </p>
            {phase === 'email' ? (
              <label className="mt-4 block text-sm font-semibold">
                Email
                <input
                  className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                />
              </label>
            ) : (
              <label className="mt-4 block text-sm font-semibold">
                6-digit code
                <input
                  className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 tracking-[0.3em] outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </label>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void (phase === 'email' ? sendCode() : verifyCode())}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#00b4d8] py-3 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]"
            >
              {phase === 'email' ? 'Email me a code' : 'Sign in'}
            </button>
          </section>
        ) : null}

        {phase === 'in' && tab === 'jobs' ? (
          <section className="space-y-3">
            {demo ? null : (
              <a
                className="inline-block text-sm font-bold text-[#00b4d8]"
                href={`/api/public/tradegraph/ics?token=${encodeURIComponent(token)}`}
              >
                Add my visits to my calendar
              </a>
            )}
            {(portal?.jobs || []).map((job) => (
              <article key={job.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500">{job.number}</p>
                    <h2 className="text-lg font-black">{job.title}</h2>
                  </div>
                  <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-900">
                    {job.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-[#00b4d8]" style={{ width: `${job.progress_pct}%` }} />
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">{job.progress_pct}% complete</p>
                <ul className="mt-3 space-y-3">
                  {job.updates.map((update) => (
                    <li key={update.id} className="text-sm text-slate-700">
                      <p>{update.note}</p>
                      {update.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={update.photo_url}
                          alt=""
                          className="mt-2 h-36 w-full rounded-2xl object-cover"
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
            {!portal?.jobs.length ? (
              <p className="text-sm text-slate-600">No jobs shared yet.</p>
            ) : null}
          </section>
        ) : null}

        {phase === 'in' && tab === 'statement' ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black">Statement</h2>
            <p className="mt-1 text-3xl font-black text-[#00b4d8]">
              {formatZar(portal?.balance_cents || 0)}
            </p>
            <p className="text-xs font-semibold text-slate-500">Balance including VAT</p>
            <h3 className="mt-4 text-sm font-black">Quotes</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {(portal?.quotes || []).map((quote) => (
                <li key={quote.id} className="flex justify-between gap-3">
                  <span>
                    {quote.number} · {quote.title}
                    {demo ? null : (
                      <a
                        className="mt-1 block font-bold text-[#00b4d8]"
                        href={`/api/public/tradegraph/quote-pdf?token=${encodeURIComponent(token)}&quote=${encodeURIComponent(quote.id)}`}
                      >
                        Download quote PDF
                      </a>
                    )}
                  </span>
                  <span>{formatZar(quoteTotals(quote.lines, portal?.brand.vat_rate).total_cents)}</span>
                </li>
              ))}
            </ul>
            <h3 className="mt-4 text-sm font-black">Invoices</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {(portal?.invoices || []).map((invoice) => (
                <li key={invoice.id} className="flex justify-between gap-3">
                  <span>
                    {invoice.number} · {invoice.status}
                  </span>
                  <span>{formatZar(invoice.total_cents)}</span>
                </li>
              ))}
            </ul>
            <h3 className="mt-4 text-sm font-black">Payments</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {(portal?.payments || []).map((payment) => (
                <li key={payment.id} className="flex justify-between gap-3">
                  <span>{payment.method}</span>
                  <span>{formatZar(payment.amount_cents)}</span>
                </li>
              ))}
            </ul>
            {demo ? (
              <p className="mt-4 text-sm text-slate-500">
                The PDF download is available after you sign in with your invite.
              </p>
            ) : (
              <a
                href="/api/public/tradegraph/statement"
                className="mt-4 inline-flex items-center gap-2 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]"
              >
                <FileText className="h-4 w-4" /> Download PDF
              </a>
            )}
          </section>
        ) : null}

        {phase === 'in' && tab === 'request' ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black">Request a job</h2>
            <label className="mt-3 block text-sm font-semibold">
              What needs doing?
              <textarea
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30"
                rows={4}
                value={request.description}
                onChange={(event) =>
                  setRequest({ ...request, description: event.target.value })
                }
              />
            </label>
            <label className="mt-3 block text-sm font-semibold">
              Address
              <input
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30"
                value={request.address}
                onChange={(event) => setRequest({ ...request, address: event.target.value })}
              />
            </label>
            <label className="mt-3 block text-sm font-semibold">
              Preferred dates
              <input
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30"
                value={request.preferred_dates}
                onChange={(event) =>
                  setRequest({ ...request, preferred_dates: event.target.value })
                }
              />
            </label>
            <label className="mt-3 block text-sm font-semibold">
              Photos
              <input
                className="mt-1 block w-full text-sm"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void readPhotoFile(file)
                    .then((photo) =>
                      setRequest((current) => ({
                        ...current,
                        photo_urls: [...current.photo_urls, photo].slice(0, 3),
                      }))
                    )
                    .catch((error: Error) => setMessage(error.message));
                }}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitRequest()}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#00b4d8] py-3 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]"
            >
              Send request
            </button>
          </section>
        ) : null}

        {tab === 'install' ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black">Add to your home screen</h2>
            <p className="mt-2 text-sm text-slate-600">
              Install this as an app for {brand}. It opens on your jobs, works on a phone, and keeps a short offline note if the network drops.
            </p>
            <button
              type="button"
              className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]"
              onClick={() => void installEvent?.prompt()}
            >
              <Download className="h-4 w-4" /> Add to home screen
            </button>
            <p className="mt-3 text-sm text-slate-600">
              On iPhone, tap Share, then Add to Home Screen.
            </p>
            <h3 className="mt-6 text-base font-black">Job alerts</h3>
            <p className="mt-1 text-sm text-slate-600">
              Allow alerts for status changes, new invoices, and statement updates. If they are not set up yet, the app still works.
            </p>
            <button
              type="button"
              disabled={busy || alerts === 'on'}
              onClick={() => void allowAlerts()}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-3 text-sm font-bold"
            >
              <Bell className="h-4 w-4" />
              {alerts === 'on' ? 'Alerts on' : alerts === 'unavailable' ? 'Alerts unavailable' : 'Allow alerts'}
            </button>
          </section>
        ) : null}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pt-1 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md" style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-md items-end justify-around">
          {(
            [
              ['jobs', 'Jobs', HardHat, false],
              ['statement', 'Statement', FileText, false],
              ['request', 'Request', Plus, true],
              ['install', 'Install', Download, false],
            ] as const
          ).map(([id, label, Icon, emphasis]) => {
            const on = tab === id;
            if (emphasis) {
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={on ? 'page' : undefined}
                  className="relative -mt-5 flex flex-col items-center gap-0.5 px-1"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00b4d8] text-[#0f172a] shadow-lg ring-4 ring-white">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className={`text-[10px] font-black ${on ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
                </button>
              );
            }
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={on ? 'page' : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-black ${
                  on ? 'text-[#00b4d8]' : 'text-slate-500'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
