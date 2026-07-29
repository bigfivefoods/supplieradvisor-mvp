'use client';

/**
 * School rates linked SPs (OTIFEF dimensions) and food quality with constructive feedback.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  Star,
  Truck,
  Utensils,
  MessageSquarePlus,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type LinkedIsp = { isp_profile_id: number; name: string };

type IspRating = {
  id: number;
  isp_profile_id: number;
  isp_name?: string;
  overall_rating: number;
  on_time_rating?: number | null;
  in_full_rating?: number | null;
  error_free_rating?: number | null;
  communication_rating?: number | null;
  constructive_feedback?: string | null;
  would_recommend?: boolean | null;
  created_at?: string;
};

type FoodRating = {
  id: number;
  feed_date: string;
  meal_type: string;
  overall_rating: number;
  taste_rating?: number | null;
  portion_rating?: number | null;
  appearance_rating?: number | null;
  temperature_rating?: number | null;
  menu_adherence_rating?: number | null;
  constructive_feedback?: string | null;
  what_worked?: string | null;
  what_to_improve?: string | null;
  recipe_name?: string | null;
  created_at?: string;
};

const STAR_OPTS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export default function SchoolRatingsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'sp' | 'food'>('sp');
  const [linkedIsps, setLinkedIsps] = useState<LinkedIsp[]>([]);
  const [ispRatings, setIspRatings] = useState<IspRating[]>([]);
  const [foodRatings, setFoodRatings] = useState<FoodRating[]>([]);

  // SP form
  const [ispId, setIspId] = useState('');
  const [spOverall, setSpOverall] = useState('4');
  const [spOnTime, setSpOnTime] = useState('4');
  const [spInFull, setSpInFull] = useState('4');
  const [spErrorFree, setSpErrorFree] = useState('4');
  const [spComm, setSpComm] = useState('4');
  const [spFeedback, setSpFeedback] = useState('');
  const [spRecommend, setSpRecommend] = useState(true);

  // Food form
  const [feedDate, setFeedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [mealType, setMealType] = useState('lunch');
  const [foodOverall, setFoodOverall] = useState('4');
  const [taste, setTaste] = useState('4');
  const [portion, setPortion] = useState('4');
  const [appearance, setAppearance] = useState('4');
  const [temp, setTemp] = useState('4');
  const [menuAdh, setMenuAdh] = useState('4');
  const [whatWorked, setWhatWorked] = useState('');
  const [whatImprove, setWhatImprove] = useState('');
  const [foodFeedback, setFoodFeedback] = useState('');
  const [recipeName, setRecipeName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/ratings?companyId=${companyId}&view=all`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setLinkedIsps(data.linked_isps || []);
      setIspRatings(data.isp_ratings || []);
      setFoodRatings(data.food_ratings || []);
      if (!ispId && (data.linked_isps || [])[0]) {
        setIspId(String(data.linked_isps[0].isp_profile_id));
      }
      if (data.message) toast.message(data.message);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, ispId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSpRating = async () => {
    if (!ispId) return toast.error('Select a service provider');
    setSaving(true);
    try {
      const res = await fetch('/api/schools/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'rate_isp',
          isp_profile_id: Number(ispId),
          overall_rating: Number(spOverall),
          on_time_rating: Number(spOnTime),
          in_full_rating: Number(spInFull),
          error_free_rating: Number(spErrorFree),
          communication_rating: Number(spComm),
          constructive_feedback: spFeedback,
          would_recommend: spRecommend,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(data.message || 'SP rating saved');
      setSpFeedback('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const saveFoodRating = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/schools/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'rate_food',
          feed_date: feedDate,
          meal_type: mealType,
          overall_rating: Number(foodOverall),
          taste_rating: Number(taste),
          portion_rating: Number(portion),
          appearance_rating: Number(appearance),
          temperature_rating: Number(temp),
          menu_adherence_rating: Number(menuAdh),
          constructive_feedback: foodFeedback,
          what_worked: whatWorked,
          what_to_improve: whatImprove,
          recipe_name: recipeName || null,
          isp_profile_id: ispId ? Number(ispId) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(data.message || 'Food rating saved');
      setFoodFeedback('');
      setWhatWorked('');
      setWhatImprove('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Rate SP & food"
        titleAccent="OTIFEF · feedback"
        description="Rate linked service providers on On-Time · In-Full · Error-Free delivery, and rate meals with constructive feedback for continuous improvement."
        action={
          <div className="flex gap-2">
            <Link
              href="/dashboard/schools/isp-sla"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              SP OTIFEF scores
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['sp', 'Rate service provider', Truck],
            ['food', 'Rate food / meal', Utensils],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold border inline-flex items-center gap-1.5 ${
              tab === id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : tab === 'sp' ? (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-sm font-black inline-flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" /> Rate linked SP
            </p>
            <p className="text-[11px] text-slate-500">
              OTIFEF = On-Time · In-Full · Error-Free. Add constructive feedback
              the SP can act on.
            </p>
            {linkedIsps.length === 0 ? (
              <p className="text-sm text-slate-500">
                No linked SPs yet.{' '}
                <Link
                  href="/dashboard/schools/isps"
                  className="font-bold text-[#0077b6] underline"
                >
                  Link a service provider
                </Link>
              </p>
            ) : (
              <>
                <label className="block text-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Service provider
                  </span>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                    value={ispId}
                    onChange={(e) => setIspId(e.target.value)}
                  >
                    {linkedIsps.map((i) => (
                      <option key={i.isp_profile_id} value={i.isp_profile_id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </label>
                <StarSelect
                  label="Overall"
                  value={spOverall}
                  onChange={setSpOverall}
                />
                <div className="grid grid-cols-2 gap-2">
                  <StarSelect
                    label="On-time"
                    value={spOnTime}
                    onChange={setSpOnTime}
                  />
                  <StarSelect
                    label="In-full"
                    value={spInFull}
                    onChange={setSpInFull}
                  />
                  <StarSelect
                    label="Error-free"
                    value={spErrorFree}
                    onChange={setSpErrorFree}
                  />
                  <StarSelect
                    label="Communication"
                    value={spComm}
                    onChange={setSpComm}
                  />
                </div>
                <label className="block text-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Constructive feedback
                  </span>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[80px]"
                    value={spFeedback}
                    onChange={(e) => setSpFeedback(e.target.value)}
                    placeholder="What went well? What should the SP improve next delivery?"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={spRecommend}
                    onChange={(e) => setSpRecommend(e.target.checked)}
                  />
                  Would recommend this SP to other schools
                </label>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveSpRating()}
                  className="btn-primary !py-2.5 !px-4 text-xs w-full inline-flex items-center justify-center gap-1"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save SP rating
                </button>
              </>
            )}
          </div>
          <div className="lg:col-span-3 rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b text-sm font-black">
              Recent SP ratings
            </div>
            {ispRatings.length === 0 ? (
              <p className="px-4 py-10 text-center text-slate-500 text-sm">
                No SP ratings yet.
              </p>
            ) : (
              <ul className="divide-y">
                {ispRatings.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex justify-between gap-2">
                      <p className="font-bold text-sm">
                        {r.isp_name || `SP ${r.isp_profile_id}`}
                      </p>
                      <span className="font-black tabular-nums text-amber-700">
                        {Number(r.overall_rating).toFixed(1)}★
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      OTIFEF: on-time {fmtStar(r.on_time_rating)} · in-full{' '}
                      {fmtStar(r.in_full_rating)} · error-free{' '}
                      {fmtStar(r.error_free_rating)} · comm{' '}
                      {fmtStar(r.communication_rating)}
                    </p>
                    {r.constructive_feedback ? (
                      <p className="text-xs text-slate-700 mt-1.5 flex gap-1.5">
                        <MessageSquarePlus className="w-3.5 h-3.5 shrink-0 text-sky-600 mt-0.5" />
                        {r.constructive_feedback}
                      </p>
                    ) : null}
                    <p className="text-[10px] text-slate-400 mt-1">
                      {r.created_at
                        ? String(r.created_at).slice(0, 16).replace('T', ' ')
                        : ''}
                      {r.would_recommend === true
                        ? ' · recommends'
                        : r.would_recommend === false
                          ? ' · does not recommend'
                          : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-sm font-black inline-flex items-center gap-2">
              <Utensils className="w-4 h-4 text-emerald-600" /> Rate today&apos;s
              food
            </p>
            <p className="text-[11px] text-slate-500">
              Kitchen / coordinator view — score quality and leave constructive
              notes for menu and suppliers.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Date
                </span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={feedDate}
                  onChange={(e) => setFeedDate(e.target.value)}
                />
              </label>
              <label className="text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Meal
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="snack">Snack</option>
                </select>
              </label>
            </div>
            <label className="block text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Recipe / dish (optional)
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                placeholder="e.g. Samp & beans"
              />
            </label>
            <StarSelect
              label="Overall"
              value={foodOverall}
              onChange={setFoodOverall}
            />
            <div className="grid grid-cols-2 gap-2">
              <StarSelect label="Taste" value={taste} onChange={setTaste} />
              <StarSelect
                label="Portion"
                value={portion}
                onChange={setPortion}
              />
              <StarSelect
                label="Appearance"
                value={appearance}
                onChange={setAppearance}
              />
              <StarSelect
                label="Temperature"
                value={temp}
                onChange={setTemp}
              />
              <StarSelect
                label="Menu adherence"
                value={menuAdh}
                onChange={setMenuAdh}
              />
            </div>
            <label className="block text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                What worked well
              </span>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[56px]"
                value={whatWorked}
                onChange={(e) => setWhatWorked(e.target.value)}
                placeholder="Keep doing…"
              />
            </label>
            <label className="block text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                What to improve
              </span>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[56px]"
                value={whatImprove}
                onChange={(e) => setWhatImprove(e.target.value)}
                placeholder="Constructive next steps…"
              />
            </label>
            <label className="block text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Additional constructive feedback
              </span>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[56px]"
                value={foodFeedback}
                onChange={(e) => setFoodFeedback(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveFoodRating()}
              className="btn-primary !py-2.5 !px-4 text-xs w-full inline-flex items-center justify-center gap-1"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save food rating
            </button>
            <p className="text-[10px] text-slate-400">
              Public learner/parent surveys live under{' '}
              <Link
                href="/dashboard/schools/surveys"
                className="font-bold text-[#0077b6] underline"
              >
                Food surveys
              </Link>
              .
            </p>
          </div>
          <div className="lg:col-span-3 rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b text-sm font-black">
              Recent food ratings
            </div>
            {foodRatings.length === 0 ? (
              <p className="px-4 py-10 text-center text-slate-500 text-sm">
                No food ratings yet.
              </p>
            ) : (
              <ul className="divide-y">
                {foodRatings.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex justify-between gap-2">
                      <p className="font-bold text-sm capitalize">
                        {r.meal_type} · {String(r.feed_date).slice(0, 10)}
                        {r.recipe_name ? ` · ${r.recipe_name}` : ''}
                      </p>
                      <span className="font-black tabular-nums text-amber-700">
                        {Number(r.overall_rating).toFixed(1)}★
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Taste {fmtStar(r.taste_rating)} · portion{' '}
                      {fmtStar(r.portion_rating)} · look{' '}
                      {fmtStar(r.appearance_rating)} · temp{' '}
                      {fmtStar(r.temperature_rating)} · menu{' '}
                      {fmtStar(r.menu_adherence_rating)}
                    </p>
                    {r.what_worked ? (
                      <p className="text-xs text-emerald-800 mt-1">
                        <strong>Worked:</strong> {r.what_worked}
                      </p>
                    ) : null}
                    {r.what_to_improve ? (
                      <p className="text-xs text-amber-900 mt-0.5">
                        <strong>Improve:</strong> {r.what_to_improve}
                      </p>
                    ) : null}
                    {r.constructive_feedback ? (
                      <p className="text-xs text-slate-700 mt-1">
                        {r.constructive_feedback}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}

function StarSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs">
      <span className="text-[10px] font-bold uppercase text-slate-400">
        {label}
      </span>
      <select
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {STAR_OPTS.map((s) => (
          <option key={s} value={s}>
            {s} ★
          </option>
        ))}
      </select>
    </label>
  );
}

function fmtStar(v?: number | null) {
  return v != null ? `${Number(v).toFixed(1)}★` : '—';
}
