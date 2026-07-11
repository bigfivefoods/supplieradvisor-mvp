'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Loader2,
  Star,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

/**
 * Public invoice feedback — rate OTIFEF / log claim without login.
 * Linked + QR-coded from the invoice PDF/email.
 */
export default function InvoiceFeedbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <FeedbackInner />
    </Suspense>
  );
}

function FeedbackInner() {
  const { token } = useParams() as { token: string };
  const search = useSearchParams();
  const [tab, setTab] = useState<'rate' | 'claim'>(
    search.get('tab') === 'claim' ? 'claim' : 'rate'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seller, setSeller] = useState<{
    name: string;
    logo_url?: string | null;
    verified?: boolean;
  } | null>(null);
  const [invoice, setInvoice] = useState<{
    number?: string;
    total?: number;
    currency?: string;
    customer_name?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const [rating, setRating] = useState(5);
  const [otifef, setOtifef] = useState('90');
  const [onTime, setOnTime] = useState(true);
  const [inFull, setInFull] = useState(true);
  const [quality, setQuality] = useState(true);
  const [notes, setNotes] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [claimTitle, setClaimTitle] = useState('');
  const [claimType, setClaimType] = useState('quality');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/public/invoice-feedback?token=${encodeURIComponent(token)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid link');
      setSeller(data.seller);
      setInvoice(data.invoice);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setSaving(true);
    setDone(null);
    try {
      const res = await fetch('/api/public/invoice-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          tab === 'rate'
            ? {
                token,
                action: 'rate',
                rating,
                otifef: Number(otifef),
                on_time: onTime,
                in_full: inFull,
                quality,
                notes,
                contact_name: contactName || null,
                contact_email: contactEmail || null,
              }
            : {
                token,
                action: 'claim',
                title: claimTitle,
                claim_type: claimType,
                description: notes,
                contact_name: contactName || null,
                contact_email: contactEmail || null,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      setDone(data.message || 'Thank you!');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (error && !seller) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md text-center bg-white border rounded-3xl p-8 shadow-sm">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-black mb-2">Link not valid</h1>
          <p className="text-sm text-neutral-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-slate-50 px-4 py-10">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0077b6] mb-2">
            SupplierAdvisor®
          </div>
          {seller?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={seller.logo_url}
              alt={seller.name}
              className="h-14 mx-auto object-contain mb-3"
            />
          ) : null}
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {seller?.name}
            {seller?.verified ? (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 align-middle">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified
              </span>
            ) : null}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Invoice {invoice?.number || '—'}
            {invoice?.total != null
              ? ` · ${invoice.currency || 'ZAR'} ${Number(invoice.total).toLocaleString()}`
              : ''}
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => {
              setTab('rate');
              setDone(null);
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold ${
              tab === 'rate'
                ? 'bg-[#00b4d8] text-white'
                : 'bg-white border text-neutral-600'
            }`}
          >
            <Star className="w-4 h-4 inline mr-1" /> Rate (OTIFEF)
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('claim');
              setDone(null);
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold ${
              tab === 'claim'
                ? 'bg-amber-500 text-white'
                : 'bg-white border text-neutral-600'
            }`}
          >
            <AlertTriangle className="w-4 h-4 inline mr-1" /> Claim / RIAD
          </button>
        </div>

        <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4">
          {done ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="font-bold text-slate-900 mb-1">Submitted</p>
              <p className="text-sm text-neutral-600">{done}</p>
            </div>
          ) : (
            <>
              {tab === 'rate' ? (
                <>
                  <p className="text-sm text-neutral-600">
                    Rate this delivery for OTIFEF and network trust.
                  </p>
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase">
                      Overall stars
                    </label>
                    <div className="flex gap-2 mt-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRating(n)}
                          className={`w-11 h-11 rounded-xl border text-lg ${
                            rating >= n
                              ? 'bg-amber-400 border-amber-500 text-white'
                              : 'bg-white border-neutral-200 text-neutral-300'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase">
                      OTIFEF score (0–100)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                      value={otifef}
                      onChange={(e) => setOtifef(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                    {(
                      [
                        ['On time', onTime, setOnTime],
                        ['In full', inFull, setInFull],
                        ['Quality OK', quality, setQuality],
                      ] as const
                    ).map(([label, val, set]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => set(val === true ? false : true)}
                        className={`rounded-xl border py-2.5 ${
                          val
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-neutral-600">
                    Log a claim or RIAD (risk / issue / action / decision) for the seller.
                  </p>
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase">
                      Title *
                    </label>
                    <input
                      className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                      value={claimTitle}
                      onChange={(e) => setClaimTitle(e.target.value)}
                      placeholder="Short description of the issue"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase">
                      Type
                    </label>
                    <select
                      className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                      value={claimType}
                      onChange={(e) => setClaimType(e.target.value)}
                    >
                      <option value="quality">Quality</option>
                      <option value="delivery">Delivery</option>
                      <option value="shortage">Shortage</option>
                      <option value="damage">Damage</option>
                      <option value="service">Service / RIAD</option>
                      <option value="billing">Billing</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-bold text-neutral-500 uppercase">
                  Details
                </label>
                <textarea
                  className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm min-h-[88px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional comments"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-500 uppercase">
                    Your name
                  </label>
                  <input
                    className="mt-1 w-full rounded-2xl border px-3 py-2.5 text-sm"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-500 uppercase">
                    Email
                  </label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-2xl border px-3 py-2.5 text-sm"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="button"
                disabled={saving || (tab === 'claim' && !claimTitle.trim())}
                onClick={() => void submit()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white font-bold text-sm disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : tab === 'rate' ? (
                  'Submit rating'
                ) : (
                  'Submit claim'
                )}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-neutral-400 mt-6">
          Powered by <strong className="text-slate-600">SupplierAdvisor®</strong> ·{' '}
          <a href="https://www.supplieradvisor.com" className="text-[#0077b6]">
            supplieradvisor.com
          </a>
        </p>
      </div>
    </div>
  );
}
