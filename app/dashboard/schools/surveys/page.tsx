'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type Survey = {
  id: number;
  title: string;
  audience: string;
  meal_type?: string;
  active: boolean;
  public_token: string;
  response_count?: number;
  avg_rating?: number | null;
  created_at?: string;
};

type ResponseRow = {
  id: number;
  rating: number;
  taste?: number | null;
  portion?: number | null;
  cleanliness?: number | null;
  variety?: number | null;
  comment?: string | null;
  respondent_role?: string | null;
  grade?: string | null;
  meal_date?: string | null;
  created_at?: string;
};

export default function SchoolSurveysPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    responses: 0,
    avgRating: null as number | null,
  });
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('How was your school meal today?');
  const [audience, setAudience] = useState('learner');
  const [selected, setSelected] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/surveys?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSurveys(data.surveys || []);
      setSummary(
        data.summary || { total: 0, active: 0, responses: 0, avgRating: null }
      );
      if (data.warning) toast.message(data.warning);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/schools/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, title, audience, meal_type: 'lunch' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      toast.success('Survey live — share the link with learners & parents');
      void load();
      if (data.survey) void openDetail(data.survey);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (s: Survey) => {
    setSelected(s);
    setLoadingDetail(true);
    try {
      const res = await fetch(
        `/api/schools/surveys?companyId=${companyId}&id=${s.id}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSelected(data.survey);
      setResponses(data.responses || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleActive = async (s: Survey) => {
    try {
      const res = await fetch('/api/schools/surveys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          id: s.id,
          active: !s.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(s.active ? 'Survey paused' : 'Survey active');
      void load();
      if (selected?.id === s.id) setSelected(data.survey);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const publicUrl = (token: string) => {
    if (typeof window === 'undefined') return `/s/food/${token}`;
    return `${window.location.origin}/s/food/${token}`;
  };

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(publicUrl(token));
      toast.success('Link copied — paste into WhatsApp or print a QR');
    } catch {
      toast.message(publicUrl(token));
    }
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Food surveys"
        titleAccent="Voice"
        description="One-tap meal feedback from learners, parents & staff. Share a link or QR — results help you improve quality every day."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {[
          { label: 'Surveys', value: summary.total },
          { label: 'Active', value: summary.active },
          { label: 'Responses', value: summary.responses },
          {
            label: 'Avg rating',
            value:
              summary.avgRating != null
                ? `${Number(summary.avgRating).toFixed(1)}★`
                : '—',
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {k.label}
            </p>
            <p className="text-xl font-black text-slate-900 tabular-nums">
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50 to-white p-5 mb-6">
        <h2 className="font-black text-slate-900 text-sm mb-3">
          Launch a survey in 10 seconds
        </h2>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Survey title"
          />
          <select
            className="input !w-full sm:!w-36"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            <option value="learner">Learners</option>
            <option value="parent">Parents</option>
            <option value="staff">Staff</option>
            <option value="visitor">Visitors</option>
          </select>
          <button
            type="button"
            disabled={creating}
            onClick={() => void create()}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center justify-center gap-2"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Go live
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : surveys.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <Users className="w-8 h-8 text-[#00b4d8] mx-auto mb-2" />
          <p className="font-bold">No surveys yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Create one above and share the link at the serving line.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <ul className="space-y-2">
            {surveys.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => void openDetail(s)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    selected?.id === s.id
                      ? 'border-[#00b4d8] bg-sky-50/50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-[#00b4d8]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        {s.title}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 capitalize">
                        {s.audience} · {s.meal_type || 'lunch'} ·{' '}
                        {s.active ? (
                          <span className="text-emerald-600 font-bold">
                            Live
                          </span>
                        ) : (
                          <span className="text-slate-400">Paused</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black tabular-nums text-slate-900">
                        {s.response_count ?? 0}
                      </p>
                      <p className="text-[10px] text-slate-400">responses</p>
                      {s.avg_rating != null ? (
                        <p className="text-xs font-bold text-amber-600 inline-flex items-center gap-0.5 mt-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {Number(s.avg_rating).toFixed(1)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 min-h-[280px]">
            {!selected ? (
              <p className="text-sm text-slate-500 text-center py-12">
                Select a survey to share the link and see feedback.
              </p>
            ) : loadingDetail ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="font-black text-slate-900">{selected.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Share this link at the kitchen door or send to parents
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLink(selected.public_token)}
                    className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy link
                  </button>
                  <a
                    href={publicUrl(selected.public_token)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open form
                  </a>
                  <button
                    type="button"
                    onClick={() => void toggleActive(selected)}
                    className="btn-secondary !py-2 !px-3 text-xs"
                  >
                    {selected.active ? 'Pause' : 'Activate'}
                  </button>
                </div>
                <code className="block text-[11px] bg-slate-50 rounded-xl px-3 py-2 break-all text-slate-600 border border-slate-100">
                  {publicUrl(selected.public_token)}
                </code>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Latest feedback
                  </h4>
                  {responses.length === 0 ? (
                    <p className="text-sm text-slate-500">No responses yet.</p>
                  ) : (
                    <ul className="space-y-2 max-h-72 overflow-y-auto">
                      {responses.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-amber-600 tabular-nums">
                              {r.rating}★
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {[r.respondent_role, r.grade, r.meal_date]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </div>
                          {r.comment ? (
                            <p className="text-xs text-slate-700 mt-1">
                              “{r.comment}”
                            </p>
                          ) : null}
                          <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-slate-500">
                            {r.taste != null ? <span>Taste {r.taste}</span> : null}
                            {r.portion != null ? (
                              <span>Portion {r.portion}</span>
                            ) : null}
                            {r.cleanliness != null ? (
                              <span>Clean {r.cleanliness}</span>
                            ) : null}
                            {r.variety != null ? (
                              <span>Variety {r.variety}</span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: white;
        }
      `}</style>
    </SchoolsPage>
  );
}
