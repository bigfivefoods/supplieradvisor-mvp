/**
 * Variation lines, decisions, and extension of time.
 * Approving days updates eot_days and does not edit planned dates.
 */
import { money, type ConstructionVariation, type ConstructiongraphStore } from './constructiongraph';
import { applyEotDays } from './programme-model';

export type VariationLine = {
  description: string;
  qty: number;
  uom: string;
  rate?: number;
  amount?: number;
};

export type VariationDecision = 'approved' | 'rejected' | 'queried';

export function lineAmount(line: VariationLine): number {
  if (line.rate == null && line.amount != null) return money(line.amount);
  return money(line.qty) * money(line.rate);
}

export function variationTotal(row: ConstructionVariation): number {
  if (Array.isArray(row.lines) && row.lines.length) {
    return row.lines.reduce((sum, line) => sum + lineAmount(line), 0);
  }
  return money(row.amount);
}

export function decideVariation(
  store: ConstructiongraphStore,
  input: {
    id: string;
    decision: VariationDecision;
    name?: string;
    note?: string;
    date: string;
  }
): { ok: true; store: ConstructiongraphStore } | { ok: false; error: string } {
  const current = store.variations.find((row) => row.id === input.id);
  if (!current) return { ok: false, error: 'Variation not found' };
  if (input.decision !== 'approved' && input.decision !== 'rejected' && input.decision !== 'queried') {
    return { ok: false, error: 'Decision not recognised' };
  }
  const variations = store.variations.map((row) => {
    if (row.id !== input.id) return row;
    const total = variationTotal(row);
    return {
      ...row,
      status: input.decision,
      amount: row.lines?.length ? total : row.amount,
      decided_on: input.date,
      decided_by_name: input.name || '',
      decision_note: input.note || '',
    };
  });
  let programme = store.programme.map((row) => ({ ...row }));
  if (input.decision === 'approved') {
    const days = Number(current.days) || 0;
    const links = current.programme_row_ids || [];
    programme = applyEotDays(programme, links, days);
  }
  return { ok: true, store: { ...store, variations, programme } };
}
