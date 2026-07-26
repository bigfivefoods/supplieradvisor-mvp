'use client';

import { useCallback, useEffect, useState } from 'react';
import { Award, Loader2, RefreshCw, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/prizes?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPeriod(data.period || null);
      setScore(data.score || null);
      setBoard(data.leaderboard || []);
      setWeights(data.weights || {});
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
        title="Headmaster prizes"
        titleAccent="Incentives"
        description="Quarterly & annual prizes for schools that buy strict NSNP-approved brands and run clean kitchens."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Recompute
          </button>
        }
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 flex flex-wrap items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-amber-100 shadow-sm">
              <Trophy className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800/70">
                {String(period?.name || 'Current period')}
              </p>
              <p className="text-4xl font-black text-slate-900 tabular-nums">
                {score?.total != null
                  ? Number(score.total).toFixed(1)
                  : '—'}
              </p>
              <p className="text-sm text-slate-600">
                {score?.rank
                  ? `National rank #${score.rank}`
                  : 'Score out of 100'}
                {' · '}
                {String(period?.starts_on || '')} →{' '}
                {String(period?.ends_on || '')}
              </p>
            </div>
            <div className="ml-auto grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[
                ['Approved brand', score?.approvedBrand, weights.approvedBrand],
                ['Zero non-approved', score?.zeroNonapproved, weights.zeroNonapproved],
                ['Feeding', score?.feedingCompleteness, weights.feedingCompleteness],
                ['Data quality', score?.dataQuality, weights.dataQuality],
                ['Stock discipline', score?.stockDiscipline, weights.stockDiscipline],
                ['Menu', score?.menuAdherence, weights.menuAdherence],
              ].map(([label, val, w]) => (
                <div
                  key={String(label)}
                  className="rounded-xl bg-white/80 border border-amber-100 px-3 py-2"
                >
                  <div className="text-[9px] font-bold uppercase text-slate-400">
                    {label} (w{w})
                  </div>
                  <div className="font-black tabular-nums">
                    {val != null ? Number(val).toFixed(1) : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
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
        </>
      )}
    </SchoolsPage>
  );
}
