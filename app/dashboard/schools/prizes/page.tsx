'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trophy,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type Criterion = {
  id: string;
  label: string;
  weight: number;
  how: string;
  tip: string;
};

export default function PrizesPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'school' | 'isp'>('school');
  const [period, setPeriod] = useState<Record<string, unknown> | null>(null);
  const [score, setScore] = useState<Record<string, unknown> | null>(null);
  const [board, setBoard] = useState<
    Array<{
      rank: number;
      school_name: string;
      total_score: number;
      approved_brand_pct: number;
      is_me?: boolean;
      province?: string | null;
    }>
  >([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [bands, setBands] = useState<Record<string, number | null>>({});
  const [certs, setCerts] = useState<Array<Record<string, unknown>>>([]);
  const [fairPlay, setFairPlay] = useState('');
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [summary, setSummary] = useState('');
  const [podTip, setPodTip] = useState('');
  const [spCriteria, setSpCriteria] = useState<Criterion[]>([]);
  const [spSummary, setSpSummary] = useState('');
  const [ispStats, setIspStats] = useState<Record<string, number> | null>(null);
  const [incentive, setIncentive] = useState<Record<string, unknown> | null>(
    null
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/prizes?companyId=${companyId}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRole(data.role === 'isp' ? 'isp' : 'school');
      setPeriod(data.period || null);
      setScore(data.score || null);
      setBoard(data.leaderboard || []);
      setWeights(data.weights || {});
      setBands(data.bands || data.score?.bands || {});
      setCerts(data.certificates || []);
      setFairPlay(String(data.fairPlay || ''));
      setCriteria(data.criteria || []);
      setSummary(String(data.summary || ''));
      setPodTip(String(data.pod_tip || ''));
      setSpCriteria(data.sp_criteria || []);
      setSpSummary(String(data.sp_summary || ''));
      setIspStats(data.stats || null);
      setIncentive(data.incentive || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SchoolsPage>
      <SchoolsHeader
        title={role === 'isp' ? 'SP prize score' : 'Headmaster prizes'}
        titleAccent={role === 'isp' ? 'Preferred supplier' : 'Quarterly'}
        description={
          role === 'isp'
            ? '0–100 preferred-supplier score. Other items may ride on the DN, but full DBE-approved compliance earns the most points.'
            : 'Quarterly headmaster prize: ~55% of points for approved-brand procurement and zero off-catalogue GRNs.'
        }
        action={
          <div className="flex gap-2">
            <Link
              href="/dashboard/schools/deliveries"
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Camera className="w-3.5 h-3.5" /> POD photos
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Recompute
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          {summary ? (
            <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-slate-700">
              {summary}
            </div>
          ) : null}

          {podTip ? (
            <div className="mb-4 rounded-2xl border border-violet-100 bg-violet-50/80 px-4 py-3 text-sm text-violet-950 flex gap-2">
              <Camera className="w-5 h-5 shrink-0 text-violet-700" />
              <p>{podTip}</p>
            </div>
          ) : null}

          <div className="mb-6 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 flex flex-wrap items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-amber-100 shadow-sm">
              {role === 'isp' ? (
                <Truck className="w-8 h-8 text-amber-600" />
              ) : (
                <Trophy className="w-8 h-8 text-amber-600" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800/70">
                {String(period?.name || 'Current quarter')}
              </p>
              <p className="text-4xl font-black text-slate-900 tabular-nums">
                {score?.total != null
                  ? Number(score.total).toFixed(1)
                  : '—'}
              </p>
              <p className="text-sm text-slate-600">
                {role === 'isp' ? (
                  <>
                    {String(incentive?.badge || score?.badge || 'SP score')} ·{' '}
                    {score?.compliance_pct != null
                      ? `${Number(score.compliance_pct).toFixed(1)}% on-catalogue`
                      : 'Out of 100'}
                  </>
                ) : (
                  <>
                    {score?.rank
                      ? `National #${score.rank}`
                      : 'Score out of 100'}
                    {bands.province != null
                      ? ` · Province #${bands.province}`
                      : ''}
                    {bands.quintile != null
                      ? ` · Quintile #${bands.quintile}`
                      : ''}
                  </>
                )}
                {' · '}
                {String(period?.starts_on || '')} →{' '}
                {String(period?.ends_on || '')}
              </p>
              {fairPlay ? (
                <p className="text-[11px] text-amber-900/80 mt-1 max-w-xl">
                  {fairPlay}
                </p>
              ) : null}
            </div>

            {role === 'isp' && score ? (
              <div className="ml-auto grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {(
                  [
                    { label: 'On-catalogue', val: score.onCatalogue, w: 50 },
                    {
                      label: 'Full compliance',
                      val: score.fullCompliance,
                      w: 25,
                    },
                    { label: 'POD photos', val: score.podPhotos, w: 15 },
                    { label: 'On-time', val: score.otif, w: 10 },
                  ] as Array<{ label: string; val: unknown; w: number }>
                ).map((row) => (
                  <div
                    key={row.label}
                    className="rounded-xl bg-white/80 border border-amber-100 px-3 py-2"
                  >
                    <div className="text-[9px] font-bold uppercase text-slate-400">
                      {row.label} (w{row.w})
                    </div>
                    <div className="font-black tabular-nums">
                      {row.val != null ? Number(row.val).toFixed(1) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ml-auto grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {(
                  [
                    {
                      label: 'Approved brand',
                      val: score?.approvedBrand,
                      w: weights.approvedBrand,
                    },
                    {
                      label: 'Zero non-approved',
                      val: score?.zeroNonapproved,
                      w: weights.zeroNonapproved,
                    },
                    {
                      label: 'Feeding',
                      val: score?.feedingCompleteness,
                      w: weights.feedingCompleteness,
                    },
                    {
                      label: 'Data quality',
                      val: score?.dataQuality,
                      w: weights.dataQuality,
                    },
                    {
                      label: 'Stock discipline',
                      val: score?.stockDiscipline,
                      w: weights.stockDiscipline,
                    },
                    {
                      label: 'Menu',
                      val: score?.menuAdherence,
                      w: weights.menuAdherence,
                    },
                  ] as Array<{ label: string; val: unknown; w?: number }>
                ).map((row) => (
                  <div
                    key={row.label}
                    className="rounded-xl bg-white/80 border border-amber-100 px-3 py-2"
                  >
                    <div className="text-[9px] font-bold uppercase text-slate-400">
                      {row.label} (w{row.w ?? '—'})
                    </div>
                    <div className="font-black tabular-nums">
                      {row.val != null ? Number(row.val).toFixed(1) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {role === 'isp' && ispStats ? (
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { l: 'Deliveries', v: ispStats.deliveries },
                { l: '100% clean DNs', v: ispStats.full_compliance_deliveries },
                { l: 'With POD photo', v: ispStats.deliveries_with_pod },
                {
                  l: 'On-time',
                  v:
                    ispStats.otif_known > 0
                      ? `${ispStats.otif_ok}/${ispStats.otif_known}`
                      : '—',
                },
              ].map((x) => (
                <div
                  key={x.l}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <p className="text-[10px] font-bold uppercase text-slate-400">
                    {x.l}
                  </p>
                  <p className="text-lg font-black tabular-nums">{x.v ?? '—'}</p>
                </div>
              ))}
            </div>
          ) : null}

          {/* Clear prize criteria */}
          <CriteriaPanel
            title={
              role === 'isp'
                ? 'Service provider prize criteria'
                : 'School prize criteria'
            }
            criteria={criteria}
            accent={role === 'isp' ? 'emerald' : 'amber'}
          />

          {role === 'school' && spCriteria.length > 0 ? (
            <div className="mt-4">
              <CriteriaPanel
                title="How SPs earn preferred points (for your ordering)"
                criteria={spCriteria}
                accent="emerald"
                intro={spSummary}
              />
            </div>
          ) : null}

          {role === 'school' && certs.length > 0 ? (
            <div className="mt-4 mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm">
              <p className="font-bold text-emerald-950 mb-1">Certificates</p>
              <ul className="space-y-1">
                {certs.map((c) => (
                  <li key={String(c.id || c.certificate_code)}>
                    <span className="font-semibold">{String(c.title)}</span>
                    <span className="text-xs text-emerald-800/80 ml-2 font-mono">
                      {String(c.certificate_code || '')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {role === 'school' ? (
            <div className="mt-4 rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                <Award className="w-4 h-4 text-amber-500" />
                Leaderboard
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-3">#</th>
                    <th className="px-3 py-3">School</th>
                    <th className="px-3 py-3">Province</th>
                    <th className="px-3 py-3 text-right">Approved %</th>
                    <th className="px-3 py-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {board.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No scores yet — receive approved stock and log feeding.
                      </td>
                    </tr>
                  ) : (
                    board.map((b) => (
                      <tr
                        key={b.rank}
                        className={`border-b border-slate-50 ${
                          b.is_me ? 'bg-amber-50/60' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 font-black">{b.rank}</td>
                        <td className="px-3 py-2.5 font-semibold">
                          {b.school_name}
                          {b.is_me ? (
                            <span className="ml-2 text-[10px] font-bold text-amber-800">
                              YOU
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {b.province || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {Number(b.approved_brand_pct || 0).toFixed(1)}%
                        </td>
                        <td className="px-3 py-2.5 text-right font-black tabular-nums">
                          {Number(b.total_score || 0).toFixed(1)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5 text-sm text-emerald-950">
              <p className="font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                How to maximise SP points
              </p>
              <ul className="mt-2 space-y-1 list-disc pl-5">
                <li>
                  Keep NSNP lines on the department approved list (50 pts
                  weight).
                </li>
                <li>
                  Deliver 100% clean DNs when you can — full-compliance pillar
                  (25 pts).
                </li>
                <li>
                  Other commercial items may appear on the note, but they dilute
                  on-catalogue % and full-compliance bonus.
                </li>
                <li>
                  Attach a <strong>photo POD</strong> at every school gate (15
                  pts).
                </li>
                <li>Set expected date and deliver on time (10 pts).</li>
              </ul>
              <Link
                href="/dashboard/schools/deliveries"
                className="btn-primary !py-2 !px-4 text-xs mt-4 inline-flex"
              >
                Open deliveries →
              </Link>
            </div>
          )}
        </>
      )}
    </SchoolsPage>
  );
}

function CriteriaPanel({
  title,
  criteria,
  accent,
  intro,
}: {
  title: string;
  criteria: Criterion[];
  accent: 'amber' | 'emerald';
  intro?: string;
}) {
  if (!criteria.length) return null;
  const border =
    accent === 'emerald' ? 'border-emerald-200' : 'border-amber-200';
  const head =
    accent === 'emerald'
      ? 'bg-emerald-50 text-emerald-950'
      : 'bg-amber-50 text-amber-950';

  return (
    <div className={`rounded-3xl border ${border} bg-white overflow-hidden`}>
      <div className={`px-5 py-3 border-b ${head}`}>
        <h3 className="text-sm font-black">{title}</h3>
        {intro ? (
          <p className="text-xs mt-1 opacity-90 leading-relaxed">{intro}</p>
        ) : null}
      </div>
      <ul className="divide-y divide-slate-50">
        {criteria.map((c) => (
          <li key={c.id} className="px-5 py-3 flex gap-3">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center">
              <span className="text-lg font-black tabular-nums">{c.weight}</span>
              <span className="text-[9px] font-bold uppercase text-slate-400">
                pts
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-slate-900">{c.label}</p>
              <p className="text-xs text-slate-600 mt-0.5">{c.how}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                <strong>Tip:</strong> {c.tip}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="px-5 py-2 border-t bg-slate-50 text-[11px] font-bold text-slate-500">
        Total {criteria.reduce((n, c) => n + c.weight, 0)} points
      </div>
    </div>
  );
}
