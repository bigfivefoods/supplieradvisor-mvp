'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Loader2,
  Star,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Building2,
} from 'lucide-react';

/**
 * Public rate company — linked from quotation QR codes.
 * Works without login. Does not require discovery eligibility.
 */
export default function PublicCompanyRatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <RateInner />
    </Suspense>
  );
}

function RateInner() {
  const params = useParams();
  const search = useSearchParams();
  const rawId = (params as { companyId?: string | string[] })?.companyId;
  const companyId = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  const source = search.get('src') || search.get('from') || 'quote';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [company, setCompany] = useState<{
    id: number;
    name: string;
    logo_url?: string | null;
    verified?: boolean;
    city?: string | null;
    country?: string | null;
    industry?: string | null;
    blurb?: string | null;
    avg_stars?: number | null;
    rating_count?: number;
  } | null>(null);

  const [rating, setRating] = useState(5);
  const [notes, setNotes] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [quality, setQuality] = useState(true);
  const [communication, setCommunication] = useState(true);
  const [value, setValue] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(companyId) || companyId <= 0) {
      setError('Invalid link');
      setErrorDetail('No company id in this rate URL. Scan the quotation QR again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/company-rate?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) {
        throw Object.assign(new Error(data.error || 'Company not found'), {
          detail: data.detail || null,
        });
      }
      setCompany(data.company);
    } catch (e: unknown) {
      const err = e as Error & { detail?: string };
      setError(err?.message || 'Failed to load');
      setErrorDetail(err?.detail || null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setSaving(true);
    setDone(null);
    setError(null);
    try {
      const res = await fetch('/api/public/company-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          rating,
          notes: notes || null,
          contact_name: contactName || null,
          contact_email: contactEmail || null,
          quality,
          communication,
          value,
          source: String(source).slice(0, 40),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Submit failed');
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

  if (error && !company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md text-center bg-white border rounded-3xl p-8 shadow-sm">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-black mb-2">Link not valid</h1>
          <p className="text-sm text-neutral-600 font-semibold">{error}</p>
          {errorDetail && (
            <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
              {errorDetail}
            </p>
          )}
          <Link
            href="/"
            className="inline-block mt-6 text-sm font-bold text-[#0077b6] hover:underline"
          >
            Go to SupplierAdvisor →
          </Link>
        </div>
      </div>
    );
  }

  const loc = [company?.city, company?.country].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-slate-50 px-3 sm:px-4 py-8 sm:py-10 safe-area-pb">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-5 sm:mb-6">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0077b6] mb-2">
            SupplierAdvisor® · Rate a company
          </div>
          {company?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo_url}
              alt={company.name}
              className="h-16 sm:h-14 mx-auto object-contain mb-3"
            />
          ) : (
            <div className="mx-auto mb-3 flex h-16 w-16 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-[#00b4d8]/15 text-[#0077b6]">
              <Building2 className="h-8 w-8 sm:h-7 sm:w-7" />
            </div>
          )}
          <h1 className="text-2xl sm:text-[1.65rem] font-black text-slate-900 tracking-tight px-1">
            {company?.name}
            {company?.verified ? (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 align-middle">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified
              </span>
            ) : null}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {[company?.industry, loc].filter(Boolean).join(' · ') ||
              'On SupplierAdvisor'}
          </p>
          {company?.avg_stars != null && Number(company.rating_count || 0) > 0 ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              {company.avg_stars.toFixed(1)} · {company.rating_count} rating
              {company.rating_count === 1 ? '' : 's'}
            </p>
          ) : null}
          {company?.blurb ? (
            <p className="text-xs text-neutral-500 mt-2 max-w-sm mx-auto leading-relaxed">
              {company.blurb.slice(0, 160)}
            </p>
          ) : null}
        </div>

        <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-left">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#0077b6] mb-1">
            How we measure trust
          </p>
          <ul className="text-[12px] text-slate-700 leading-relaxed space-y-1 list-disc pl-4">
            <li>
              <strong>Stars</strong> — peer &amp; customer ratings after trade
            </li>
            <li>
              <strong>OTIFEF</strong> — On-Time · In-Full · Error-Free delivery
            </li>
            <li>
              <strong>Verified</strong> — CIPC company identity (when badged)
            </li>
          </ul>
        </div>

        <div className="bg-white border border-neutral-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
          {done ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="font-bold text-slate-900">{done}</p>
              <p className="text-sm text-neutral-500 mt-2">
                You can close this page.
              </p>
              <Link
                href={
                  company
                    ? `/c/${String(company.name || 'company')
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '')
                        .slice(0, 72) || 'company'}-${companyId}`
                    : `/c/${companyId}`
                }
                className="inline-block mt-4 text-sm font-bold text-[#0077b6] hover:underline"
              >
                View public profile →
              </Link>
              <div className="mt-6 pt-4 border-t border-neutral-100">
                <p className="text-xs text-neutral-500 mb-2">
                  Trade with verified partners free
                </p>
                <Link
                  href={`/onboarding?type=business&ref=${companyId}`}
                  className="inline-flex items-center justify-center rounded-full bg-[#00b4d8] px-5 py-2.5 text-sm font-bold text-white"
                >
                  Register your business
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Your rating
                </label>
                <div className="flex gap-1.5 mt-2 justify-center sm:justify-start">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className="p-1.5 rounded-xl hover:bg-amber-50 transition"
                      aria-label={`${n} stars`}
                    >
                      <Star
                        className={`w-8 h-8 ${
                          n <= rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-neutral-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-center sm:text-left text-sm font-bold text-slate-700 mt-1">
                  {rating}/5
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['Quality', quality, setQuality],
                    ['Communication', communication, setCommunication],
                    ['Value', value, setValue],
                  ] as const
                ).map(([label, on, set]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => set(!on)}
                    className={`rounded-2xl border px-2 py-2.5 text-[11px] font-bold ${
                      on
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-neutral-200 bg-white text-neutral-500'
                    }`}
                  >
                    {on ? '✓ ' : ''}
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-500">
                  Comments (optional)
                </label>
                <textarea
                  className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm min-h-[80px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What went well? What could improve?"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-500">
                    Your name (optional)
                  </label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Name"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-500">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 font-semibold">{error}</p>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() => void submit()}
                className="w-full min-h-[48px] rounded-2xl bg-[#00b4d8] py-3.5 text-sm font-bold text-white hover:bg-[#0096c7] disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Star className="w-4 h-4" />
                )}
                Submit rating
              </button>

              <p className="text-[11px] text-neutral-400 text-center leading-relaxed">
                No account required. Your rating is public feedback for the
                network — scanned from a quote or invoice QR.
              </p>
            </>
          )}
        </div>

        <p className="text-center mt-6">
          <Link
            href="/"
            className="text-xs font-semibold text-neutral-500 hover:text-[#0077b6]"
          >
            supplieradvisor.com
          </Link>
        </p>
      </div>
    </div>
  );
}
