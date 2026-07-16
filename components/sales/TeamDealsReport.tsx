'use client';

import { useMemo } from 'react';
import { Trophy, Users, Wallet, Calendar } from 'lucide-react';
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

/**
 * Rank team members by deals, pipeline size, and available commission.
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
      } else if (isWon(o.stage)) {
        row.wonCount += 1;
        row.commissionIfWon += comm;
        row.weightedCommission += comm;
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
        return acc;
      },
      { deals: 0, open: 0, amount: 0, comm: 0, wComm: 0 }
    );
  }, [rows]);

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
              <th className="px-4 py-3">Next close</th>
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
        Commission uses the company sales program tiers (typically 4% · 5% ·
        6%). Assign a team member on each opportunity card so deals roll up
        correctly.
      </p>
    </div>
  );
}
