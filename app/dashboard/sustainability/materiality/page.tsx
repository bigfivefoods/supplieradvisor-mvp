'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { MIGRATION_HINT } from '@/lib/sustainability/types';

type Topic = {
  id: number;
  topic: string;
  pillar?: string;
  impact_score?: number;
  financial_score?: number;
  priority?: string;
  notes?: string | null;
};

const priorityClass: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-900 border-rose-200',
  high: 'bg-amber-100 text-amber-900 border-amber-200',
  medium: 'bg-sky-50 text-sky-800 border-sky-200',
  low: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

export default function MaterialityPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) p.set('privyUserId', privyUserId);
      const res = await fetch(`/api/sustainability/materiality?${p}`);
      const json = await res.json();
      setTopics(json.topics || []);
      setWarning(json.warning || json.hint || null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const seed = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/sustainability/materiality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, action: 'seed' }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || json.hint || 'Seed failed');
        return;
      }
      toast.success(
        json.seeded ? `Seeded ${json.seeded} topics` : json.message || 'Done'
      );
      await load();
    } finally {
      setSeeding(false);
    }
  };

  const updateScore = async (
    id: number,
    field: 'impact_score' | 'financial_score',
    value: number
  ) => {
    await fetch('/api/sustainability/materiality', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id, [field]: value }),
    });
    await load();
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/sustainability"
        backLabel="Sustainability"
        eyebrow="Double materiality lite"
        title="Materiality"
        titleAccent="matrix"
        description="Score each ESG topic on impact materiality (people & planet) and financial materiality (enterprise value). Priorities drive board focus and initiatives."
        action={
          <button
            type="button"
            onClick={() => void seed()}
            disabled={seeding}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            {seeding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Seed standard topics
          </button>
        }
      />

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {warning}
          <span className="mt-1 block font-mono text-xs">{MIGRATION_HINT}</span>
        </div>
      )}

      <Panel className="p-4 mb-4 text-sm text-slate-600">
        <strong className="text-slate-900">How to read:</strong> Impact score =
        severity of effects on society/environment. Financial score = likelihood
        of material effect on cash flows / cost of capital. Priority auto-updates
        from scores (critical when either is maxed or average is high).
      </Panel>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : topics.length === 0 ? (
        <Panel className="p-10 text-center">
          <Sparkles className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="font-semibold">No materiality topics</p>
          <p className="text-sm text-neutral-500 mt-1">
            Seed a GRI/ISSB-inspired set of 14 topics, then score them with your
            leadership team.
          </p>
          <button
            type="button"
            onClick={() => void seed()}
            className="btn-primary !py-2 !px-4 text-sm mt-4"
          >
            Seed topics
          </button>
        </Panel>
      ) : (
        <>
          {/* Simple scatter-style grid legend */}
          <div className="mb-4 overflow-x-auto">
            <div className="inline-grid grid-cols-6 gap-1 min-w-[320px] text-[10px]">
              <div />
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="text-center text-neutral-400 font-bold">
                  F{n}
                </div>
              ))}
              {[5, 4, 3, 2, 1].map((impact) => (
                <div key={`row-${impact}`} className="contents">
                  <div className="text-neutral-400 font-bold flex items-center">
                    I{impact}
                  </div>
                  {[1, 2, 3, 4, 5].map((fin) => {
                    const cell = topics.filter(
                      (t) =>
                        Number(t.impact_score) === impact &&
                        Number(t.financial_score) === fin
                    );
                    const hot = impact >= 4 && fin >= 4;
                    return (
                      <div
                        key={`${impact}-${fin}`}
                        title={cell.map((c) => c.topic).join(', ') || undefined}
                        className={`h-8 rounded-md border flex items-center justify-center font-bold ${
                          hot
                            ? 'bg-rose-100 border-rose-200 text-rose-800'
                            : cell.length
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                              : 'bg-neutral-50 border-neutral-100 text-neutral-300'
                        }`}
                      >
                        {cell.length || ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-neutral-400 mt-1">
              I = impact materiality · F = financial materiality
            </p>
          </div>

          <ul className="bg-white border rounded-3xl divide-y">
            {topics.map((t) => (
              <li
                key={t.id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-0.5">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        priorityClass[t.priority || 'medium'] || priorityClass.medium
                      }`}
                    >
                      {t.priority}
                    </span>
                    <span className="text-[10px] font-semibold text-neutral-500 capitalize">
                      {t.pillar}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-slate-900">
                    {t.topic}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5">
                    <span className="text-neutral-400 font-bold">Impact</span>
                    <select
                      className="input !py-1 !text-xs w-auto"
                      value={t.impact_score ?? 3}
                      onChange={(e) =>
                        void updateScore(
                          t.id,
                          'impact_score',
                          Number(e.target.value)
                        )
                      }
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-neutral-400 font-bold">Financial</span>
                    <select
                      className="input !py-1 !text-xs w-auto"
                      value={t.financial_score ?? 3}
                      onChange={(e) =>
                        void updateScore(
                          t.id,
                          'financial_score',
                          Number(e.target.value)
                        )
                      }
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </RelationshipPage>
  );
}
