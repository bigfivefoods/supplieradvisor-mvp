'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Loader2, Star } from 'lucide-react';

type SurveyMeta = {
  title: string;
  audience?: string;
  meal_type?: string;
};

export default function PublicFoodSurveyPage() {
  const params = useParams();
  const token = String(params?.token || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState('School');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [survey, setSurvey] = useState<SurveyMeta | null>(null);
  const [rating, setRating] = useState(0);
  const [taste, setTaste] = useState(0);
  const [portion, setPortion] = useState(0);
  const [cleanliness, setCleanliness] = useState(0);
  const [variety, setVariety] = useState(0);
  const [comment, setComment] = useState('');
  const [role, setRole] = useState('learner');
  const [grade, setGrade] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/school-survey?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Survey not found');
      setSurvey(data.survey);
      setSchoolName(data.school?.name || 'School');
      setPhotoUrl(data.school?.photo_url || null);
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
    if (rating < 1) return;
    setSending(true);
    try {
      const res = await fetch('/api/public/school-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          rating,
          taste: taste || null,
          portion: portion || null,
          cleanliness: cleanliness || null,
          variety: variety || null,
          comment: comment || null,
          respondent_role: role,
          grade: grade || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit');
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-900">
      <div className="mx-auto max-w-md px-4 py-8">
        {loading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : error && !survey ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
            <p className="font-bold text-rose-900">{error}</p>
          </div>
        ) : done ? (
          <div className="rounded-3xl border border-emerald-200 bg-white p-10 text-center shadow-sm">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
            <h1 className="text-2xl font-black text-slate-900">Thank you!</h1>
            <p className="text-sm text-slate-600 mt-2">
              Your feedback helps {schoolName} serve better meals every day.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <header className="text-center">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt=""
                  className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3 border-2 border-white shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-[#00b4d8]/15 text-[#0077b6] font-black text-2xl flex items-center justify-center mx-auto mb-3">
                  {schoolName.slice(0, 1)}
                </div>
              )}
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
                {schoolName}
              </p>
              <h1 className="text-xl font-black mt-1 leading-snug">
                {survey?.title || 'How was your school meal?'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Tap stars — takes under 30 seconds
              </p>
            </header>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
              <StarRow
                label="Overall"
                value={rating}
                onChange={setRating}
                large
              />
              <StarRow label="Taste" value={taste} onChange={setTaste} />
              <StarRow label="Portion" value={portion} onChange={setPortion} />
              <StarRow
                label="Cleanliness"
                value={cleanliness}
                onChange={setCleanliness}
              />
              <StarRow label="Variety" value={variety} onChange={setVariety} />

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    I am a
                  </span>
                  <select
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="learner">Learner</option>
                    <option value="parent">Parent</option>
                    <option value="staff">Staff</option>
                    <option value="visitor">Visitor</option>
                  </select>
                </label>
                <label className="text-xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Grade (optional)
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="e.g. 5"
                  />
                </label>
              </div>

              <label className="block text-xs">
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Comment (optional)
                </span>
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[72px]"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What should we improve?"
                  maxLength={1000}
                />
              </label>

              {error ? (
                <p className="text-sm text-rose-600 font-semibold">{error}</p>
              ) : null}

              <button
                type="button"
                disabled={rating < 1 || sending}
                onClick={() => void submit()}
                className="w-full rounded-2xl bg-[#0077b6] text-white font-bold py-3.5 text-sm disabled:opacity-40 inline-flex items-center justify-center gap-2 shadow-lg shadow-sky-900/10"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Send feedback'
                )}
              </button>
            </div>

            <p className="text-center text-[10px] text-slate-400">
              Powered by SupplierAdvisor · NSNP schools
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StarRow({
  label,
  value,
  onChange,
  large,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  large?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`font-bold text-slate-700 ${large ? 'text-sm' : 'text-xs'}`}
        >
          {label}
        </span>
        {value > 0 ? (
          <span className="text-xs font-bold text-amber-600 tabular-nums">
            {value}/5
          </span>
        ) : null}
      </div>
      <div className="flex gap-1.5 justify-center sm:justify-start">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`rounded-xl transition-transform active:scale-95 ${
              large ? 'p-1.5' : 'p-1'
            }`}
            aria-label={`${label} ${n} stars`}
          >
            <Star
              className={`${large ? 'w-9 h-9' : 'w-7 h-7'} ${
                n <= value
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-200 fill-slate-100'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
