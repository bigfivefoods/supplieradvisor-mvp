'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { statusBadgeClass } from '@/lib/hr/types';

type Emp = { id: number; full_name: string };
type Review = {
  id: number;
  employee_id: number;
  period_label?: string;
  review_date?: string;
  overall_score?: number;
  rating?: string;
  status?: string;
  strengths?: string;
};

export default function PerformancePage() {
  const companyId = getSelectedCompanyId()!;
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [ratings, setRatings] = useState<
    Array<{
      id: number;
      employee_id: number;
      overall_score: number;
      rating_label?: string;
      rating_date?: string;
      period_label?: string;
      is_official?: boolean;
      comments?: string;
    }>
  >([]);
  const [form, setForm] = useState({
    employee_id: '',
    period_label: '',
    overall_score: '3',
    rating: 'meets',
    strengths: '',
    improvements: '',
    goals: '',
    quality_score: '3',
    delivery_score: '3',
    teamwork_score: '3',
    leadership_score: '3',
    is_official: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, er, rr] = await Promise.all([
        fetch(`/api/hr/performance?companyId=${companyId}`),
        fetch(`/api/hr/employees?companyId=${companyId}`),
        fetch(`/api/hr/ratings?companyId=${companyId}`),
      ]);
      const pj = await pr.json();
      const ej = await er.json();
      const rj = await rr.json();
      setReviews(pj.reviews || []);
      setRatings(rj.ratings || []);
      setEmployees(
        (ej.employees || []).map((e: Emp) => ({
          id: e.id,
          full_name: e.full_name,
        }))
      );
    } catch {
      /* soft */
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      // Continuous + official rating stamps employee master
      const rateRes = await fetch('/api/hr/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          employee_id: Number(form.employee_id),
          overall_score: Number(form.overall_score),
          rating_label: form.rating,
          period_label: form.period_label || null,
          quality_score: Number(form.quality_score),
          delivery_score: Number(form.delivery_score),
          teamwork_score: Number(form.teamwork_score),
          leadership_score: Number(form.leadership_score),
          comments: [form.strengths, form.improvements, form.goals]
            .filter(Boolean)
            .join('\n'),
          is_official: form.is_official,
        }),
      });
      const rateData = await rateRes.json();
      if (!rateRes.ok) throw new Error(rateData.error || 'Rating failed');

      if (!form.is_official) {
        // formal review record for non-official continuous feedback
        await fetch('/api/hr/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            employee_id: Number(form.employee_id),
            period_label: form.period_label || null,
            overall_score: Number(form.overall_score),
            rating: form.rating,
            strengths: form.strengths,
            improvements: form.improvements,
            goals: form.goals,
            status: 'submitted',
          }),
        });
      }
      toast.success(
        form.is_official
          ? 'Official rating saved on employee record'
          : 'Feedback saved'
      );
      setShow(false);
      void load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const nameOf = (id: number) =>
    employees.find((e) => e.id === id)?.full_name || `#${id}`;

  return (
    <RelationshipPage>
      <RelationshipHeader
        title="Performance"
        titleAccent="ratings"
        description="Official cycle ratings and continuous feedback — quality, delivery, teamwork, leadership. Scores stamp the employee master for the organogram."
        action={
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Rate employee
          </button>
        }
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <h3 className="font-bold text-sm mb-3">Latest ratings</h3>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
            </div>
          ) : ratings.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              No ratings yet.
            </p>
          ) : (
            <ul className="divide-y">
              {ratings.slice(0, 40).map((r) => (
                <li key={r.id} className="py-3 flex justify-between gap-3">
                  <div>
                    <div className="font-semibold">{nameOf(r.employee_id)}</div>
                    <div className="text-xs text-neutral-500">
                      {r.period_label || r.rating_date} ·{' '}
                      <strong className="text-slate-800">
                        {r.overall_score}
                      </strong>{' '}
                      · {r.rating_label || '—'}
                      {r.is_official ? ' · official' : ' · feedback'}
                    </div>
                    {r.comments && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {r.comments}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <h3 className="font-bold text-sm mb-3">Formal reviews</h3>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
            </div>
          ) : reviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              No formal reviews yet.
            </p>
          ) : (
            <ul className="divide-y">
              {reviews.map((r) => (
                <li key={r.id} className="py-3 flex justify-between gap-3">
                  <div>
                    <div className="font-semibold">{nameOf(r.employee_id)}</div>
                    <div className="text-xs text-neutral-500">
                      {r.period_label || r.review_date} · score{' '}
                      {r.overall_score ?? '—'} · {r.rating || '—'}
                    </div>
                    {r.strengths && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {r.strengths}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase h-fit px-2 py-0.5 rounded-full border ${statusBadgeClass(r.status)}`}
                  >
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <form
            onSubmit={submit}
            className="bg-white rounded-3xl w-full max-w-md p-5 space-y-3 shadow-xl"
          >
            <h3 className="font-bold text-lg">Performance review</h3>
            <label className="block text-xs font-semibold">
              Employee
              <select
                required
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={form.employee_id}
                onChange={(e) =>
                  setForm({ ...form, employee_id: e.target.value })
                }
              >
                <option value="">Select…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold">
              Period
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="H1 2026"
                value={form.period_label}
                onChange={(e) =>
                  setForm({ ...form, period_label: e.target.value })
                }
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-semibold">
                Overall (1–5)
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={form.overall_score}
                  onChange={(e) =>
                    setForm({ ...form, overall_score: e.target.value })
                  }
                />
              </label>
              <label className="block text-xs font-semibold">
                Label
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={form.rating}
                  onChange={(e) =>
                    setForm({ ...form, rating: e.target.value })
                  }
                >
                  <option value="exceeds">Exceeds</option>
                  <option value="meets">Meets</option>
                  <option value="developing">Developing</option>
                  <option value="needs_improvement">Needs improvement</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['quality_score', 'Quality'],
                  ['delivery_score', 'Delivery'],
                  ['teamwork_score', 'Teamwork'],
                  ['leadership_score', 'Leadership'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs font-semibold">
                  {label}
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={form.is_official}
                onChange={(e) =>
                  setForm({ ...form, is_official: e.target.checked })
                }
              />
              Official cycle rating (stamps employee master + review)
            </label>
            <label className="block text-xs font-semibold">
              Strengths
              <textarea
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm min-h-[50px]"
                value={form.strengths}
                onChange={(e) =>
                  setForm({ ...form, strengths: e.target.value })
                }
              />
            </label>
            <label className="block text-xs font-semibold">
              Improvements
              <textarea
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm min-h-[50px]"
                value={form.improvements}
                onChange={(e) =>
                  setForm({ ...form, improvements: e.target.value })
                }
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShow(false)}
                className="btn-secondary !py-2 !px-3 text-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary !py-2 !px-4 text-sm">
                Save rating
              </button>
            </div>
          </form>
        </div>
      )}
    </RelationshipPage>
  );
}
