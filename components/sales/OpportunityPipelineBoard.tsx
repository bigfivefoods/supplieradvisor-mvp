'use client';

import { useMemo } from 'react';
import { Briefcase, ChevronRight, Wallet } from 'lucide-react';
import {
  OPPORTUNITY_STAGES,
  formatMoney,
  type OpportunityRecord,
} from '@/lib/customers/types';
import {
  calculateCommission,
  formatZarPrecise,
  type CommissionTier,
  DEFAULT_COMMISSION_TIERS,
} from '@/lib/sales-contractor/commission';

export type OpportunityPipelineBoardProps = {
  opportunities: OpportunityRecord[];
  onEdit?: (o: OpportunityRecord) => void;
  onMove?: (id: number, stage: string) => void;
  onDelete?: (id: number) => void;
  onCreate?: () => void;
  /** Show progressive commission (sales contractor) */
  showCommission?: boolean;
  /** Optional agreement tiers; defaults to platform 3.5%–5.5% scale */
  commissionTiers?: CommissionTier[] | null;
  /** Compact cards for dense boards */
  compact?: boolean;
};

function dealAmount(o: OpportunityRecord): number {
  return Number(
    (o as { amount?: number }).amount ||
      (o as { opportunity_size?: number }).opportunity_size ||
      0
  );
}

function probabilityPct(o: OpportunityRecord): number {
  const p = Number(o.probability);
  if (Number.isFinite(p) && p > 0) return Math.min(100, p);
  const stage = OPPORTUNITY_STAGES.find((s) => s.value === o.stage);
  return stage?.probability ?? 10;
}

/**
 * Kanban opportunity map (same layout as Customers → Leads → Opportunity pipeline).
 * Sales portal can pass showCommission for “earn if won” per card.
 */
export default function OpportunityPipelineBoard({
  opportunities,
  onEdit,
  onMove,
  onDelete,
  onCreate,
  showCommission = false,
  commissionTiers,
  compact = false,
}: OpportunityPipelineBoardProps) {
  const tiers = commissionTiers?.length ? commissionTiers : DEFAULT_COMMISSION_TIERS;

  const totals = useMemo(() => {
    let pipeline = 0;
    let commission = 0;
    let weightedComm = 0;
    for (const o of opportunities) {
      if (o.stage === 'closed_lost') continue;
      const amt = dealAmount(o);
      pipeline += amt;
      if (showCommission && amt > 0) {
        const c = calculateCommission(amt, { tiers }).commissionAmount;
        commission += c;
        if (o.stage !== 'closed_won') {
          weightedComm += (c * probabilityPct(o)) / 100;
        } else {
          weightedComm += c;
        }
      }
    }
    return { pipeline, commission, weightedComm };
  }, [opportunities, showCommission, tiers]);

  if (!opportunities.length) {
    return (
      <div className="bg-white border rounded-3xl p-16 text-center text-neutral-500">
        <Briefcase className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
        <p className="mb-4">No opportunities yet. Create a deal or convert a qualified lead.</p>
        {onCreate && (
          <button type="button" onClick={onCreate} className="btn-primary !py-2.5 !px-5 text-sm">
            New opportunity
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showCommission && (
        <div className="flex flex-wrap gap-2">
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm">
            <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wide">
              Open pipeline
            </span>
            <div className="font-black text-slate-900">{formatMoney(totals.pipeline)}</div>
          </div>
          <div className="rounded-2xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2.5 text-sm">
            <span className="text-amber-800/80 text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
              <Wallet className="w-3 h-3" /> If all won · commission
            </span>
            <div className="font-black text-amber-950">
              {formatZarPrecise(totals.commission)}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-sm">
            <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wide">
              Probability-weighted earn
            </span>
            <div className="font-black text-amber-900">
              {formatZarPrecise(totals.weightedComm)}
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {OPPORTUNITY_STAGES.map((stage) => {
            const cards = opportunities.filter((o) => o.stage === stage.value);
            const colValue = cards.reduce((s, o) => s + dealAmount(o), 0);
            const colCommission = showCommission
              ? cards.reduce((s, o) => {
                  const amt = dealAmount(o);
                  if (amt <= 0) return s;
                  return s + calculateCommission(amt, { tiers }).commissionAmount;
                }, 0)
              : 0;

            return (
              <div
                key={stage.value}
                className="w-[280px] flex-shrink-0 bg-neutral-50 border rounded-3xl overflow-hidden"
              >
                <div className="px-3 py-3 border-b bg-white">
                  <div className="font-bold text-sm">{stage.label}</div>
                  <div className="text-[11px] text-neutral-500">
                    {cards.length} · {formatMoney(colValue)} · {stage.probability}%
                  </div>
                  {showCommission && colCommission > 0 && (
                    <div className="text-[11px] font-bold text-amber-800 mt-0.5">
                      Commission {formatZarPrecise(colCommission)}
                    </div>
                  )}
                </div>
                <div
                  className={`p-2 space-y-2 overflow-y-auto ${
                    compact ? 'max-h-[60vh]' : 'max-h-[70vh]'
                  }`}
                >
                  {cards.map((o) => {
                    const amt = dealAmount(o);
                    const comm =
                      showCommission && amt > 0
                        ? calculateCommission(amt, { tiers })
                        : null;
                    const prob = probabilityPct(o);
                    const weightedEarn =
                      comm && o.stage !== 'closed_won' && o.stage !== 'closed_lost'
                        ? (comm.commissionAmount * prob) / 100
                        : comm?.commissionAmount ?? 0;

                    return (
                      <div
                        key={o.id}
                        className="bg-white border rounded-2xl p-3 shadow-sm hover:border-[#00b4d8]/40 transition-colors"
                      >
                        <div className="font-semibold text-sm leading-snug text-slate-900">
                          {o.name}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {o.company_name || o.contact_name || '—'}
                        </div>
                        <div className="text-sm font-bold text-emerald-700 mt-1">
                          {formatMoney(amt, o.currency || 'ZAR')}
                        </div>
                        <div className="text-[10px] text-neutral-400 mt-0.5">
                          Weighted {formatMoney(o.weighted_amount ?? (amt * prob) / 100)} ·
                          close {o.expected_close_date || '—'}
                        </div>

                        {comm && (
                          <div className="mt-2 rounded-xl border border-amber-300/70 bg-gradient-to-r from-amber-50 to-orange-50 px-2.5 py-2">
                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-900/80">
                              <Wallet className="w-3 h-3" />
                              Your commission
                            </div>
                            <div className="text-sm font-black text-amber-950 tabular-nums">
                              {formatZarPrecise(comm.commissionAmount)}
                              <span className="text-[10px] font-semibold text-amber-800/90 ml-1">
                                · ~{comm.effectiveRatePct.toFixed(2)}%
                              </span>
                            </div>
                            {o.stage !== 'closed_won' && o.stage !== 'closed_lost' && (
                              <div className="text-[10px] text-amber-900/70 mt-0.5">
                                If stage holds (~{prob}%):{' '}
                                <strong>{formatZarPrecise(weightedEarn)}</strong>
                              </div>
                            )}
                            {o.stage === 'closed_won' && (
                              <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                                Closed-won · earn this amount
                              </div>
                            )}
                          </div>
                        )}

                        {o.next_step && (
                          <div className="text-[11px] text-neutral-600 mt-1.5 flex items-start gap-1">
                            <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            {o.next_step}
                          </div>
                        )}

                        {onMove && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {OPPORTUNITY_STAGES.filter((s) => s.value !== o.stage)
                              .slice(0, 4)
                              .map((s) => (
                                <button
                                  key={s.value}
                                  type="button"
                                  onClick={() => onMove(o.id, s.value)}
                                  className="text-[9px] px-1.5 py-0.5 rounded-full border bg-neutral-50 hover:bg-sky-50 hover:border-sky-200"
                                  title={`Move to ${s.label}`}
                                >
                                  {s.label.split(' ')[0]}
                                </button>
                              ))}
                          </div>
                        )}

                        {(onEdit || onDelete) && (
                          <div className="flex justify-between mt-2">
                            {onEdit ? (
                              <button
                                type="button"
                                onClick={() => onEdit(o)}
                                className="text-[11px] font-semibold text-[#0077b6]"
                              >
                                Edit
                              </button>
                            ) : (
                              <span />
                            )}
                            {onDelete && (
                              <button
                                type="button"
                                onClick={() => onDelete(o.id)}
                                className="text-[11px] text-red-600"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {cards.length === 0 && (
                    <div className="text-center text-[11px] text-neutral-400 py-6">Empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
