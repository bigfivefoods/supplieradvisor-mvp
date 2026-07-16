'use client';

import { useMemo, useState } from 'react';
import {
  Briefcase,
  Calendar,
  ChevronRight,
  GripVertical,
  User,
  Wallet,
} from 'lucide-react';
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

export type TeamMemberOption = {
  user_id: string;
  name: string;
  email?: string | null;
};

export type OpportunityPipelineBoardProps = {
  opportunities: OpportunityRecord[];
  onEdit?: (o: OpportunityRecord) => void;
  onMove?: (id: number, stage: string) => void;
  onDelete?: (id: number) => void;
  onCreate?: () => void;
  /** Assign company team member who owns the deal */
  onAssignOwner?: (
    id: number,
    salesRepUserId: string | null,
    ownerName: string | null
  ) => void;
  /** Expected close / land date */
  onSetCloseDate?: (id: number, date: string | null) => void;
  teamMembers?: TeamMemberOption[];
  showCommission?: boolean;
  commissionTiers?: CommissionTier[] | null;
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

function isTerminal(stage: string) {
  return stage === 'closed_won' || stage === 'closed_lost' || stage === 'invoiced';
}

/**
 * Kanban opportunity map with drag-and-drop stage moves.
 * Sales portal: showCommission for earn-if-won per card.
 */
export default function OpportunityPipelineBoard({
  opportunities,
  onEdit,
  onMove,
  onDelete,
  onCreate,
  onAssignOwner,
  onSetCloseDate,
  teamMembers = [],
  showCommission = false,
  commissionTiers,
  compact = false,
}: OpportunityPipelineBoardProps) {
  const tiers = commissionTiers?.length ? commissionTiers : DEFAULT_COMMISSION_TIERS;
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const memberName = (userId?: string | null) => {
    if (!userId) return null;
    return teamMembers.find((m) => m.user_id === userId)?.name || null;
  };

  const totals = useMemo(() => {
    let pipeline = 0;
    let commission = 0;
    let weightedComm = 0;
    for (const o of opportunities) {
      if (o.stage === 'closed_lost') continue;
      const amt = dealAmount(o);
      if (o.stage !== 'invoiced' && o.stage !== 'closed_won') pipeline += amt;
      if (showCommission && amt > 0) {
        const c = calculateCommission(amt, { tiers }).commissionAmount;
        commission += c;
        if (!isTerminal(o.stage || '')) {
          weightedComm += (c * probabilityPct(o)) / 100;
        } else if (o.stage !== 'closed_lost') {
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
      <p className="text-xs text-neutral-500">
        <strong className="text-slate-700">Drag cards</strong> between columns to change stage —
        or use the quick-move chips. Move to <strong>Won</strong> when the deal is accepted, then{' '}
        <strong>Invoiced</strong> when billed.
      </p>

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
            const isDropTarget = overStage === stage.value && draggingId != null;

            return (
              <div
                key={stage.value}
                className={`w-[280px] flex-shrink-0 border rounded-3xl overflow-hidden transition-all ${
                  isDropTarget
                    ? 'bg-sky-50 border-[#00b4d8] ring-2 ring-[#00b4d8]/30'
                    : 'bg-neutral-50 border-neutral-200'
                }`}
                onDragOver={(e) => {
                  if (!onMove) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setOverStage(stage.value);
                }}
                onDragLeave={() => {
                  setOverStage((cur) => (cur === stage.value ? null : cur));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = Number(
                    e.dataTransfer.getData('text/opportunity-id') ||
                      e.dataTransfer.getData('text/plain')
                  );
                  setDraggingId(null);
                  setOverStage(null);
                  if (!onMove || !Number.isFinite(id) || id <= 0) return;
                  const card = opportunities.find((o) => o.id === id);
                  if (!card || card.stage === stage.value) return;
                  onMove(id, stage.value);
                }}
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
                  className={`p-2 space-y-2 overflow-y-auto min-h-[120px] ${
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
                      comm && !isTerminal(o.stage || '')
                        ? (comm.commissionAmount * prob) / 100
                        : comm?.commissionAmount ?? 0;
                    const isDragging = draggingId === o.id;

                    return (
                      <div
                        key={o.id}
                        draggable={Boolean(onMove)}
                        onDragStart={(e) => {
                          if (!onMove) return;
                          e.dataTransfer.setData('text/opportunity-id', String(o.id));
                          e.dataTransfer.setData('text/plain', String(o.id));
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggingId(o.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setOverStage(null);
                        }}
                        className={`bg-white border rounded-2xl p-3 shadow-sm transition-all ${
                          onMove ? 'cursor-grab active:cursor-grabbing' : ''
                        } ${
                          isDragging
                            ? 'opacity-40 border-dashed border-[#00b4d8]'
                            : 'hover:border-[#00b4d8]/40'
                        }`}
                      >
                        <div className="flex items-start gap-1.5">
                          {onMove && (
                            <GripVertical
                              className="w-3.5 h-3.5 text-neutral-300 mt-0.5 shrink-0"
                              aria-hidden
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm leading-snug text-slate-900">
                              {o.name}
                            </div>
                            <div className="text-xs text-neutral-500 mt-0.5">
                              {o.company_name || o.contact_name || '—'}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm font-bold text-emerald-700 mt-1">
                          {formatMoney(amt, o.currency || 'ZAR')}
                        </div>
                        <div className="text-[10px] text-neutral-400 mt-0.5">
                          Weighted{' '}
                          {formatMoney(o.weighted_amount ?? (amt * prob) / 100)}
                        </div>

                        {/* Team owner + expected close (sales portal) */}
                        {(onAssignOwner || onSetCloseDate || o.owner_name || o.sales_rep_user_id) && (
                          <div className="mt-2 space-y-1.5">
                            {onAssignOwner && teamMembers.length > 0 ? (
                              <label className="block">
                                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-0.5 mb-0.5">
                                  <User className="w-2.5 h-2.5" /> Team owner
                                </span>
                                <select
                                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-800"
                                  value={
                                    (o as { sales_rep_user_id?: string | null })
                                      .sales_rep_user_id || ''
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const uid = e.target.value || null;
                                    const name = uid
                                      ? teamMembers.find((m) => m.user_id === uid)
                                          ?.name || null
                                      : null;
                                    onAssignOwner(o.id, uid, name);
                                  }}
                                >
                                  <option value="">Unassigned</option>
                                  {teamMembers.map((m) => (
                                    <option key={m.user_id} value={m.user_id}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : (
                              (o.owner_name ||
                                memberName(
                                  (o as { sales_rep_user_id?: string | null })
                                    .sales_rep_user_id
                                )) && (
                                <div className="text-[10px] text-slate-600 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {o.owner_name ||
                                    memberName(
                                      (o as { sales_rep_user_id?: string | null })
                                        .sales_rep_user_id
                                    )}
                                </div>
                              )
                            )}
                            {onSetCloseDate ? (
                              <label className="block">
                                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-0.5 mb-0.5">
                                  <Calendar className="w-2.5 h-2.5" /> Expected land
                                </span>
                                <input
                                  type="date"
                                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-800"
                                  value={o.expected_close_date || ''}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    onSetCloseDate(
                                      o.id,
                                      e.target.value || null
                                    );
                                  }}
                                />
                              </label>
                            ) : (
                              <div className="text-[10px] text-neutral-500">
                                Close {o.expected_close_date || '—'}
                              </div>
                            )}
                          </div>
                        )}

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
                            {!isTerminal(o.stage || '') && (
                              <div className="text-[10px] text-amber-900/70 mt-0.5">
                                If stage holds (~{prob}%):{' '}
                                <strong>{formatZarPrecise(weightedEarn)}</strong>
                              </div>
                            )}
                            {o.stage === 'invoiced' && (
                              <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                                Invoiced · deal processed
                              </div>
                            )}
                            {o.stage === 'closed_won' && (
                              <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                                Won · drag to Invoiced when billed
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
                            {/* Priority quick moves toward close / invoice */}
                            {(
                              [
                                'proposal',
                                'negotiation',
                                'closed_won',
                                'invoiced',
                                'closed_lost',
                              ] as const
                            )
                              .filter((v) => v !== o.stage)
                              .map((v) => {
                                const s = OPPORTUNITY_STAGES.find((x) => x.value === v)!;
                                return (
                                  <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => onMove(o.id, s.value)}
                                    className="text-[9px] px-1.5 py-0.5 rounded-full border bg-neutral-50 hover:bg-sky-50 hover:border-sky-200"
                                    title={`Move to ${s.label}`}
                                  >
                                    → {s.label}
                                  </button>
                                );
                              })}
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
                    <div className="text-center text-[11px] text-neutral-400 py-6">
                      {isDropTarget ? 'Drop here' : 'Empty — drop cards here'}
                    </div>
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
