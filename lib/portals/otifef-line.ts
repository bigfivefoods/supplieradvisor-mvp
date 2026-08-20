/**
 * Per-order OTIFEF using the same formula as the supplier scorecards.
 */
import { computeOtifef, clampPct, type OtifefMetrics } from '@/lib/suppliers/types';

export type OtifefLineInput = {
  promised_date?: string | null;
  actual_date?: string | null;
  ordered?: number | null;
  delivered?: number | null;
  damaged?: number | null;
};

export type OtifefLine = {
  overall: number | null;
  onTime: number | null;
  inFull: number | null;
  errorFree: number | null;
  onTimeFlag: boolean | null;
  pending: boolean;
};

export function otifefForLine(input: OtifefLineInput): OtifefLine {
  const promised = input.promised_date ? String(input.promised_date).slice(0, 10) : '';
  const actual = input.actual_date ? String(input.actual_date).slice(0, 10) : '';
  const ordered = Number(input.ordered || 0);
  const delivered = Number(input.delivered || 0);
  const damaged = Number(input.damaged || 0);

  const hasDelivery = Boolean(actual) || delivered > 0;
  if (!hasDelivery) {
    return {
      overall: null,
      onTime: null,
      inFull: null,
      errorFree: null,
      onTimeFlag: null,
      pending: true,
    };
  }

  const onTimeFlag = promised && actual ? actual <= promised : null;
  const onTime = onTimeFlag == null ? null : onTimeFlag ? 100 : 0;
  const inFull = ordered > 0 ? clampPct((delivered / ordered) * 100) : delivered > 0 ? 100 : 0;
  const errorFree =
    delivered > 0 ? clampPct(((delivered - damaged) / delivered) * 100) : 100;
  const overall = computeOtifef({
    onTimePct: onTime ?? 100,
    inFullPct: inFull,
    errorFreePct: errorFree,
  });
  return {
    overall,
    onTime,
    inFull,
    errorFree,
    onTimeFlag,
    pending: false,
  };
}

export function rollupOtifef(lines: OtifefLine[]): OtifefMetrics {
  const done = lines.filter((l) => !l.pending && l.overall != null);
  if (!done.length) {
    return {
      overall: 0,
      onTime: 0,
      inFull: 0,
      errorFree: 0,
      totalPOs: lines.length,
      supplierCount: 0,
    };
  }
  const avg = (pick: (l: OtifefLine) => number | null) => {
    const nums = done.map(pick).filter((n): n is number => n != null);
    if (!nums.length) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };
  return {
    overall: avg((l) => l.overall),
    onTime: avg((l) => l.onTime),
    inFull: avg((l) => l.inFull),
    errorFree: avg((l) => l.errorFree),
    totalPOs: lines.length,
    supplierCount: 1,
  };
}
