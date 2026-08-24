'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { formatMoney } from '@/lib/customers/types';
import type { PublicPortalPayload } from '@/lib/portals/trade-portal';
import {
  GuestTradeWorkspace,
  guestPortalTabs,
  type GuestPortalTab,
} from '@/components/portals/GuestTradeWorkspace';
import { B2cThemeToggle } from '@/components/b2c/B2cThemeToggle';

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (['paid', 'won', 'accepted', 'delivered', 'received'].includes(s)) {
    return 'bg-emerald-50 text-emerald-800';
  }
  if (['overdue', 'void', 'cancelled', 'lost'].includes(s)) {
    return 'bg-rose-50 text-rose-800';
  }
  if (['sent', 'issued', 'confirmed', 'open', 'partial'].includes(s)) {
    return 'bg-sky-50 text-sky-800';
  }
  return 'bg-neutral-100 text-neutral-600';
}

function DocTable({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: PublicPortalPayload['quotes'];
}) {
  return (
    <section className="rounded-[1.5rem] border border-white/70 bg-white/90 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-900">{title}</h2>
        <span className="text-[11px] font-bold text-neutral-400 tabular-nums">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const open =
              Math.max(0, Number(r.amount || 0) - Number(r.paid || 0));
            return (
              <li
                key={`${r.kind}-${r.id}`}
                className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-sm">
                    {r.number}
                    {r.title ? (
                      <span className="font-medium text-neutral-500">
                        {' '}
                        · {r.title}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {[r.date, r.due ? `due ${r.due}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${statusTone(r.status)}`}
                  >
                    {r.status.replace(/_/g, ' ')}
                  </span>
                  {r.amount != null ? (
                    <span className="text-sm font-black tabular-nums text-slate-900">
                      {formatMoney(
                        r.kind === 'invoice' ? open : r.amount,
                        r.currency
                      )}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function GuestTradePortalPage() {
  const params = useParams() as { token?: string | string[] };
  const raw = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = String(raw || '').trim();
  const { ready, authenticated, getAccessToken, user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portal, setPortal] = useState<PublicPortalPayload | null>(null);
  const [tab, setTab] = useState<GuestPortalTab>('orders');
  const navReady = useRef(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) {
      setError('Missing portal link');
      setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const headers: Record<string, string> = {};
      try {
        if (authenticated && typeof getAccessToken === 'function') {
          const access = await getAccessToken();
          if (access) headers.Authorization = `Bearer ${access}`;
        }
      } catch {
        /* cookie fallback */
      }
      const q = new URLSearchParams({ token });
      if (privyUserId) q.set('privyUserId', privyUserId);
      const res = await fetch(`/api/public/portals/trade?${q.toString()}`, {
        headers,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Portal unavailable');
      setPortal(data.portal);
      setError(null);
      const isHost = data.portal?.actor?.role === 'host';
      const gaps = data.portal?.workspace?.profileGaps?.length || 0;
      if (!navReady.current) {
        navReady.current = true;
        if (gaps > 0 && !isHost) setTab('profile');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      if (!opts?.silent) setPortal(null);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [token, authenticated, getAccessToken, privyUserId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  if (!ready || loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 dark:bg-[#07111f]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-6 dark:bg-[#07111f]">
        <div className="max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-10 text-center dark:border-white/10 dark:bg-white/[0.06]">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-white/30" />
          <h1 className="mb-2 text-xl font-black text-slate-900 dark:text-white">
            Portal unavailable
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-white/70">
            {error || 'This link is not active.'}
          </p>
          <Link href="/login" className="btn-primary mt-6 inline-flex !px-5 !py-2.5 text-sm">
            Go to SupplierAdvisor
          </Link>
        </div>
      </div>
    );
  }

  const host = portal.host;
  const kindLabel = portal.kind === 'customer' ? 'Customer' : 'Supplier';
  const isHost = portal.actor?.role === 'host';
  const greeting = isHost
    ? `Hello, ${portal.actor?.name || 'there'}`
    : portal.viewer?.name
      ? `Hello, ${portal.viewer.name}`
      : `Welcome to ${host.name}`;
  const kpis = portal.kpis || {
    quotes: portal.quotes.length,
    orders: portal.orders.length || portal.purchase_orders.length,
    invoices_open: 0,
    due: null,
    currency: 'ZAR',
    people: (portal.people || []).length,
  };

  return (
    <div className="relative min-h-[100dvh] bg-slate-50 text-slate-900 dark:bg-[#07111f] dark:text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background:
            'radial-gradient(80% 50% at 10% -10%, rgba(0,180,216,0.28), transparent 55%), radial-gradient(70% 45% at 110% 0%, rgba(0,119,182,0.35), transparent 50%), radial-gradient(60% 40% at 50% 110%, rgba(14,165,233,0.16), transparent 45%)',
        }}
      />
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-[#07111f]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {host.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={host.logo_url}
                alt=""
                className="h-10 w-10 rounded-2xl border border-slate-200 bg-white object-contain dark:border-white/20"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 dark:bg-white/10">
                <Building2 className="h-5 w-5 text-[#00b4d8]" />
              </div>
            )}
            {portal.accountLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={portal.accountLogo}
                alt=""
                className="h-10 w-10 rounded-2xl border border-slate-200 bg-white object-contain dark:border-white/20"
                title={portal.accountLabel || 'Account'}
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0077b6] dark:text-[#7dd3fc]">
                {kindLabel} portal · SupplierAdvisor
              </p>
              <p className="truncate font-black text-slate-900 dark:text-white">
                {host.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <B2cThemeToggle compact />
            {isHost ? (
              <span className="hidden items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-100 sm:inline-flex">
                Signed in as {host.name}
              </span>
            ) : null}
            {host.verified ? (
              <span className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200 sm:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified
              </span>
            ) : null}
          </div>
        </div>
        {portal.workspace?.onBooks ? (
          <nav className="border-t border-slate-100 dark:border-white/10">
            <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 scrollbar-none sm:px-6 lg:px-8">
              {guestPortalTabs({
                kind: portal.kind,
                profileGaps: portal.workspace.profileGaps?.length || 0,
                isHost,
              }).map((t) => {
                const on = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                      on
                        ? 'bg-[#0077b6] text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="sa-page space-y-5">
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-white/[0.06] dark:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)] sm:p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0077b6] dark:text-[#7dd3fc]">
            {portal.title}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            {greeting}
          </h1>
          {portal.accountLabel ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-white/70">
              {portal.accountLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={portal.accountLogo}
                  alt=""
                  className="h-8 w-8 rounded-xl border border-slate-200 bg-white object-contain dark:border-white/20"
                />
              ) : null}
              {isHost ? (
                <>
                  Viewing{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {portal.accountLabel}
                  </strong>
                  ’s portal as{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {host.name}
                  </strong>
                </>
              ) : (
                <>
                  Live books for{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {portal.accountLabel}
                  </strong>
                </>
              )}
            </p>
          ) : null}
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-600 dark:text-white/80">
            {portal.welcome ||
              `${host.name} opened this window into their SupplierAdvisor operating system — quotes, deliveries, invoices, and trust, without a login.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/75">
            {host.city || host.country ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1">
                <MapPin className="h-3.5 w-3.5 text-[#00b4d8]" />
                {[host.city, host.country].filter(Boolean).join(', ')}
              </span>
            ) : null}
            {host.industry ? (
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                {host.industry}
              </span>
            ) : null}
          </div>
        </section>

        {!portal.brochure ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Quotes', kpis.quotes],
              [
                portal.kind === 'customer' ? 'Orders' : 'POs',
                kpis.orders,
              ],
              ['Open invoices', kpis.invoices_open],
              ['People', kpis.people],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/[0.07]"
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-white/50">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {portal.moneyHint ? (
          <p className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50">
            {portal.moneyHint}
          </p>
        ) : null}

        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] leading-relaxed text-slate-600 dark:border-white/10 dark:bg-black/20 dark:text-white/70">
          {isHost
            ? `You are working as ${host.name} in ${portal.accountLabel || 'this'} portal. Company profile and purchase orders update the same CRM/SRM books.`
            : `This is the same live ledger ${host.name} runs in SupplierAdvisor. Raise a purchase order, keep the company profile in sync with CRM, and add colleagues on People.`}
        </p>

        <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-[#f8fafc] p-3 text-slate-900 shadow-2xl sm:p-5">

        {portal.workspace?.onBooks ? (
          <GuestTradeWorkspace
            token={token}
            portal={portal}
            tab={tab}
            onTab={setTab}
            onRefresh={() => void load({ silent: true })}
          />
        ) : portal.kind === 'customer' ? (
          <>
            <DocTable
              title="Quotes"
              empty="No quotes on this account yet."
              rows={portal.quotes}
            />
            <DocTable
              title="Orders"
              empty="No orders on this account yet."
              rows={portal.orders}
            />
            <DocTable
              title="Invoices"
              empty="No invoices on this account yet."
              rows={portal.invoices}
            />
          </>
        ) : (
          <DocTable
            title="Purchase orders"
            empty="No purchase orders linked to this supplier yet."
            rows={portal.purchase_orders}
          />
        )}

        {portal.brochure ? (
          <p className="text-sm text-neutral-500 leading-relaxed px-1">
            This is the company brochure. Ask {host.name} for a personal link
            attached to your account on their books.
          </p>
        ) : !portal.workspace?.onBooks ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
            This link is not attached to a {portal.kind} on our books yet —{' '}
            {host.name} can attach your account so orders, OTIFEF, and RIAD appear.
          </p>
        ) : null}
        </div>

        <section className="rounded-[1.75rem] border border-white/15 bg-gradient-to-br from-[#0077b6] to-[#00b4d8] p-6 sm:p-8 text-white shadow-lg">
          <div className="flex items-start gap-3">
            <Sparkles className="w-6 h-6 shrink-0 opacity-90" />
            <div>
              <h2 className="text-xl font-black tracking-tight">
                Trade live with {host.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/90">
                Join SupplierAdvisor in minutes. Quote, pay, rate, and keep a
                verified history — the same OS they already run.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-white/95">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> One login for quotes,
                  invoices, and POs
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Trust scores from real
                  deliveries
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Free to start — 30-day
                  trial
                </li>
              </ul>
              <Link
                href={portal.joinPath}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white text-[#0077b6] font-black text-sm px-5 py-2.5 hover:bg-cyan-50"
              >
                Create your workspace <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
        </div>
      </main>

      <footer className="relative mx-auto max-w-7xl px-4 pb-10 text-center text-[11px] text-slate-400 dark:text-white/40 sm:px-6 lg:px-8">
        <Link href="/" className="hover:text-[#0077b6] dark:hover:text-white">
          SupplierAdvisor®
        </Link>
        {host.public_path ? (
          <>
            {' '}
            ·{' '}
            <Link href={host.public_path} className="hover:text-white">
              {host.name} on the network
            </Link>
          </>
        ) : null}
      </footer>
    </div>
  );
}
