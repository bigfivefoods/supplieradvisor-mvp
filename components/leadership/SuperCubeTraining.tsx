'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Compass,
  Heart,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  IntelligenceHeader,
  IntelligencePage,
} from '@/components/intelligence/IntelligenceShell';
import {
  KpiCard,
  Panel,
  SectionLabel,
} from '@/components/relationship/RelationshipChrome';

export type SuperCubeAudience =
  | 'dashboard'
  | 'sales'
  | 'operator'
  | 'reseller';

export type SuperCubeTrainingProps = {
  /** Where this training is embedded */
  audience?: SuperCubeAudience;
  /** Extra localStorage key suffix (e.g. reseller id) */
  storageScope?: string | null;
  /** Optional company for cloud save */
  companyId?: number | null;
  /** Show Intelligence shell chrome (dashboard only) */
  embedded?: boolean;
};

type Step = 'intro' | 'assessment' | 'results';

type Dimension = {
  key: string;
  name: string;
  short: string;
  color: string;
  soft: string;
  icon: string;
  tagline: string;
  description: string;
  improvesYou: string;
  improvesOthers: string;
  practices: string[];
};

/** Super-Cube face icon — keeps artwork small inside a fixed placeholder. */
function DimIcon({
  icon,
  alt = '',
  size = 'md',
  className = '',
}: {
  icon: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const box =
    size === 'xs'
      ? 'h-7 w-7'
      : size === 'sm'
        ? 'h-8 w-8'
        : size === 'lg'
          ? 'h-12 w-12'
          : 'h-9 w-9';
  const img =
    size === 'xs'
      ? 'h-4 w-4'
      : size === 'sm'
        ? 'h-5 w-5'
        : size === 'lg'
          ? 'h-8 w-8'
          : 'h-6 w-6';
  return (
    <span
      className={`inline-flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/90 ${className}`}
      aria-hidden={alt ? undefined : true}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/images/${icon}`}
        alt={alt}
        width={32}
        height={32}
        className={`${img} object-contain`}
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

const DIMENSIONS: Dimension[] = [
  {
    key: 'choices',
    name: 'Choices',
    short: 'Decide with courage',
    color: '#e74c3c',
    soft: 'rgba(231,76,60,0.08)',
    icon: 'icon-1-context-400x400.png',
    tagline: 'Judgement · values · calculated risk',
    description:
      'Decision-making intelligence: moral clarity, judgement under pressure, and the courage to choose what is right over what is easy.',
    improvesYou:
      'You stop drifting into default decisions. Integrity becomes your operating system — even when no one is watching.',
    improvesOthers:
      'Teams trust your consistency. People around you learn that ethics and results are not opposites.',
    practices: [
      'Before major decisions, write one sentence: “What would the best version of me choose?”',
      'Run a 5-minute pre-mortem: list three ethical risks before you commit.',
      'Own outcomes publicly — success and failure — so ownership becomes culture.',
    ],
  },
  {
    key: 'principles',
    name: 'Principles',
    short: 'Your leadership compass',
    color: '#8e44ad',
    soft: 'rgba(142,68,173,0.08)',
    icon: 'icon-2-context-400x400.png',
    tagline: 'Ethics · context · governance',
    description:
      'Ethical foundations, contextual awareness, and situational judgement — the compass that keeps leadership steady across cultures and pressure.',
    improvesYou:
      'You articulate what you stand for. Ambiguity shrinks; your principles travel with you into every room.',
    improvesOthers:
      'Shared standards replace politics. Colleagues know the rules of the game and raise each other to them.',
    practices: [
      'Draft a one-page personal leadership constitution (5 non-negotiables).',
      'Map how your principles flex by context without breaking core values.',
      'Name one accountability partner who can call you out with love.',
    ],
  },
  {
    key: 'mental',
    name: 'Mental',
    short: 'Think bigger, clearer',
    color: '#f39c12',
    soft: 'rgba(243,156,18,0.10)',
    icon: 'icon-3-context-400x400.png',
    tagline: 'Strategy · learning · vision',
    description:
      'Cognitive intelligence: strategic thinking, creative problem-solving, and the vision that turns complexity into opportunity.',
    improvesYou:
      'You see systems, not just symptoms. Learning becomes a weekly habit, not a yearly event.',
    improvesOthers:
      'You communicate direction so clearly that others can act without waiting for you.',
    practices: [
      'Block 25 minutes weekly for pure strategic thinking — no inbox, no meetings.',
      'After every hard problem, capture one reusable insight in a shared note.',
      'Practise the 30-second vision: can your team retell your direction back to you?',
    ],
  },
  {
    key: 'emotional',
    name: 'Emotional',
    short: 'Lead with human energy',
    color: '#27ae60',
    soft: 'rgba(39,174,96,0.09)',
    icon: 'icon-4-context-400x400.png',
    tagline: 'Empathy · trust · resilience',
    description:
      'Emotional intelligence: self-awareness, empathy, relationship depth, and the motivation that builds trust under stress.',
    improvesYou:
      'You regulate under pressure. Empathy becomes a skill, not a soft label — and burnout loses its grip.',
    improvesOthers:
      'Psychological safety rises. People bring truth early, collaborate harder, and stay longer.',
    practices: [
      'Start one-to-ones with “What is taking energy this week?” before status.',
      'Name your own emotion in hard moments — model regulation, not performance.',
      'Repair quickly: a short apology after friction is high-ROI leadership.',
    ],
  },
  {
    key: 'physical',
    name: 'Physical',
    short: 'Energy is strategy',
    color: '#3498db',
    soft: 'rgba(52,152,219,0.09)',
    icon: 'icon-5-context-400x400.png',
    tagline: 'Health · stamina · recovery',
    description:
      'Health, energy, nutrition, fitness, and recovery — the fuel for sustained world-class leadership when the pace never fully slows.',
    improvesYou:
      'Clarity returns with sleep and movement. You lead from surplus energy, not depletion.',
    improvesOthers:
      'You model sustainable pace. Teams stop treating exhaustion as a badge of honour.',
    practices: [
      'Protect a non-negotiable sleep window and treat it like a board meeting.',
      'Stack movement into the day: walk-and-talks, stretch between deep work blocks.',
      'Share one wellbeing ritual with your team — permission is contagious.',
    ],
  },
  {
    key: 'spiritual',
    name: 'Spiritual',
    short: 'Purpose that multiplies',
    color: '#2c3e50',
    soft: 'rgba(44,62,80,0.08)',
    icon: 'icon-6-context-400x400.png',
    tagline: 'Meaning · authenticity · transcendence',
    description:
      'Purpose, meaning, authenticity, and transcendence — connecting leadership to something greater than the next quarter.',
    improvesYou:
      'Work reconnects to why. Authenticity reduces the tax of performing a role you do not believe in.',
    improvesOthers:
      'People find meaning in the mission with you. Purpose becomes a shared asset, not a poster.',
    practices: [
      'Write a 2-sentence purpose: who you serve and what better future you build.',
      'Book 10 minutes of reflection at week-end — no devices, only questions.',
      'Help one person name their purpose this month; leadership multiplies when you do.',
    ],
  },
];

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

const JOURNEY = [
  {
    n: '01',
    title: 'Understand the cube',
    body: 'Six human-centric faces. One integrated whole. Leadership is not a title — it is how you show up on every face.',
  },
  {
    n: '02',
    title: 'Honest self-assessment',
    body: 'Rate thirty constructs across the six dimensions. No perfect score required — only a truthful starting line.',
  },
  {
    n: '03',
    title: 'See your profile',
    body: 'A spider chart and growth edges reveal where you already lead strongly and where deliberate practice pays most.',
  },
  {
    n: '04',
    title: 'Grow — then multiply',
    body: 'Improve yourself first. Then coach, model, and raise the standard for everyone in your network.',
  },
] as const;

const RIPPLE = [
  {
    icon: Compass,
    title: 'You become clearer',
    body: 'Values, energy, and purpose stop competing. Super-Cube® gives you a language for the whole person who leads.',
  },
  {
    icon: Users,
    title: 'Your team becomes safer',
    body: 'When you model emotional skill, ethical choices, and sustainable pace, psychological safety rises around you.',
  },
  {
    icon: Zap,
    title: 'Your network compounds',
    body: 'On SupplierAdvisor, leadership is not isolated. Stronger principals mean fairer trade, cleaner decisions, and trusted partnerships.',
  },
] as const;

const QUOTES = [
  {
    text: 'The model has potential to engage and influence people across age, education, class and culture… it explores that which comprises moral, effective human functioning, especially in a leadership context.',
    by: 'Vernon Moodley',
    org: 'Kerry Foods',
  },
  {
    text: 'I have learnt about my weaknesses and strengths, and how to grow and improve as a person. The content will help me be a great manager and leader in the future.',
    by: 'Kaveshin Govender',
    org: 'Kerry Foods',
  },
] as const;

const defaultScores = (): Record<string, number[]> => ({
  choices: [5, 5, 5, 5, 5],
  principles: [5, 5, 5, 5, 5],
  mental: [5, 5, 5, 5, 5],
  emotional: [5, 5, 5, 5, 5],
  physical: [5, 5, 5, 5, 5],
  spiritual: [5, 5, 5, 5, 5],
});

function scoreBand(score: number): { label: string; tone: string } {
  if (score >= 9) return { label: 'World-class', tone: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
  if (score >= 7) return { label: 'Strong', tone: 'text-cyan-700 bg-cyan-50 border-cyan-100' };
  if (score >= 5) return { label: 'Developing', tone: 'text-amber-700 bg-amber-50 border-amber-100' };
  return { label: 'Priority growth', tone: 'text-rose-700 bg-rose-50 border-rose-100' };
}

const AUDIENCE_COPY: Record<
  SuperCubeAudience,
  { roleLine: string; why: string; saveLabel: string }
> = {
  dashboard: {
    roleLine: 'Leaders who run the business and the network',
    why: 'Progress saves to your company workspace so leadership sits beside trade and trust.',
    saveLabel: 'Save to company profile',
  },
  sales: {
    roleLine: 'Sales contractors who win with integrity and energy',
    why: 'Build the human skills behind pipeline, trust, and compounding commissions — not just the next quote.',
    saveLabel: 'Save my progress',
  },
  operator: {
    roleLine: 'Container operators who lead the outlet every day',
    why: 'Strong operators lead stock, safety, customers, and contractors with calm judgement under pressure.',
    saveLabel: 'Save my progress',
  },
  reseller: {
    roleLine: 'Resellers who represent the brand in the field',
    why: 'Field leaders who listen, sell ethically, and surface problems early grow the network and themselves.',
    saveLabel: 'Save my progress',
  },
};

export default function SuperCubeTraining({
  audience = 'dashboard',
  storageScope = null,
  companyId: companyIdProp = null,
  embedded = false,
}: SuperCubeTrainingProps) {
  const selectedCompanyId = getSelectedCompanyId();
  const companyId =
    companyIdProp != null
      ? companyIdProp
      : audience === 'dashboard'
        ? selectedCompanyId
        : selectedCompanyId; // sales portal still has company
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const copy = AUDIENCE_COPY[audience];

  const [step, setStep] = useState<Step>('intro');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    choices: true,
  });
  const [activeDim, setActiveDim] = useState<string>('choices');
  const [scores, setScores] = useState<Record<string, number[]>>(defaultScores);
  const [saving, setSaving] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const storageKey = [
    'sa-leadership',
    audience,
    companyId ? String(companyId) : 'user',
    storageScope || '',
    privyUserId || '',
  ]
    .filter(Boolean)
    .join('-');

  const loadSaved = useCallback(async () => {
    setLoadingSaved(true);
    try {
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

  const dimScore = useCallback(
    (key: string) => {
      const q = scores[key] || [];
      return q.length ? Math.round(q.reduce((a, b) => a + b, 0) / q.length) : 0;
    },
    [scores]
  );

  const totalScore = useMemo(
    () => DIMENSIONS.reduce((sum, d) => sum + dimScore(d.key), 0),
    [dimScore]
  );

  const answeredCount = useMemo(() => {
    // Counts dimensions that user has opened and adjusted from pure midpoint — always show progress by questions rated
    return DIMENSIONS.reduce((n, d) => n + (scores[d.key]?.length || 0), 0);
  }, [scores]);

  const weakest = useMemo(() => {
    return [...DIMENSIONS]
      .map((d) => ({ ...d, score: dimScore(d.key) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  }, [dimScore]);

  const strongest = useMemo(() => {
    return [...DIMENSIONS]
      .map((d) => ({ ...d, score: dimScore(d.key) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
  }, [dimScore]);

  const activeDimension = DIMENSIONS.find((d) => d.key === activeDim) || DIMENSIONS[0];

  const updateQuestionScore = (dimension: string, index: number, value: number) => {
    setScores((prev) => {
      const next = [...(prev[dimension] || [])];
      next[index] = value;
      return { ...prev, [dimension]: next };
    });
  };

  const buildProgressPayload = (nextStep?: Step) => {
    const savedAt = new Date().toISOString();
    return {
      scores,
      step: nextStep || step,
      totalScore,
      dimensions: Object.fromEntries(DIMENSIONS.map((d) => [d.key, dimScore(d.key)])),
      dimensionDetail: DIMENSIONS.map((d) => ({
        key: d.key,
        name: d.name,
        score: dimScore(d.key),
        practices: d.practices,
      })),
      model: 'Super-Cube®',
      companyId,
      savedAt,
    };
  };

  const exportReport = () => {
    const progress = buildProgressPayload();
    const blob = new Blob([JSON.stringify(progress, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `super-cube-assessment-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Printable summary window
    const w = window.open('', '_blank');
    if (w) {
      const rows = DIMENSIONS.map(
        (d) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #eee">${d.name}</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700">${dimScore(d.key).toFixed(1)}</td></tr>`
      ).join('');
      w.document.write(`<!DOCTYPE html><html><head><title>Super-Cube® Report</title>
        <style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;color:#0f172a}
        h1{color:#00b4d8} table{width:100%;border-collapse:collapse} .muted{color:#64748b;font-size:13px}</style></head>
        <body>
        <h1>Leadership Super-Cube®</h1>
        <p class="muted">Exported ${progress.savedAt} · Company #${companyId || '—'}</p>
        <p><strong>Overall:</strong> ${totalScore.toFixed(1)} / 10</p>
        <table><thead><tr><th align="left">Dimension</th><th align="left">Score</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <p class="muted" style="margin-top:24px">SupplierAdvisor® — self-assessment for development, not a certification.</p>
        <script>window.onload=()=>window.print()</script>
        </body></html>`);
      w.document.close();
    }
    toast.success('Report exported (JSON + print view)');
  };

  const persist = async (nextStep?: Step) => {
    const progress = buildProgressPayload(nextStep);
    const savedAt = progress.savedAt;
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {
      /* ignore */
    }

    // Operators / resellers: device save only. Sales + dashboard: try company cloud.
    const canCloud =
      Boolean(companyId && privyUserId) &&
      (audience === 'dashboard' || audience === 'sales');

    if (!canCloud) {
      setLastSavedAt(savedAt);
      toast.success('Progress saved on this device');
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
      toast.success(
        audience === 'dashboard'
          ? 'Leadership progress saved to company profile'
          : 'Leadership progress saved'
      );
    } catch (e) {
      toast.message('Saved locally', {
        description: e instanceof Error ? e.message : 'Cloud save unavailable',
      });
      setLastSavedAt(savedAt);
    } finally {
      setSaving(false);
    }
  };

  const shell = (children: JSX.Element) =>
    audience === 'dashboard' && !embedded ? (
      <IntelligencePage>{children}</IntelligencePage>
    ) : (
      <div className="space-y-6">{children}</div>
    );

  if (loadingSaved) {
    return shell(
      <div className="py-20 flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        <p className="text-sm text-neutral-500">Loading your Super-Cube® journey…</p>
      </div>
    );
  }

  return shell(
    <>
      {audience === 'dashboard' && !embedded ? (
        <IntelligenceHeader
          title="Leadership"
          titleAccent="Super-Cube®"
          description={`${copy.roleLine}. Six dimensions. One integrated human model. ${copy.why}`}
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => exportReport()}
                className="btn-secondary !py-2.5 !px-4 text-sm"
              >
                Export report
              </button>
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
            </div>
          }
        />
      ) : (
        <div className="mb-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#0077b6] mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Super-Cube® leadership training
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Leadership that multiplies
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 max-w-2xl leading-relaxed">
            {copy.roleLine}. {copy.why}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportReport()}
              className="btn-secondary !py-2 !px-3.5 text-xs"
            >
              Export report
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void persist()}
              className="btn-primary !py-2 !px-3.5 text-xs inline-flex items-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {copy.saveLabel}
            </button>
          </div>
        </div>
      )}

      {/* Step rail */}
      <div className="flex flex-wrap items-center gap-2 mb-8 -mt-1">
        {(
          [
            { id: 'intro' as Step, label: 'Discover', icon: BookOpen },
            { id: 'assessment' as Step, label: 'Assess', icon: Target },
            { id: 'results' as Step, label: 'Grow', icon: Sparkles },
          ] as const
        ).map((s, i) => {
          const Icon = s.icon;
          const active = step === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full border transition-all ${
                active
                  ? 'border-[#00b4d8] bg-gradient-to-r from-[#00b4d8] to-[#0096c7] text-white shadow-md shadow-cyan-500/20'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/50 hover:text-[#0077b6]'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-black ${
                  active ? 'bg-white/20' : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {i + 1}
              </span>
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
        {lastSavedAt && (
          <span className="text-[11px] text-neutral-400 ml-auto flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Saved {new Date(lastSavedAt).toLocaleString()}
          </span>
        )}
      </div>

      {step === 'intro' && (
        <div className="space-y-10">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-white via-sky-50/80 to-cyan-50 p-8 sm:p-12 lg:p-14">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#00b4d8]/10 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-violet-300/15 blur-3xl"
              aria-hidden
            />
            <div className="relative grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#0077b6] mb-5 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                  Doctoral research · UKZN · Dr. Craig R. Muller
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black tracking-tight text-slate-900 leading-[1.1] mb-4">
                  Lead the whole human.
                  <span className="block text-[#00b4d8]">Raise everyone around you.</span>
                </h2>
                <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mb-6">
                  Super-Cube® is a multidimensional leadership model with{' '}
                  <strong className="text-slate-800">you</strong> at the centre — six faces
                  integrating choices, principles, mental, emotional, physical, and spiritual
                  intelligence. The whole is greater than the sum of its parts.
                </p>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xl mb-8">
                  Research shows leadership is largely developable. This journey turns that science
                  into a practical roadmap: assess honestly, practise deliberately, then multiply
                  growth through your team and trading network.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('assessment')}
                    className="btn-primary !py-3.5 !px-8 text-sm inline-flex items-center gap-2 shadow-lg shadow-cyan-500/25"
                  >
                    Begin self-assessment <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      document
                        .getElementById('six-faces')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="btn-secondary !py-3.5 !px-6 text-sm"
                  >
                    Explore six faces
                  </button>
                </div>
                <p className="text-xs text-neutral-400 mt-4">
                  ~10–15 minutes · honest scores beat perfect ones · {copy.why}
                </p>
              </div>

              <div className="relative flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/supercube-logo-for-home-page.png"
                  alt="Super-Cube® Leadership Model"
                  className="h-24 sm:h-28 w-auto max-w-[min(100%,280px)] object-contain drop-shadow-xl"
                />
                <div className="mt-6 grid grid-cols-3 gap-2 w-full max-w-sm">
                  {DIMENSIONS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => {
                        setActiveDim(d.key);
                        document
                          .getElementById('six-faces')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="rounded-2xl border border-white bg-white/90 p-2.5 text-center shadow-sm hover:border-[#00b4d8]/40 hover:shadow-md transition-all"
                    >
                      <DimIcon icon={d.icon} size="sm" className="mx-auto mb-1" />
                      <div className="text-[10px] font-bold" style={{ color: d.color }}>
                        {d.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Stats strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { k: '6', v: 'Human dimensions', s: 'One integrated cube' },
              { k: '70%+', v: 'Developable', s: 'Leadership can be grown' },
              { k: '30', v: 'Reflection prompts', s: 'Across all six faces' },
              { k: '∞', v: 'Ripple effect', s: 'You → team → network' },
            ].map((item) => (
              <div
                key={item.v}
                className="rounded-3xl border border-neutral-200/80 bg-white px-5 py-5 shadow-sm"
              >
                <div className="text-2xl sm:text-3xl font-black text-[#00b4d8] tracking-tight">
                  {item.k}
                </div>
                <div className="text-sm font-bold text-slate-800 mt-1">{item.v}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{item.s}</div>
              </div>
            ))}
          </div>

          {/* Journey */}
          <div>
            <SectionLabel>Your journey</SectionLabel>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-3">
              {JOURNEY.map((j) => (
                <div
                  key={j.n}
                  className="rounded-3xl border border-neutral-200 bg-white p-6 hover:border-[#00b4d8]/35 transition-colors"
                >
                  <div className="text-xs font-black text-[#00b4d8]/70 tracking-widest mb-3">
                    {j.n}
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mb-2">{j.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{j.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Philosophy + research */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title="Why Super-Cube® exists">
              <div className="px-5 py-5 space-y-3 text-sm text-neutral-600 leading-relaxed">
                <p>
                  Built through doctoral research at the University of KwaZulu-Natal (UKZN) by{' '}
                  <strong className="text-slate-800">Dr. Craig R. Muller</strong>, Super-Cube® was
                  conceived for real business networks — not classroom theory alone.
                </p>
                <p>
                  Traditional models often fragment leadership into silos. Super-Cube® insists that
                  moral choice, ethical principle, cognitive skill, emotional depth, physical
                  energy, and spiritual purpose form <em>one</em> coherent human system.
                </p>
                <p className="text-slate-700 font-medium">
                  “The whole is greater than the sum of its parts.” That philosophy is the
                  foundation — existence, knowledge, values, reason, mind, and language integrated
                  for leadership that changes the world around you.
                </p>
              </div>
            </Panel>
            <Panel title="How it works on SupplierAdvisor">
              <div className="px-5 py-5 space-y-3 text-sm text-neutral-600 leading-relaxed">
                <p>
                  Score each face honestly on a 1–10 scale. Your spider profile highlights strengths
                  and growth edges. We prioritise the three lowest faces first — highest leverage
                  for deliberate practice.
                </p>
                <p>
                  {copy.why} Built for sales, operators, resellers, and company leaders alike.
                </p>
                <ul className="space-y-2 pt-1">
                  {[
                    'Self-assessment with thirty reflection prompts',
                    'Visual spider profile + growth plan',
                    'Weekly practices for yourself and your team',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#00b4d8] shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </div>

          {/* Ripple: you → others */}
          <div>
            <SectionLabel>From self to system</SectionLabel>
            <p className="text-sm text-neutral-500 mb-4 max-w-2xl">
              Super-Cube® is not only about becoming a better leader in private. It is designed so
              your growth becomes permission and pattern for everyone you touch.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {RIPPLE.map((r) => {
                const Icon = r.icon;
                return (
                  <div
                    key={r.title}
                    className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-[#00b4d8]" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">{r.title}</h3>
                    <p className="text-sm text-neutral-500 leading-relaxed">{r.body}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Six faces interactive */}
          <div id="six-faces">
            <SectionLabel>Six faces of Super-Cube®</SectionLabel>
            <p className="text-sm text-neutral-500 mb-4 max-w-2xl">
              Click a dimension to explore how it improves you — and how it lifts the people who
              depend on your leadership.
            </p>
            <div className="grid lg:grid-cols-[280px_1fr] gap-4">
              <div className="space-y-2">
                {DIMENSIONS.map((d) => {
                  const selected = activeDim === d.key;
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setActiveDim(d.key)}
                      className={`w-full flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
                        selected
                          ? 'shadow-md'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                      style={
                        selected
                          ? {
                              backgroundColor: d.soft,
                              borderColor: d.color,
                              boxShadow: `0 0 0 1px ${d.color}33`,
                            }
                          : undefined
                      }
                    >
                      <DimIcon icon={d.icon} size="sm" />
                      <div className="min-w-0">
                        <div className="font-bold text-sm" style={{ color: d.color }}>
                          {d.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 truncate">{d.short}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div
                className="rounded-3xl border bg-white p-6 sm:p-8 shadow-sm"
                style={{ borderColor: `${activeDimension.color}33` }}
              >
                <div className="flex flex-wrap items-start gap-4 mb-5">
                  <DimIcon icon={activeDimension.icon} size="lg" />
                  <div>
                    <h3
                      className="text-2xl font-black tracking-tight"
                      style={{ color: activeDimension.color }}
                    >
                      {activeDimension.name}
                    </h3>
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mt-1">
                      {activeDimension.tagline}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed mb-6">
                  {activeDimension.description}
                </p>
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div
                    className="rounded-2xl p-4 border"
                    style={{
                      backgroundColor: activeDimension.soft,
                      borderColor: `${activeDimension.color}22`,
                    }}
                  >
                    <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500 mb-2 flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5" /> Improves you
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {activeDimension.improvesYou}
                    </p>
                  </div>
                  <div className="rounded-2xl p-4 border border-neutral-100 bg-slate-50/80">
                    <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500 mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Improves those around you
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {activeDimension.improvesOthers}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-neutral-400 mb-2">
                    Practices this week
                  </div>
                  <ul className="space-y-2">
                    {activeDimension.practices.map((p) => (
                      <li
                        key={p}
                        className="flex gap-2.5 text-sm text-neutral-600 leading-relaxed"
                      >
                        <span
                          className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: activeDimension.color }}
                        />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Quotes */}
          <div className="grid md:grid-cols-2 gap-4">
            {QUOTES.map((q) => (
              <blockquote
                key={q.by}
                className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-7 shadow-sm"
              >
                <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed italic mb-4">
                  “{q.text}”
                </p>
                <footer className="text-sm">
                  <span className="font-bold text-slate-800">{q.by}</span>
                  <span className="text-neutral-400"> · {q.org}</span>
                </footer>
              </blockquote>
            ))}
          </div>

          {/* CTA band */}
          <section className="rounded-[2rem] border border-cyan-100 bg-gradient-to-r from-[#00b4d8] to-[#0077b6] p-8 sm:p-10 text-center text-white shadow-lg shadow-cyan-500/20">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">
              Ready to map your leadership profile?
            </h3>
            <p className="text-white/85 max-w-xl mx-auto text-sm sm:text-base mb-6">
              Thirty prompts. Six faces. A clear picture of where you already lead — and where
              deliberate practice will lift you and everyone who follows.
            </p>
            <button
              type="button"
              onClick={() => setStep('assessment')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white text-[#0077b6] font-bold text-sm px-8 py-3.5 hover:bg-cyan-50 transition-colors shadow-md"
            >
              Start assessment <ArrowRight className="w-4 h-4" />
            </button>
          </section>
        </div>
      )}

      {step === 'assessment' && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-white to-sky-50/60 p-6 sm:p-8 text-center">
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight mb-2">
              Honest self-assessment
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto leading-relaxed">
              Rate each statement from <strong className="text-slate-700">1</strong> (rarely true)
              to <strong className="text-slate-700">10</strong> (world-class, consistent). Expand a
              dimension to score all five prompts. There are no wrong answers — only a better
              starting line.
            </p>
            <p className="text-[11px] text-neutral-400 mt-3">
              {answeredCount} prompts · 6 dimensions · mid-point defaults are a starting guess
            </p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {DIMENSIONS.map((d) => {
              const s = dimScore(d.key);
              const band = scoreBand(s);
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => {
                    setOpenSections((prev) => ({ ...prev, [d.key]: true }));
                    document
                      .getElementById(`assess-${d.key}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="rounded-2xl border border-neutral-200 bg-white px-2 py-3 text-center hover:border-[#00b4d8]/40 transition-colors"
                >
                  <DimIcon icon={d.icon} size="xs" className="mx-auto mb-1" />
                  <div className="text-xl font-black tabular-nums" style={{ color: d.color }}>
                    {s}
                  </div>
                  <div className="text-[9px] font-bold uppercase text-neutral-400 mt-0.5">
                    {d.name}
                  </div>
                  <div
                    className={`mt-1.5 text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-full border inline-block ${band.tone}`}
                  >
                    {band.label}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {DIMENSIONS.map((dim) => {
              const isOpen = openSections[dim.key] || false;
              const avg = dimScore(dim.key);
              return (
                <div
                  id={`assess-${dim.key}`}
                  key={dim.key}
                  className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm scroll-mt-24"
                  style={{ borderLeftWidth: 4, borderLeftColor: dim.color }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSections((prev) => ({ ...prev, [dim.key]: !prev[dim.key] }))
                    }
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-neutral-50/80 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <DimIcon icon={dim.icon} size="md" />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800">{dim.name}</div>
                        <div className="text-xs text-neutral-500 line-clamp-1">
                          {dim.tagline} · {dim.short}
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
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        {dim.description}
                      </p>
                      {QUESTIONS[dim.key].map((q, i) => (
                        <div key={i} className="flex flex-col gap-2">
                          <div className="flex items-start gap-2">
                            <span
                              className="mt-0.5 text-[10px] font-black tabular-nums w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-white"
                              style={{ backgroundColor: dim.color }}
                            >
                              {i + 1}
                            </span>
                            <div className="flex-1 text-sm text-neutral-700 leading-snug">{q}</div>
                          </div>
                          <div className="flex items-center gap-3 pl-7">
                            <span className="text-[10px] font-semibold text-neutral-400 w-6">
                              Low
                            </span>
                            <input
                              type="range"
                              min={1}
                              max={10}
                              value={scores[dim.key]?.[i] ?? 5}
                              onChange={(e) =>
                                updateQuestionScore(dim.key, i, Number(e.target.value))
                              }
                              className="flex-1 accent-[#00b4d8] h-2"
                            />
                            <span className="text-[10px] font-semibold text-neutral-400 w-8">
                              High
                            </span>
                            <span
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black tabular-nums text-white shadow-sm"
                              style={{ backgroundColor: dim.color }}
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

          <div className="flex flex-wrap justify-center gap-3 pt-2 pb-4">
            <button
              type="button"
              onClick={() => setStep('intro')}
              className="btn-secondary !py-2.5 !px-6 text-sm"
            >
              Back to discover
            </button>
            <button
              type="button"
              onClick={() => {
                void persist('results');
                setStep('results');
              }}
              className="btn-primary !py-2.5 !px-7 text-sm inline-flex items-center gap-2 shadow-md shadow-cyan-500/20"
            >
              <Sparkles className="w-4 h-4" /> View results & growth plan
            </button>
          </div>
        </div>
      )}

      {step === 'results' && (
        <div className="space-y-8">
          <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50/50 to-white p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#00b4d8] mb-1">
                  Your Super-Cube® profile
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                  Strengths to multiply. Edges to grow.
                </h2>
                <p className="text-sm text-neutral-500 mt-1 max-w-lg">
                  Total score is a compass, not a verdict. Focus practice on the lowest faces —
                  then reassess as you lead.
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black tabular-nums text-[#00b4d8]">
                  {totalScore}
                  <span className="text-lg text-neutral-400 font-bold">/60</span>
                </div>
                <div className="text-xs text-neutral-400 font-semibold uppercase tracking-wide">
                  Combined index
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <KpiCard
                icon={Target}
                label="Total score"
                value={`${totalScore}/60`}
                tone="cyan"
              />
              <KpiCard
                icon={Sparkles}
                label="Strongest face"
                value={strongest[0]?.name || '—'}
                sub={`Score ${strongest[0]?.score ?? '—'} · multiply this`}
                tone="emerald"
              />
              <KpiCard
                icon={RefreshCw}
                label="Primary growth edge"
                value={weakest[0]?.name || '—'}
                sub={`Score ${weakest[0]?.score ?? '—'} · practise first`}
                tone="amber"
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title="Spider profile">
              <div className="p-4 sm:p-6 flex justify-center">
                <svg
                  width="420"
                  height="420"
                  viewBox="0 0 600 600"
                  className="max-w-full h-auto"
                  role="img"
                  aria-label="Super-Cube spider profile"
                >
                  {/* grid rings */}
                  {[0.33, 0.66, 1].map((scale) => (
                    <polygon
                      key={scale}
                      points={DIMENSIONS.map((_, i) => {
                        const angle = ((i * 60 - 90) * Math.PI) / 180;
                        const x = 300 + 200 * scale * Math.cos(angle);
                        const y = 300 + 200 * scale * Math.sin(angle);
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="2"
                    />
                  ))}
                  <polygon
                    points={DIMENSIONS.map((_, i) => {
                      const angle = ((i * 60 - 90) * Math.PI) / 180;
                      const x = 300 + 200 * Math.cos(angle);
                      const y = 300 + 200 * Math.sin(angle);
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="#f8fafc"
                    fillOpacity="0.6"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                  />
                  {DIMENSIONS.map((dim, i) => {
                    const angle = ((i * 60 - 90) * Math.PI) / 180;
                    const x = 300 + 200 * Math.cos(angle);
                    const y = 300 + 200 * Math.sin(angle);
                    return (
                      <line
                        key={dim.key}
                        x1="300"
                        y1="300"
                        x2={x}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeWidth="2"
                      />
                    );
                  })}
                  <polygon
                    points={DIMENSIONS.map((dim, i) => {
                      const angle = ((i * 60 - 90) * Math.PI) / 180;
                      const score = dimScore(dim.key) / 10;
                      const x = 300 + 180 * score * Math.cos(angle);
                      const y = 300 + 180 * score * Math.sin(angle);
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="#00b4d8"
                    fillOpacity="0.22"
                    stroke="#00b4d8"
                    strokeWidth="5"
                    strokeLinejoin="round"
                  />
                  {DIMENSIONS.map((dim, i) => {
                    const angle = ((i * 60 - 90) * Math.PI) / 180;
                    const score = dimScore(dim.key) / 10;
                    const px = 300 + 180 * score * Math.cos(angle);
                    const py = 300 + 180 * score * Math.sin(angle);
                    const lx = 300 + 235 * Math.cos(angle);
                    const ly = 300 + 235 * Math.sin(angle);
                    return (
                      <g key={dim.key}>
                        <circle cx={px} cy={py} r="7" fill={dim.color} stroke="#fff" strokeWidth="2" />
                        <text
                          x={lx}
                          y={ly}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={dim.color}
                          fontSize="15"
                          fontWeight="700"
                        >
                          {dim.name}
                        </text>
                        <text
                          x={lx}
                          y={ly + 16}
                          textAnchor="middle"
                          fill="#94a3b8"
                          fontSize="12"
                          fontWeight="600"
                        >
                          {dimScore(dim.key)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel title="All six faces">
                <div className="p-4 space-y-3">
                  {DIMENSIONS.map((d) => {
                    const s = dimScore(d.key);
                    const band = scoreBand(s);
                    return (
                      <div key={d.key} className="flex items-center gap-3">
                        <DimIcon icon={d.icon} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-bold text-slate-800">{d.name}</span>
                            <span className="text-sm font-black tabular-nums" style={{ color: d.color }}>
                              {s}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${s * 10}%`,
                                backgroundColor: d.color,
                              }}
                            />
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border shrink-0 ${band.tone}`}
                        >
                          {band.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
          </div>

          <div>
            <SectionLabel>Focus plan — lowest three faces</SectionLabel>
            <p className="text-sm text-neutral-500 mb-4 max-w-2xl">
              Deliberate practice here creates the largest leadership lift. Improve yourself first;
              then coach one person on the same face this month.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {weakest.map((rec, idx) => (
                <div
                  key={rec.key}
                  className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm flex flex-col"
                  style={{ borderTopWidth: 4, borderTopColor: rec.color }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                      Priority {idx + 1}
                    </span>
                    <span
                      className="text-3xl font-black tabular-nums"
                      style={{ color: rec.color }}
                    >
                      {rec.score}
                    </span>
                  </div>
                  <DimIcon icon={rec.icon} size="lg" className="mb-3" />
                  <h4 className="font-bold text-lg" style={{ color: rec.color }}>
                    {rec.name}
                  </h4>
                  <p className="text-xs text-neutral-500 mt-1 mb-4 leading-relaxed">
                    {rec.short}. {rec.improvesYou}
                  </p>
                  <div className="mt-auto space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                      Start this week
                    </div>
                    {rec.practices.slice(0, 2).map((p) => (
                      <p
                        key={p}
                        className="text-xs text-slate-600 leading-relaxed flex gap-2"
                      >
                        <CheckCircle2
                          className="w-3.5 h-3.5 shrink-0 mt-0.5"
                          style={{ color: rec.color }}
                        />
                        {p}
                      </p>
                    ))}
                    <p className="text-xs text-neutral-500 pt-2 border-t border-neutral-100 leading-relaxed">
                      <Users className="w-3 h-3 inline mr-1 text-neutral-400" />
                      {rec.improvesOthers}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {strongest[0] && (
            <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-6 sm:p-8">
              <div className="flex flex-wrap items-start gap-4">
                <DimIcon icon={strongest[0].icon} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600 mb-1">
                    Multiply your strength
                  </p>
                  <h3 className="text-xl font-black text-slate-800 mb-2">
                    {strongest[0].name} is already working for you
                  </h3>
                  <p className="text-sm text-neutral-600 leading-relaxed max-w-2xl">
                    Do not ignore strengths while you grow weak faces. Use {strongest[0].name.toLowerCase()}{' '}
                    to mentor someone this month — teaching embeds mastery and raises the standard
                    for your whole network.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 sm:p-8">
            <h3 className="font-black text-lg text-slate-800 mb-2">
              Leadership that compounds on SupplierAdvisor
            </h3>
            <p className="text-sm text-neutral-500 leading-relaxed max-w-3xl mb-4">
              Super-Cube® sits with your day-to-day work so development is never detached from real
              trade, outlets, and customer relationships. Stronger leaders build fairer networks,
              safer outlets, and decisions that serve people — not only the next transaction.
            </p>
            <div className="flex flex-wrap gap-3">
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
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {copy.saveLabel}
              </button>
              <button
                type="button"
                onClick={() => setStep('intro')}
                className="btn-secondary !py-2.5 !px-6 text-sm"
              >
                Revisit the model
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
