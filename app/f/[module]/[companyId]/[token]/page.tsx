'use client';

/**
 * Public post-visit feedback form for members / patients.
 * MedicalAdvisor uses a branded light page (logo + session/practice stars).
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, Loader2, MessageSquareHeart, Star } from 'lucide-react';
import {
  FEELING_LABELS,
  SERVICE_FEEDBACK_TAGS,
  type FeedbackModule,
} from '@/lib/services/booking-feedback';

function starFromQuery(key: string): number | null {
  if (typeof window === 'undefined') return null;
  const n = Number(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : null;
}

function StarRow({
  value,
  onChange,
  accent = '#059669',
}: {
  value: number;
  onChange: (n: number) => void;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            className="p-0.5"
          >
            <Star
              className="h-8 w-8"
              fill={on ? accent : 'none'}
              color={on ? accent : '#cbd5e1'}
              strokeWidth={1.6}
            />
          </button>
        );
      })}
      <span className="ml-2 text-sm font-bold text-slate-600">
        {FEELING_LABELS[value] || value}
      </span>
    </div>
  );
}

export default function PublicBookingFeedbackPage() {
  const params = useParams() as {
    module: string;
    companyId: string;
    token: string;
  };
  const module = String(params.module || '').toLowerCase() as FeedbackModule;
  const companyId = Number(params.companyId);
  const token = decodeURIComponent(String(params.token || ''));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState('Practice');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [eventLabel, setEventLabel] = useState('');
  const [personName, setPersonName] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feeling, setFeeling] = useState(4);
  const [practice, setPractice] = useState(4);
  const [intensity, setIntensity] = useState(5);
  const [enjoyment, setEnjoyment] = useState(4);
  const [wouldReturn, setWouldReturn] = useState(4);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const medical = module === 'medicalgraph';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        module,
        companyId: String(companyId),
        token,
      });
      const res = await fetch(`/api/public/booking-feedback?${q}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Link not found');
      setBrand(data.brand || 'Practice');
      setLogoUrl(data.logo_url || null);
      setEventLabel(data.event_label || '');
      setPersonName(data.person_name || '');
      if (data.already_submitted) setDone(true);
      const s = starFromQuery('session');
      const p = starFromQuery('practice');
      if (s) {
        setFeeling(s);
        setEnjoyment(s);
      }
      if (p) {
        setPractice(p);
        setWouldReturn(p);
      }
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not open feedback');
    } finally {
      setLoading(false);
    }
  }, [module, companyId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/public/booking-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          companyId,
          token,
          feeling,
          intensity: medical ? feeling * 2 : intensity,
          enjoyment: medical ? feeling : enjoyment,
          would_return: medical ? practice : wouldReturn,
          practice,
          comment: comment.trim() || undefined,
          tags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const accent =
    module === 'fitgraph'
      ? 'violet'
      : module === 'dentalgraph'
        ? 'sky'
        : module === 'medicalgraph'
          ? 'emerald'
          : 'teal';
  const accentBtn =
    accent === 'violet'
      ? 'bg-violet-600 hover:bg-violet-500'
      : accent === 'sky'
        ? 'bg-sky-600 hover:bg-sky-500'
        : accent === 'emerald'
          ? 'bg-emerald-700 hover:bg-emerald-600'
          : 'bg-teal-600 hover:bg-teal-500';
  const accentText =
    accent === 'violet'
      ? 'text-violet-300'
      : accent === 'sky'
        ? 'text-sky-300'
        : accent === 'emerald'
          ? 'text-emerald-700'
          : 'text-teal-300';

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          medical ? 'bg-emerald-50' : 'bg-slate-950'
        }`}
      >
        <Loader2
          className={`w-8 h-8 animate-spin ${
            medical ? 'text-emerald-700' : 'text-slate-400'
          }`}
        />
      </div>
    );
  }

  if (medical) {
    return (
      <div className="min-h-screen bg-[#f3faf7] px-4 py-10">
        <div className="mx-auto max-w-md space-y-5">
          <div className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-sm">
            <div className="bg-emerald-700 px-6 py-7 text-center text-white">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={brand}
                  className="mx-auto mb-3 h-14 max-w-[180px] object-contain"
                />
              ) : (
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-lg font-black">
                  {(brand.replace(/[^A-Za-z0-9]/g, ' ').trim()[0] || 'M').toUpperCase()}
                </div>
              )}
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100">
                MedicalAdvisor®
              </p>
              <h1 className="mt-1 text-2xl font-black">{brand}</h1>
              <p className="mt-1 text-sm text-emerald-50/90">
                {personName ? `Hi ${personName}` : 'Thank you for your visit'}
                {eventLabel ? ` · ${eventLabel}` : ''}
              </p>
            </div>

            <div className="space-y-5 px-6 py-6">
              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {error}
                </div>
              ) : null}

              {done ? (
                <div className="space-y-2 py-6 text-center">
                  <Check className="mx-auto h-10 w-10 text-emerald-600" />
                  <h2 className="text-lg font-black text-slate-900">Thank you</h2>
                  <p className="text-sm text-slate-600">
                    Your rating of the session and the practice has been sent to
                    the team.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-emerald-800">
                      Rate this session
                    </p>
                    <StarRow value={feeling} onChange={setFeeling} />
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-emerald-800">
                      Rate the practice
                    </p>
                    <StarRow value={practice} onChange={setPractice} />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Front desk, rooms, and how you were looked after overall.
                    </p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-800">
                      What stood out
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SERVICE_FEEDBACK_TAGS.map((t) => {
                        const on = tags.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() =>
                              setTags((cur) =>
                                on ? cur.filter((x) => x !== t) : [...cur, t]
                              )
                            }
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                              on
                                ? 'border-emerald-700 bg-emerald-700 text-white'
                                : 'border-slate-200 bg-white text-slate-700'
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-800">
                      Comments (optional)
                    </p>
                    <textarea
                      className="min-h-[4.5rem] w-full resize-y rounded-2xl border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-sm text-slate-800"
                      placeholder="How was the consult? Anything the practice could do better?"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submit()}
                    className="w-full rounded-full bg-emerald-700 py-3 text-sm font-black text-white disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
                    ) : null}
                    Send feedback
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-400">
            MedicalAdvisor® · powered by SupplierAdvisor® · private to this
            practice
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-10">
      <div className="mx-auto max-w-md space-y-5">
        <div className="text-center space-y-1">
          <div
            className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${accentText}`}
          >
            <MessageSquareHeart className="w-3.5 h-3.5" />
            Feedback
          </div>
          <h1 className="text-2xl font-black">{brand}</h1>
          <p className="text-sm text-slate-400">
            {personName ? `Hi ${personName}` : 'Thanks for attending'}
            {eventLabel ? ` · ${eventLabel}` : ''}
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-800/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {done ? (
          <div className="rounded-3xl border border-emerald-700/40 bg-emerald-950/40 p-6 text-center space-y-2">
            <Check className="w-10 h-10 mx-auto text-emerald-400" />
            <h2 className="text-lg font-black">Thank you</h2>
            <p className="text-sm text-slate-300">
              Your feedback has been sent to the team. It helps them improve
              future sessions for you.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-700 bg-slate-900 p-5 space-y-4">
            <p className="text-[11px] text-slate-400">
              Please rate your visit. This takes under a minute.
            </p>

            <div>
              <div className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ${accentText}`}>
                Overall experience · {FEELING_LABELS[feeling] || feeling}
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={feeling}
                onChange={(e) => setFeeling(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Poor</span>
                <span>Excellent</span>
              </div>
            </div>

            <div>
              <div className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ${accentText}`}>
                Intensity / effort · {intensity}/10
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ${accentText}`}>
                Satisfaction · {enjoyment}/5
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={enjoyment}
                onChange={(e) => setEnjoyment(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ${accentText}`}>
                Would return / rebook · {wouldReturn}/5
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={wouldReturn}
                onChange={(e) => setWouldReturn(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ${accentText}`}>
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SERVICE_FEEDBACK_TAGS.map((t) => {
                  const on = tags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setTags((cur) =>
                          on ? cur.filter((x) => x !== t) : [...cur, t]
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        on
                          ? 'border-white bg-white text-slate-900'
                          : 'border-slate-600 text-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ${accentText}`}>
                Comments (optional)
              </div>
              <textarea
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[4rem] resize-y"
                placeholder="What went well? What could improve?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className={`w-full rounded-xl py-3 text-sm font-black text-white disabled:opacity-50 ${accentBtn}`}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : null}{' '}
              Send feedback
            </button>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-600">
          Powered by SupplierAdvisor® · private to this practice
        </p>
      </div>
    </div>
  );
}
