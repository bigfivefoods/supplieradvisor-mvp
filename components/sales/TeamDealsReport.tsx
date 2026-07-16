'use client';

import { useMemo, useState } from 'react';
import {
  Trophy,
  Users,
  Wallet,
  Calendar,
  Timer,
  TrendingUp,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  formatMoney,
  type OpportunityRecord,
} from '@/lib/customers/types';
import {
  calculateCommission,
  formatZarPrecise,
  type CommissionTier,
  DEFAULT_COMMISSION_TIERS,
} from '@/lib/sales-contractor/commission';
import { ForecastBarChart } from '@/components/sales/SalesCharts';

export type TeamMemberLite = {
  user_id: string;
  name: string;
  email?: string | null;
  role?: string | null;
};

type Row = {
  userId: string;
  name: string;
  dealCount: number;
  openCount: number;
  wonCount: number;
  totalAmount: number;
  openAmount: number;
  weightedAmount: number;
  commissionIfWon: number;
  weightedCommission: number;
  nextClose: string | null;
  /** Sum of days_open for currently open deals (for averaging) */
  openDaysSum: number;
  openDaysCount: number;
  /** Sum of days_to_close for closed (won/lost) deals */
  closeDaysSum: number;
  closeDaysCount: number;
};

type ForecastDeal = {
  id: number;
  name: string;
  owner: string;
  amount: number;
  weighted: number;
  probability: number;
  stage: string;
  expectedClose: string | null;
  overdue: boolean;
};

type MonthBucket = {
  key: string;
  label: string;
  year: number;
  month: number; // 0-11
  dealCount: number;
  potential: number;
  weighted: number;
  commission: number;
  deals: ForecastDeal[];
};

function dealAmount(o: OpportunityRecord): number {
  return Number(
    (o as { amount?: number }).amount ||
      (o as { opportunity_size?: number }).opportunity_size ||
      0
  );
}

function isOpen(stage?: string | null) {
  const s = String(stage || '');
  return !['closed_won', 'closed_lost', 'invoiced'].includes(s);
}

function isWon(stage?: string | null) {
  const s = String(stage || '');
  return s === 'closed_won' || s === 'invoiced';
}

function isClosed(stage?: string | null) {
  const s = String(stage || '');
  return s === 'closed_won' || s === 'closed_lost' || s === 'invoiced';
}

function cycleDays(o: OpportunityRecord): number | null {
  if (o.days_to_close != null && Number.isFinite(Number(o.days_to_close))) {
    return Number(o.days_to_close);
  }
  if (o.open_date && o.actual_close_date) {
    return Math.round(
      (new Date(o.actual_close_date).getTime() -
        new Date(o.open_date).getTime()) /
        (24 * 60 * 60 * 1000)
    );
  }
  return null;
}

function openDays(o: OpportunityRecord): number | null {
  if (o.days_open != null && Number.isFinite(Number(o.days_open))) {
    return Number(o.days_open);
  }
  if (o.open_date && !o.actual_close_date) {
    return Math.round(
      (Date.now() - new Date(o.open_date).getTime()) / (24 * 60 * 60 * 1000)
    );
  }
  return null;
}

function avgLabel(sum: number, count: number): string {
  if (!count) return '—';
  return `${Math.round(sum / count)}d`;
}

function monthKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function monthLabel(y: number, m: number): string {
  return new Date(y, m, 1).toLocaleDateString('en-ZA', {
    month: 'short',
    year: 'numeric',
  });
}

/** Parse YYYY-MM-DD or ISO → {y, m} or null */
function parseYearMonth(raw: string | null | undefined): {
  y: number;
  m: number;
} | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (!m) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return { y: d.getFullYear(), m: d.getMonth() };
  }
  return { y: Number(m[1]), m: Number(m[2]) - 1 };
}

/**
 * Rank team members by deals, pipeline size, commission, and cycle times.
 * Below the leaderboard: 12-month forecast of potential orders by expected land month.
 */
export default function TeamDealsReport({
  opportunities,
  members,
  commissionTiers,
}: {
  opportunities: OpportunityRecord[];
  members: TeamMemberLite[];
  commissionTiers?: CommissionTier[] | null;
}) {
  const tiers = commissionTiers?.length ? commissionTiers : DEFAULT_COMMISSION_TIERS;
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  const nameByUser = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of members) {
      if (mem.user_id) m.set(mem.user_id, mem.name);
    }
    return m;
  }, [members]);

  const rows = useMemo(() => {
    const map = new Map<string, Row>();

    const ensure = (userId: string, name?: string | null) => {
      const key = userId || '__unassigned__';
      if (!map.has(key)) {
        map.set(key, {
          userId: key,
          name:
            key === '__unassigned__'
              ? 'Unassigned'
              : nameByUser.get(key) ||
                name ||
                `User ${key.slice(0, 8)}…`,
          dealCount: 0,
          openCount: 0,
          wonCount: 0,
          totalAmount: 0,
          openAmount: 0,
          weightedAmount: 0,
          commissionIfWon: 0,
          weightedCommission: 0,
          nextClose: null,
          openDaysSum: 0,
          openDaysCount: 0,
          closeDaysSum: 0,
          closeDaysCount: 0,
        });
      }
      return map.get(key)!;
    };

    for (const o of opportunities) {
      const uid = String(
        (o as { sales_rep_user_id?: string | null }).sales_rep_user_id || ''
      ).trim();
      const row = ensure(
        uid || '__unassigned__',
        o.owner_name || null
      );
      const amt = dealAmount(o);
      const prob = Number(o.probability) > 0 ? Number(o.probability) : 10;
      const weighted = (amt * prob) / 100;
      const comm =
        amt > 0 ? calculateCommission(amt, { tiers }).commissionAmount : 0;

      row.dealCount += 1;
      row.totalAmount += amt;
      row.weightedAmount += isOpen(o.stage) ? weighted : isWon(o.stage) ? amt : 0;

      if (isOpen(o.stage)) {
        row.openCount += 1;
        row.openAmount += amt;
        row.commissionIfWon += comm;
        row.weightedCommission += (comm * prob) / 100;
        const close = o.expected_close_date || null;
        if (close) {
          if (!row.nextClose || close < row.nextClose) row.nextClose = close;
        }
        const od = openDays(o);
        if (od != null && od >= 0) {
          row.openDaysSum += od;
          row.openDaysCount += 1;
        }
      } else if (isWon(o.stage)) {
        row.wonCount += 1;
        row.commissionIfWon += comm;
        row.weightedCommission += comm;
      }

      if (isClosed(o.stage)) {
        const cd = cycleDays(o);
        if (cd != null && cd >= 0) {
          row.closeDaysSum += cd;
          row.closeDaysCount += 1;
        }
      }
    }

    // Include active members with zero deals
    for (const mem of members) {
      if (mem.user_id) ensure(mem.user_id, mem.name);
    }

    return [...map.values()].sort((a, b) => {
      if (b.openCount !== a.openCount) return b.openCount - a.openCount;
      if (b.openAmount !== a.openAmount) return b.openAmount - a.openAmount;
      return b.commissionIfWon - a.commissionIfWon;
    });
  }, [opportunities, members, nameByUser, tiers]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.deals += r.dealCount;
        acc.open += r.openCount;
        acc.amount += r.openAmount;
        acc.comm += r.commissionIfWon;
        acc.wComm += r.weightedCommission;
        acc.openDaysSum += r.openDaysSum;
        acc.openDaysCount += r.openDaysCount;
        acc.closeDaysSum += r.closeDaysSum;
        acc.closeDaysCount += r.closeDaysCount;
        return acc;
      },
      {
        deals: 0,
        open: 0,
        amount: 0,
        comm: 0,
        wComm: 0,
        openDaysSum: 0,
        openDaysCount: 0,
        closeDaysSum: 0,
        closeDaysCount: 0,
      }
    );
  }, [rows]);

  /**
   * 12 calendar months from current month: open deals bucketed by expected land date.
   * Past-due expected dates land in the current month; no date → unscheduled.
   */
  const forecast = useMemo(() => {
    const now = new Date();
    const startY = now.getFullYear();
    const startM = now.getMonth();
    const months: MonthBucket[] = [];
    const byKey = new Map<string, MonthBucket>();

    for (let i = 0; i < 12; i++) {
      const d = new Date(startY, startM + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = monthKey(y, m);
      const bucket: MonthBucket = {
        key,
        label: monthLabel(y, m),
        year: y,
        month: m,
        dealCount: 0,
        potential: 0,
        weighted: 0,
        commission: 0,
        deals: [],
      };
      months.push(bucket);
      byKey.set(key, bucket);
    }

    const firstKey = months[0].key;
    const lastKey = months[11].key;
    const unscheduled: ForecastDeal[] = [];
    let beyondHorizon = 0;

    for (const o of opportunities) {
      if (!isOpen(o.stage)) continue;
      const amt = dealAmount(o);
      const prob = Number(o.probability) > 0 ? Number(o.probability) : 10;
      const weighted = (amt * prob) / 100;
      const uid = String(
        (o as { sales_rep_user_id?: string | null }).sales_rep_user_id || ''
      ).trim();
      const owner =
        o.owner_name ||
        (uid ? nameByUser.get(uid) : null) ||
        (uid ? `User ${uid.slice(0, 8)}…` : 'Unassigned');

      const expectedRaw = o.expected_close_date || null;
      const ym = parseYearMonth(expectedRaw);

      const deal: ForecastDeal = {
        id: Number(o.id),
        name: o.name || o.company_name || `Deal #${o.id}`,
        owner,
        amount: amt,
        weighted,
        probability: prob,
        stage: String(o.stage || 'prospecting'),
        expectedClose: expectedRaw,
        overdue: false,
      };

      if (!ym) {
        unscheduled.push(deal);
        continue;
      }

      let key = monthKey(ym.y, ym.m);
      if (key < firstKey) {
        key = firstKey;
        deal.overdue = true;
      } else if (key > lastKey) {
        beyondHorizon += 1;
        continue;
      }

      const bucket = byKey.get(key);
      if (!bucket) continue;
      bucket.dealCount += 1;
      bucket.potential += amt;
      bucket.weighted += weighted;
      bucket.deals.push(deal);
    }

    for (const b of months) {
      b.commission =
        b.weighted > 0
          ? calculateCommission(b.weighted, { tiers }).commissionAmount
          : 0;
      b.deals.sort((a, c) => c.amount - a.amount);
    }

    unscheduled.sort((a, b) => b.amount - a.amount);

    const sumPotential = months.reduce((s, m) => s + m.potential, 0);
    const sumWeighted = months.reduce((s, m) => s + m.weighted, 0);
    const sumDeals = months.reduce((s, m) => s + m.dealCount, 0);
    const sumComm = months.reduce((s, m) => s + m.commission, 0);
    const peak = months.reduce(
      (best, m) => (m.potential > best.potential ? m : best),
      months[0]
    );

    return {
      months,
      unscheduled,
      beyondHorizon,
      sumPotential,
      sumWeighted,
      sumDeals,
      sumComm,
      peak,
    };
  }, [opportunities, nameByUser, tiers]);

  if (!opportunities.length && !members.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-neutral-500">
        No deals or team members yet. Add opportunities and assign owners on
        each card.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            People
          </div>
          <div className="text-lg font-black text-slate-900">{rows.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Open deals
          </div>
          <div className="text-lg font-black text-slate-900">{totals.open}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Open pipeline
          </div>
          <div className="text-lg font-black text-emerald-700">
            {formatMoney(totals.amount)}
          </div>
        </div>
        <div className="rounded-2xl border-2 border-amber-300/60 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2.5">
          <div className="text-[10px] font-bold uppercase text-amber-800/80 flex items-center gap-1">
            <Wallet className="w-3 h-3" /> Commission if open won
          </div>
          <div className="text-lg font-black text-amber-950">
            {formatZarPrecise(totals.comm)}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-2.5">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Prob-weighted commission
          </div>
          <div className="text-lg font-black text-amber-900">
            {formatZarPrecise(totals.wComm)}
          </div>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 px-4 py-2.5">
          <div className="text-[10px] font-bold uppercase text-sky-800/80 flex items-center gap-1">
            <Timer className="w-3 h-3" /> Avg days open
          </div>
          <div className="text-lg font-black text-sky-950">
            {avgLabel(totals.openDaysSum, totals.openDaysCount)}
          </div>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 px-4 py-2.5">
          <div className="text-[10px] font-bold uppercase text-violet-800/80 flex items-center gap-1">
            <Timer className="w-3 h-3" /> Avg cycle (closed)
          </div>
          <div className="text-lg font-black text-violet-950">
            {avgLabel(totals.closeDaysSum, totals.closeDaysCount)}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Team member</th>
              <th className="px-4 py-3">Deals</th>
              <th className="px-4 py-3">Open</th>
              <th className="px-4 py-3">Won</th>
              <th className="px-4 py-3">Open value</th>
              <th className="px-4 py-3">Weighted</th>
              <th className="px-4 py-3">Comm. if won</th>
              <th className="px-4 py-3">Weighted comm.</th>
              <th className="px-4 py-3">Avg open</th>
              <th className="px-4 py-3">Avg cycle</th>
              <th className="px-4 py-3">Next land</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r.userId} className="hover:bg-sky-50/40">
                <td className="px-4 py-3 text-neutral-400 font-bold">
                  {i === 0 && r.openCount > 0 ? (
                    <Trophy className="w-4 h-4 text-amber-500 inline" />
                  ) : (
                    i + 1
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {r.name}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums">
                  {r.dealCount}
                </td>
                <td className="px-4 py-3 tabular-nums">{r.openCount}</td>
                <td className="px-4 py-3 tabular-nums text-emerald-700">
                  {r.wonCount}
                </td>
                <td className="px-4 py-3 font-bold text-emerald-800 tabular-nums">
                  {formatMoney(r.openAmount)}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-600">
                  {formatMoney(r.weightedAmount)}
                </td>
                <td className="px-4 py-3 font-black text-amber-900 tabular-nums">
                  {formatZarPrecise(r.commissionIfWon)}
                </td>
                <td className="px-4 py-3 font-semibold text-amber-800 tabular-nums">
                  {formatZarPrecise(r.weightedCommission)}
                </td>
                <td className="px-4 py-3 tabular-nums text-sky-800 font-semibold">
                  {avgLabel(r.openDaysSum, r.openDaysCount)}
                </td>
                <td className="px-4 py-3 tabular-nums text-violet-800 font-semibold">
                  {avgLabel(r.closeDaysSum, r.closeDaysCount)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                  {r.nextClose ? (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {r.nextClose}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-neutral-500">
        <strong>Avg open</strong> = mean days since open date for open deals.{' '}
        <strong>Avg cycle</strong> = mean open→closed days for won/lost/invoiced
        deals. Set open / expected land / closed dates on each card (or in the
        deal form) to track how long it takes to land a deal. Commission uses
        the company sales program tiers (typically 4% · 5% · 6%).
      </p>

      {/* ── 12-month potential order forecast ───────────────────────────── */}
      <div className="mt-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#00b4d8]" />
              12-month order forecast
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Open pipeline by expected land month · potential (100%) vs
              probability-weighted · est. commission on weighted value
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
            <div className="text-[10px] font-bold uppercase text-neutral-400">
              Dated deals
            </div>
            <div className="text-lg font-black text-slate-900">
              {forecast.sumDeals}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 px-4 py-2.5">
            <div className="text-[10px] font-bold uppercase text-emerald-800/70">
              Potential (12 mo)
            </div>
            <div className="text-lg font-black text-emerald-800">
              {formatMoney(forecast.sumPotential)}
            </div>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50/40 px-4 py-2.5">
            <div className="text-[10px] font-bold uppercase text-sky-800/70">
              Weighted (12 mo)
            </div>
            <div className="text-lg font-black text-sky-900">
              {formatMoney(forecast.sumWeighted)}
            </div>
          </div>
          <div className="rounded-2xl border-2 border-amber-300/60 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2.5">
            <div className="text-[10px] font-bold uppercase text-amber-800/80 flex items-center gap-1">
              <Wallet className="w-3 h-3" /> Est. commission
            </div>
            <div className="text-lg font-black text-amber-950">
              {formatZarPrecise(forecast.sumComm)}
            </div>
          </div>
          {forecast.peak.potential > 0 && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/40 px-4 py-2.5">
              <div className="text-[10px] font-bold uppercase text-violet-800/70">
                Peak month
              </div>
              <div className="text-sm font-black text-violet-950">
                {forecast.peak.label}
              </div>
              <div className="text-xs text-violet-700 tabular-nums">
                {formatMoney(forecast.peak.potential)} · {forecast.peak.dealCount}{' '}
                deal{forecast.peak.dealCount === 1 ? '' : 's'}
              </div>
            </div>
          )}
          {forecast.unscheduled.length > 0 && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50/50 px-4 py-2.5">
              <div className="text-[10px] font-bold uppercase text-orange-800/70">
                Unscheduled
              </div>
              <div className="text-lg font-black text-orange-950">
                {forecast.unscheduled.length}
              </div>
              <div className="text-[10px] text-orange-700">
                No expected land date
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <p className="text-xs text-neutral-600 mb-3">
            <span className="text-sky-700 font-semibold">Potential orders</span>
            {' · '}
            <span className="text-orange-700 font-semibold">
              Est. commission (weighted)
            </span>
            {' · by expected land month'}
          </p>
          <div className="h-72 sm:h-80 rounded-2xl bg-slate-50 border border-neutral-100 p-2 sm:p-3">
            <ForecastBarChart
              labels={forecast.months.map((m) => m.label)}
              amounts={forecast.months.map((m) => Math.round(m.potential))}
              commissions={forecast.months.map((m) =>
                Math.round(m.commission)
              )}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Deals</th>
                <th className="px-4 py-3">Potential</th>
                <th className="px-4 py-3">Weighted</th>
                <th className="px-4 py-3">Est. comm.</th>
                <th className="px-4 py-3">Top opportunity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {forecast.months.map((m) => {
                const open = expandedMonth === m.key;
                const top = m.deals[0];
                return (
                  <FragmentMonth
                    key={m.key}
                    month={m}
                    open={open}
                    top={top}
                    tiers={tiers}
                    onToggle={() =>
                      setExpandedMonth(open ? null : m.key)
                    }
                  />
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr className="font-bold text-slate-900">
                <td className="px-4 py-3" />
                <td className="px-4 py-3">12-month total</td>
                <td className="px-4 py-3 tabular-nums">{forecast.sumDeals}</td>
                <td className="px-4 py-3 tabular-nums text-emerald-800">
                  {formatMoney(forecast.sumPotential)}
                </td>
                <td className="px-4 py-3 tabular-nums text-sky-800">
                  {formatMoney(forecast.sumWeighted)}
                </td>
                <td className="px-4 py-3 tabular-nums text-amber-900">
                  {formatZarPrecise(forecast.sumComm)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>

        {forecast.unscheduled.length > 0 && (
          <div className="rounded-3xl border border-orange-200 bg-orange-50/30 overflow-hidden">
            <button
              type="button"
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-orange-50/80"
              onClick={() => setShowUnscheduled((v) => !v)}
            >
              <span className="text-sm font-bold text-orange-950 flex items-center gap-2">
                {showUnscheduled ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                Unscheduled open deals ({forecast.unscheduled.length})
              </span>
              <span className="text-xs font-semibold text-orange-800 tabular-nums">
                {formatMoney(
                  forecast.unscheduled.reduce((s, d) => s + d.amount, 0)
                )}{' '}
                potential
              </span>
            </button>
            {showUnscheduled && (
              <ul className="border-t border-orange-100 divide-y divide-orange-100 bg-white">
                {forecast.unscheduled.map((d) => (
                  <li
                    key={d.id}
                    className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{d.name}</div>
                      <div className="text-[11px] text-neutral-500">
                        {d.owner} · {d.stage.replace(/_/g, ' ')} · {d.probability}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-800 tabular-nums">
                        {formatMoney(d.amount)}
                      </div>
                      <div className="text-[10px] text-neutral-500">
                        Set expected land on the pipeline card
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {forecast.beyondHorizon > 0 && (
          <p className="text-[11px] text-neutral-500">
            {forecast.beyondHorizon} open deal
            {forecast.beyondHorizon === 1 ? '' : 's'} expected after this 12-month
            window are not shown above.
          </p>
        )}

        <p className="text-[11px] text-neutral-500">
          <strong>Potential</strong> = full deal value if won.{' '}
          <strong>Weighted</strong> = amount × stage probability.{' '}
          Past expected land dates still open are counted in the{' '}
          <em>current</em> month (overdue). Set expected land dates on opportunity
          cards to place deals in the right month.
        </p>
      </div>
    </div>
  );
}

function FragmentMonth({
  month,
  open,
  top,
  tiers,
  onToggle,
}: {
  month: MonthBucket;
  open: boolean;
  top?: ForecastDeal;
  tiers: CommissionTier[];
  onToggle: () => void;
}) {
  const hasDeals = month.dealCount > 0;
  return (
    <>
      <tr
        className={`hover:bg-sky-50/40 ${hasDeals ? 'cursor-pointer' : ''}`}
        onClick={hasDeals ? onToggle : undefined}
      >
        <td className="px-4 py-3 text-neutral-400">
          {hasDeals ? (
            open ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )
          ) : (
            <span className="inline-block w-4" />
          )}
        </td>
        <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
          {month.label}
        </td>
        <td className="px-4 py-3 tabular-nums">{month.dealCount || '—'}</td>
        <td className="px-4 py-3 font-semibold text-emerald-800 tabular-nums">
          {month.potential > 0 ? formatMoney(month.potential) : '—'}
        </td>
        <td className="px-4 py-3 text-sky-800 tabular-nums">
          {month.weighted > 0 ? formatMoney(month.weighted) : '—'}
        </td>
        <td className="px-4 py-3 font-semibold text-amber-900 tabular-nums">
          {month.commission > 0 ? formatZarPrecise(month.commission) : '—'}
        </td>
        <td className="px-4 py-3 text-xs text-slate-600 max-w-[220px] truncate">
          {top ? (
            <span title={top.name}>
              {top.name}
              {top.overdue ? (
                <span className="ml-1 text-orange-600 font-bold">overdue</span>
              ) : null}
            </span>
          ) : (
            '—'
          )}
        </td>
      </tr>
      {open &&
        month.deals.map((d) => (
          <tr key={d.id} className="bg-slate-50/80 text-xs">
            <td className="px-4 py-2" />
            <td className="px-4 py-2 pl-8 text-slate-700" colSpan={2}>
              <div className="font-semibold text-slate-900">{d.name}</div>
              <div className="text-neutral-500 mt-0.5">
                {d.owner} · {d.stage.replace(/_/g, ' ')} · {d.probability}%
                {d.expectedClose ? ` · land ${d.expectedClose}` : ''}
                {d.overdue ? ' · overdue' : ''}
              </div>
            </td>
            <td className="px-4 py-2 font-bold text-emerald-800 tabular-nums">
              {formatMoney(d.amount)}
            </td>
            <td className="px-4 py-2 text-sky-800 tabular-nums">
              {formatMoney(d.weighted)}
            </td>
            <td className="px-4 py-2 text-amber-900 tabular-nums">
              {formatZarPrecise(
                calculateCommission(d.weighted, { tiers }).commissionAmount
              )}
            </td>
            <td className="px-4 py-2" />
          </tr>
        ))}
    </>
  );
}
