'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { formatMoney } from '@/lib/customers/types';
import type { PublicPortalPayload } from '@/lib/portals/trade-portal';

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portal, setPortal] = useState<PublicPortalPayload | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setError('Missing portal link');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/public/portals/trade?token=${encodeURIComponent(token)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Portal unavailable');
      setPortal(data.portal);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setPortal(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md text-center rounded-[1.75rem] border border-white bg-white p-10 shadow-sm">
          <Building2 className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <h1 className="text-xl font-black text-slate-900 mb-2">
            Portal unavailable
          </h1>
          <p className="text-sm text-neutral-600 leading-relaxed">
            {error || 'This link is not active.'}
          </p>
          <Link href="/login" className="btn-primary mt-6 inline-flex !py-2.5 !px-5 text-sm">
            Go to SupplierAdvisor
          </Link>
        </div>
      </div>
    );
  }

  const host = portal.host;
  const kindLabel = portal.kind === 'customer' ? 'Customer' : 'Supplier';
  const greeting = portal.viewer?.name
    ? `Hello, ${portal.viewer.name}`
    : `Welcome to ${host.name}`;

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(0,180,216,0.16),transparent),radial-gradient(900px_500px_at_100%_0%,rgba(0,119,182,0.12),transparent)] bg-slate-50">
      <header className="border-b border-white/70 bg-white/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {host.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={host.logo_url}
                alt=""
                className="h-10 w-10 rounded-2xl object-contain bg-white border border-slate-100"
              />
            ) : (
              <div className="h-10 w-10 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#0077b6]" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">
                {kindLabel} portal
              </p>
              <p className="font-black text-slate-900 truncate">{host.name}</p>
            </div>
          </div>
          {host.verified ? (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2.5 py-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified
            </span>
          ) : null}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 space-y-5">
        <section className="rounded-[1.75rem] border border-white/80 bg-white/90 p-6 sm:p-8 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0077b6]">
            {portal.title}
          </p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            {greeting}
          </h1>
          {portal.accountLabel ? (
            <p className="mt-2 text-sm text-neutral-600">
              Account · <strong>{portal.accountLabel}</strong>
            </p>
          ) : null}
          {portal.welcome ? (
            <p className="mt-4 text-[15px] leading-relaxed text-slate-700">
              {portal.welcome}
            </p>
          ) : (
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
              {host.name} uses SupplierAdvisor to trade with you — this page is
              yours, no login required.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-neutral-600">
            {host.city || host.country ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-100 px-3 py-1">
                <MapPin className="w-3.5 h-3.5 text-[#00b4d8]" />
                {[host.city, host.country].filter(Boolean).join(', ')}
              </span>
            ) : null}
            {host.industry ? (
              <span className="rounded-full bg-slate-50 border border-slate-100 px-3 py-1">
                {host.industry}
              </span>
            ) : null}
            {portal.moneyHint ? (
              <span className="rounded-full bg-cyan-50 border border-cyan-100 text-[#0077b6] font-semibold px-3 py-1">
                {portal.moneyHint}
              </span>
            ) : null}
          </div>
        </section>

        {portal.kind === 'customer' ? (
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

        {portal.documents.length > 0 ? (
          <section className="rounded-[1.5rem] border border-white/70 bg-white/90 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-900">Documents</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {portal.documents.map((d) => (
                <li key={`${d.name}-${d.url}`}>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-sky-50/60"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-900 truncate">
                        {d.name}
                      </span>
                      <span className="block text-[11px] text-neutral-500">
                        {d.category}
                      </span>
                    </span>
                    <FileText className="w-4 h-4 text-[#00b4d8] shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {portal.brochure ? (
          <p className="text-sm text-neutral-500 leading-relaxed px-1">
            This is the company brochure. Ask {host.name} for a personal link to
            see your own quotes and invoices.
          </p>
        ) : !portal.accountLabel ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
            Your name is on this portal, but no {portal.kind} account is attached
            yet — {host.name} can link it so live documents appear.
          </p>
        ) : null}

        <section className="rounded-[1.75rem] bg-gradient-to-br from-[#0077b6] to-[#00b4d8] p-6 sm:p-8 text-white shadow-lg">
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
      </main>

      <footer className="max-w-3xl mx-auto px-4 pb-10 text-center text-[11px] text-neutral-400">
        <Link href="/" className="hover:text-[#0077b6]">
          SupplierAdvisor®
        </Link>
        {host.public_path ? (
          <>
            {' '}
            ·{' '}
            <Link href={host.public_path} className="hover:text-[#0077b6]">
              {host.name} on the network
            </Link>
          </>
        ) : null}
      </footer>
    </div>
  );
}
