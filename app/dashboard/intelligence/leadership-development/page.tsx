'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  Save,
  Sparkles,
  Target,
  RefreshCw,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  IntelligenceHeader,
  IntelligencePage,
} from '@/components/intelligence/IntelligenceShell';
import {
  KpiCard,
  Panel,
  SectionLabel,
} from '@/components/relationship/RelationshipChrome';

type Step = 'intro' | 'assessment' | 'results';

const DIMENSIONS = [
  {
    key: 'choices',
    name: 'Choices',
    color: '#e74c3c',
    icon: 'icon-1-context-400x400.png',
    description:
      'Decision-making intelligence, moral values, judgement, and risk-taking. Choose what is right over what is easy.',
  },
  {
    key: 'principles',
    name: 'Principles',
    color: '#8e44ad',
    icon: 'icon-2-context-400x400.png',
    description:
      'Ethical foundations, contextual awareness, situational judgement, and governance — your leadership compass.',
  },
  {
    key: 'mental',
    name: 'Mental',
    color: '#f39c12',
    icon: 'icon-3-context-400x400.png',
    description:
      'Cognitive intelligence, strategic thinking, problem-solving, and vision that turns complexity into opportunity.',
  },
  {
    key: 'emotional',
    name: 'Emotional',
    color: '#27ae60',
    icon: 'icon-4-context-400x400.png',
    description:
      'Emotional intelligence, empathy, relationships, and motivation that build trust and resilience.',
  },
  {
    key: 'physical',
    name: 'Physical',
    color: '#3498db',
    icon: 'icon-5-context-400x400.png',
    description:
      'Health, energy, fitness, nutrition, and resilience — the fuel for sustained world-class leadership.',
  },
  {
    key: 'spiritual',
    name: 'Spiritual',
    color: '#2c3e50',
    icon: 'icon-6-context-400x400.png',
    description:
      'Purpose, meaning, authenticity, and transcendence — connecting leadership to something greater.',
  },
] as const;

const QUESTIONS: Record<string, string[]> = {
  choices: [
    'I make decisions based on clear personal values and long-term impact.',
    'I am comfortable taking calculated risks when the reward aligns with my principles.',
    'I consistently choose integrity over convenience, even when no one is watching.',
    'I evaluate the ethical implications of my choices before acting.',
    'I take full ownership of the consequences of my decisions.',
  ],
  principles: [
    'I live by a consistent set of ethical principles in all situations.',
    'I adapt my principles thoughtfully to different cultural and contextual realities.',
    'I can clearly articulate my core leadership principles to others.',
    'My principles guide me even when they conflict with short-term gains.',
    'I hold myself and others accountable to shared ethical standards.',
  ],
  mental: [
    'I think strategically and see the bigger picture in complex situations.',
    'I solve problems creatively and find innovative solutions.',
    'I learn quickly and continuously update my knowledge and skills.',
    'I analyse situations objectively before forming conclusions.',
    'I create clear visions and communicate them effectively.',
  ],
  emotional: [
    'I understand and manage my own emotions effectively.',
    'I show genuine empathy and emotional intelligence with others.',
    'I build strong, trusting relationships with my team.',
    'I remain calm and constructive under pressure.',
    'I inspire and motivate others through emotional connection.',
  ],
  physical: [
    'I maintain high levels of energy and physical wellbeing.',
    'I manage my time and energy to avoid burnout.',
    'I prioritise sleep, nutrition, and regular exercise.',
    'I recover quickly from setbacks and stress.',
    'I model healthy work-life balance for my team.',
  ],
  spiritual: [
    'I have a clear sense of purpose and meaning in my leadership.',
    'I connect my work to something greater than myself.',
    'I practise mindfulness or reflection regularly.',
    'I lead with authenticity and inner alignment.',
    'I help others discover their own sense of purpose.',
  ],
};

const defaultScores = (): Record<string, number[]> => ({
  choices: [7, 7, 7, 7, 7],
  principles: [7, 7, 7, 7, 7],
  mental: [7, 7, 7, 7, 7],
  emotional: [7, 7, 7, 7, 7],
  physical: [7, 7, 7, 7, 7],
  spiritual: [7, 7, 7, 7, 7],
});

export default function LeadershipDevelopmentPage() {
  return (
    <CompanyRequired>
      <LeadershipInner />
    </CompanyRequired>
  );
}

function LeadershipInner() {
  const companyId = getSelectedCompanyId();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [step, setStep] = useState<Step>('intro');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [scores, setScores] = useState<Record<string, number[]>>(defaultScores);
  const [saving, setSaving] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const storageKey = companyId ? `sa-leadership-${companyId}` : 'sa-leadership';

  const loadSaved = useCallback(async () => {
    setLoadingSaved(true);
    try {
      // local first
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            scores?: Record<string, number[]>;
            step?: Step;
            savedAt?: string;
          };
          if (parsed.scores) setScores(parsed.scores);
          if (parsed.step) setStep(parsed.step);
          if (parsed.savedAt) setLastSavedAt(parsed.savedAt);
        }
      } catch {
        /* ignore */
      }

      if (companyId && privyUserId) {
        const res = await fetch(
          `/api/intelligence/leadership?companyId=${companyId}&privyUserId=${encodeURIComponent(privyUserId)}`
        );
        const data = await res.json();
        if (res.ok && data.progress && typeof data.progress === 'object') {
          const prog = data.progress as {
            scores?: Record<string, number[]>;
            step?: Step;
            savedAt?: string;
          };
          if (prog.scores) setScores(prog.scores);
          if (prog.step) setStep(prog.step);
          if (prog.savedAt) setLastSavedAt(prog.savedAt);
        }
      }
    } finally {
      setLoadingSaved(false);
    }
  }, [companyId, privyUserId, storageKey]);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const dimScore = (key: string) => {
    const q = scores[key] || [];
    return q.length ? Math.round(q.reduce((a, b) => a + b, 0) / q.length) : 0;
  };

  const totalScore = useMemo(
    () => DIMENSIONS.reduce((sum, d) => sum + dimScore(d.key), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scores]
  );

  const weakest = useMemo(() => {
    return [...DIMENSIONS]
      .map((d) => ({ ...d, score: dimScore(d.key) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores]);

  const strongest = useMemo(() => {
    return [...DIMENSIONS]
      .map((d) => ({ ...d, score: dimScore(d.key) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores]);

  const updateQuestionScore = (dimension: string, index: number, value: number) => {
    setScores((prev) => {
      const next = [...(prev[dimension] || [])];
      next[index] = value;
      return { ...prev, [dimension]: next };
    });
  };

  const persist = async (nextStep?: Step) => {
    const savedAt = new Date().toISOString();
    const progress = {
      scores,
      step: nextStep || step,
      totalScore,
      dimensions: Object.fromEntries(
        DIMENSIONS.map((d) => [d.key, dimScore(d.key)])
      ),
      savedAt,
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {
      /* ignore */
    }

    if (!companyId || !privyUserId) {
      setLastSavedAt(savedAt);
      toast.success('Saved on this device');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/intelligence/leadership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, progress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setLastSavedAt(savedAt);
      toast.success('Leadership progress saved to company profile');
    } catch (e) {
      toast.message('Saved locally', {
        description: e instanceof Error ? e.message : 'Cloud save unavailable',
      });
      setLastSavedAt(savedAt);
    } finally {
      setSaving(false);
    }
  };

  if (loadingSaved) {
    return (
      <IntelligencePage>
        <div className="py-28 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </IntelligencePage>
    );
  }

  return (
    <IntelligencePage>
      <IntelligenceHeader
        title="Leadership"
        titleAccent="Super-Cube®"
        description="Human-centric leadership development — six dimensions, self-assessment, spider profile, and growth plan. Progress saves to your company workspace."
        action={
          <button
            type="button"
            disabled={saving}
            onClick={() => void persist()}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" /> Save progress
              </>
            )}
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-6 -mt-2">
        {(['intro', 'assessment', 'results'] as Step[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-all ${
              step === s
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40'
            }`}
          >
            {s === 'intro' ? 'Overview' : s === 'assessment' ? 'Assessment' : 'Results'}
          </button>
        ))}
        {lastSavedAt && (
          <span className="text-[11px] text-neutral-400 ml-auto">
            Saved {new Date(lastSavedAt).toLocaleString()}
          </span>
        )}
      </div>

      {step === 'intro' && (
        <div className="space-y-8">
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 sm:p-10 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/supercube-logo-for-home-page.png"
              alt="Super-Cube®"
              className="h-20 mx-auto mb-6"
            />
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-[#00b4d8] mb-3">
              Super-Cube®
            </h2>
            <p className="text-neutral-600 max-w-2xl mx-auto leading-relaxed">
              Multidimensional leadership with <strong className="text-slate-800">you</strong> at
              the centre — six faces integrating cognitive, emotional, physical, spiritual, ethical,
              and decision-making intelligence.
            </p>
            <button
              type="button"
              onClick={() => setStep('assessment')}
              className="btn-primary !py-3 !px-8 text-sm mt-8 inline-flex items-center gap-2"
            >
              Begin self-assessment <ChevronRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-neutral-400 mt-3">
              10–15 minutes · scores save to your company profile
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Panel title="Why it exists">
              <p className="px-5 py-5 text-sm text-neutral-600 leading-relaxed">
                Built through doctoral research at UKZN (2020), Super-Cube® closes the leadership
                development gap with a practical, evidence-based roadmap. Leadership is 70–76%
                developable — this framework structures that growth for organisations and
                communities.
              </p>
            </Panel>
            <Panel title="How it works">
              <p className="px-5 py-5 text-sm text-neutral-600 leading-relaxed">
                Assess six dimensions on a 1–10 scale. Your spider profile highlights strengths and
                growth edges. Recommendations focus on the three lowest faces first for maximum
                leverage — then reassess as you lead across CRM, SRM, and the network.
              </p>
            </Panel>
          </div>

          <SectionLabel>Six dimensions</SectionLabel>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DIMENSIONS.map((dim) => (
              <div
                key={dim.key}
                className="rounded-3xl border border-neutral-200 bg-white p-5 hover:border-[#00b4d8]/40 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/images/${dim.icon}`}
                  alt={dim.name}
                  className="w-14 h-14 object-contain mb-3"
                />
                <h3 className="font-bold text-lg" style={{ color: dim.color }}>
                  {dim.name}
                </h3>
                <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                  {dim.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'assessment' && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="text-center mb-2">
            <p className="text-sm text-neutral-500">
              Rate each construct 1–10 (10 = world-class). Expand a dimension to score all five
              statements.
            </p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
            {DIMENSIONS.map((d) => (
              <div
                key={d.key}
                className="rounded-2xl border border-neutral-200 bg-white px-2 py-3 text-center"
              >
                <div className="text-xl font-black tabular-nums" style={{ color: d.color }}>
                  {dimScore(d.key)}
                </div>
                <div className="text-[9px] font-bold uppercase text-neutral-400 mt-0.5">
                  {d.name}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {DIMENSIONS.map((dim) => {
              const isOpen = openSections[dim.key] || false;
              const avg = dimScore(dim.key);
              return (
                <div
                  key={dim.key}
                  className="bg-white rounded-3xl border border-neutral-200 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSections((prev) => ({ ...prev, [dim.key]: !prev[dim.key] }))
                    }
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-neutral-50 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/images/${dim.icon}`}
                        alt=""
                        className="w-10 h-10 object-contain shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800">{dim.name}</div>
                        <div className="text-xs text-neutral-500 line-clamp-1">
                          {dim.description}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className="text-2xl font-black tabular-nums"
                        style={{ color: dim.color }}
                      >
                        {avg}
                      </span>
                      {isOpen ? (
                        <ChevronDown className="w-5 h-5 text-neutral-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-neutral-400" />
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 space-y-5 border-t border-neutral-100 pt-4">
                      {QUESTIONS[dim.key].map((q, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1 text-sm text-neutral-700">{q}</div>
                          <div className="flex items-center gap-3 shrink-0">
                            <input
                              type="range"
                              min={1}
                              max={10}
                              value={scores[dim.key]?.[i] ?? 5}
                              onChange={(e) =>
                                updateQuestionScore(dim.key, i, Number(e.target.value))
                              }
                              className="w-36 accent-[#00b4d8]"
                            />
                            <span
                              className="w-7 text-right font-bold tabular-nums"
                              style={{ color: dim.color }}
                            >
                              {scores[dim.key]?.[i] ?? 5}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => setStep('intro')}
              className="btn-secondary !py-2.5 !px-6 text-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                void persist('results');
                setStep('results');
              }}
              className="btn-primary !py-2.5 !px-6 text-sm inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> View results & profile
            </button>
          </div>
        </div>
      )}

      {step === 'results' && (
        <div className="space-y-8">
          <div className="grid sm:grid-cols-3 gap-3">
            <KpiCard
              icon={Target}
              label="Total score"
              value={`${totalScore}/60`}
              tone="cyan"
            />
            <KpiCard
              icon={Sparkles}
              label="Strongest"
              value={strongest[0]?.name || '—'}
              sub={`Score ${strongest[0]?.score ?? '—'}`}
              tone="emerald"
            />
            <KpiCard
              icon={RefreshCw}
              label="Growth edge"
              value={weakest[0]?.name || '—'}
              sub={`Score ${weakest[0]?.score ?? '—'}`}
              tone="amber"
            />
          </div>

          <Panel title="Spider profile">
            <div className="p-6 flex justify-center">
              <svg width="420" height="420" viewBox="0 0 600 600" className="max-w-full">
                <polygon
                  points="300,100 500,200 500,400 300,500 100,400 100,200"
                  fill="#f8fafc"
                  stroke="#e2e8f0"
                  strokeWidth="40"
                />
                {DIMENSIONS.map((dim, i) => {
                  const angle = (i * 60 * Math.PI) / 180;
                  const x = 300 + 200 * Math.cos(angle);
                  const y = 300 + 200 * Math.sin(angle);
                  return (
                    <line
                      key={dim.key}
                      x1="300"
                      y1="300"
                      x2={x}
                      y2={y}
                      stroke="#cbd5e1"
                      strokeWidth="2"
                    />
                  );
                })}
                <polygon
                  points={DIMENSIONS.map((dim, i) => {
                    const angle = (i * 60 * Math.PI) / 180;
                    const score = dimScore(dim.key) / 10;
                    const x = 300 + 180 * score * Math.cos(angle);
                    const y = 300 + 180 * score * Math.sin(angle);
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="#00b4d8"
                  fillOpacity="0.2"
                  stroke="#00b4d8"
                  strokeWidth="6"
                  strokeLinejoin="round"
                />
                {DIMENSIONS.map((dim, i) => {
                  const angle = (i * 60 * Math.PI) / 180;
                  const x = 300 + 235 * Math.cos(angle);
                  const y = 300 + 235 * Math.sin(angle);
                  return (
                    <text
                      key={dim.key}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      fill={dim.color}
                      fontSize="16"
                      fontWeight="700"
                    >
                      {dim.name}
                    </text>
                  );
                })}
              </svg>
            </div>
          </Panel>

          <SectionLabel>Focus areas (lowest three)</SectionLabel>
          <div className="grid md:grid-cols-3 gap-4">
            {weakest.map((rec) => (
              <div
                key={rec.key}
                className="rounded-3xl border border-neutral-200 bg-white p-6 text-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/images/${rec.icon}`}
                  alt=""
                  className="w-14 h-14 mx-auto mb-3 object-contain"
                />
                <h4 className="font-bold text-lg" style={{ color: rec.color }}>
                  {rec.name}
                </h4>
                <div className="text-3xl font-black tabular-nums mt-1" style={{ color: rec.color }}>
                  {rec.score}
                </div>
                <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                  Prioritise deliberate practice here for the largest leadership lift.
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => setStep('assessment')}
              className="btn-secondary !py-2.5 !px-6 text-sm"
            >
              Adjust scores
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void persist('results')}
              className="btn-primary !py-2.5 !px-6 text-sm inline-flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save to company profile
            </button>
          </div>
        </div>
      )}
    </IntelligencePage>
  );
}
