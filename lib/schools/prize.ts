/**
 * Headmaster prize scorecard — incentivise approved-brand procurement.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PRIZE_WEIGHTS } from '@/lib/schools/types';
import { computeFeedingCompletenessPct } from '@/lib/schools/process';

export type PrizeInputs = {
  /** % of kitchen spend / receipts on approved brands (0–100) */
  approvedBrandPct: number;
  /** Count of non-approved receive attempts in period */
  nonApprovedEvents: number;
  /** Menu adherence 0–100 (default 100 if not tracked) */
  menuAdherencePct: number;
  /** Feeding days with log / school days * 100 */
  feedingCompletenessPct: number;
  /** Stock discipline proxy 0–100 */
  stockDisciplinePct: number;
  /** Data quality: verified learners % etc. */
  dataQualityPct: number;
};

export type PrizeBreakdown = {
  approvedBrand: number;
  zeroNonapproved: number;
  menuAdherence: number;
  feedingCompleteness: number;
  stockDiscipline: number;
  dataQuality: number;
  total: number;
  inputs: PrizeInputs;
};

function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(lo, Math.min(hi, n));
}

export function computePrizeScore(input: PrizeInputs): PrizeBreakdown {
  const approvedBrandPct = clamp(input.approvedBrandPct);
  const menuAdherencePct = clamp(input.menuAdherencePct);
  const feedingCompletenessPct = clamp(input.feedingCompletenessPct);
  const stockDisciplinePct = clamp(input.stockDisciplinePct);
  const dataQualityPct = clamp(input.dataQualityPct);

  // Full pillar if zero non-approved events; else step down
  let zeroNonapprovedScore = 100;
  if (input.nonApprovedEvents > 0) {
    zeroNonapprovedScore = clamp(100 - input.nonApprovedEvents * 25);
  }

  const approvedBrand =
    (approvedBrandPct / 100) * PRIZE_WEIGHTS.approvedBrand;
  const zeroNonapproved =
    (zeroNonapprovedScore / 100) * PRIZE_WEIGHTS.zeroNonapproved;
  const menuAdherence =
    (menuAdherencePct / 100) * PRIZE_WEIGHTS.menuAdherence;
  const feedingCompleteness =
    (feedingCompletenessPct / 100) * PRIZE_WEIGHTS.feedingCompleteness;
  const stockDiscipline =
    (stockDisciplinePct / 100) * PRIZE_WEIGHTS.stockDiscipline;
  const dataQuality = (dataQualityPct / 100) * PRIZE_WEIGHTS.dataQuality;

  const total =
    Math.round(
      (approvedBrand +
        zeroNonapproved +
        menuAdherence +
        feedingCompleteness +
        stockDiscipline +
        dataQuality) *
        10
    ) / 10;

  return {
    approvedBrand: Math.round(approvedBrand * 10) / 10,
    zeroNonapproved: Math.round(zeroNonapproved * 10) / 10,
    menuAdherence: Math.round(menuAdherence * 10) / 10,
    feedingCompleteness: Math.round(feedingCompleteness * 10) / 10,
    stockDiscipline: Math.round(stockDiscipline * 10) / 10,
    dataQuality: Math.round(dataQuality * 10) / 10,
    total,
    inputs: {
      approvedBrandPct,
      nonApprovedEvents: input.nonApprovedEvents,
      menuAdherencePct,
      feedingCompletenessPct,
      stockDisciplinePct,
      dataQualityPct,
    },
  };
}

export function currentQuarterPeriod(d = new Date()): {
  year: number;
  quarter: number;
  starts_on: string;
  ends_on: string;
  name: string;
} {
  const year = d.getFullYear();
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  const startMonth = (quarter - 1) * 3;
  const starts = new Date(year, startMonth, 1);
  const ends = new Date(year, startMonth + 3, 0);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return {
    year,
    quarter,
    starts_on: iso(starts),
    ends_on: iso(ends),
    name: `Q${quarter} ${year} Headmaster Prize`,
  };
}

/**
 * Live prize snapshot for a school in the current quarter (lightweight).
 * Used after GRN receive to show score delta without full prizes page.
 */
export async function livePrizeSnapshot(
  supabase: SupabaseClient,
  opts: { schoolProfileId: number; companyId: number }
): Promise<{
  total: number;
  approvedBrandPct: number;
  nonApprovedEvents: number;
  periodName: string;
} | null> {
  try {
    const q = currentQuarterPeriod();
    const from = q.starts_on;
    const to = q.ends_on;

    const [receiptsRes, feedingRes] = await Promise.all([
      supabase
        .from('school_kitchen_receipts')
        .select('compliance_ok, lines, received_at')
        .eq('school_profile_id', opts.schoolProfileId)
        .gte('received_at', from)
        .lte('received_at', to)
        .limit(500),
      supabase
        .from('school_feeding_days')
        .select('feed_date, served_meals, planned_meals')
        .eq('school_profile_id', opts.schoolProfileId)
        .gte('feed_date', from)
        .lte('feed_date', to)
        .limit(500),
    ]);

    const receipts = receiptsRes.data || [];
    let approvedLines = 0;
    let totalLines = 0;
    let nonApprovedEvents = 0;
    for (const r of receipts) {
      if (r.compliance_ok === false) nonApprovedEvents += 1;
      const lines = Array.isArray(r.lines) ? r.lines : [];
      for (const l of lines as Array<{ approved?: boolean }>) {
        totalLines += 1;
        if (l.approved !== false) approvedLines += 1;
      }
    }
    const approvedBrandPct =
      totalLines > 0 ? (approvedLines / totalLines) * 100 : 100;

    const feedingCompletenessPct = computeFeedingCompletenessPct(
      feedingRes.data || [],
      from,
      to
    );

    const breakdown = computePrizeScore({
      approvedBrandPct,
      nonApprovedEvents,
      menuAdherencePct: 100,
      feedingCompletenessPct,
      stockDisciplinePct: nonApprovedEvents === 0 ? 100 : 70,
      dataQualityPct: 50,
    });

    return {
      total: breakdown.total,
      approvedBrandPct: Math.round(approvedBrandPct * 10) / 10,
      nonApprovedEvents,
      periodName: q.name,
    };
  } catch {
    return null;
  }
}

export function formatPrizeDelta(before: number | null, after: number | null): {
  delta: number | null;
  message: string;
} {
  if (before == null || after == null) {
    return { delta: null, message: 'Prize score updated' };
  }
  const delta = Math.round((after - before) * 10) / 10;
  if (delta > 0) {
    return {
      delta,
      message: `Prize +${delta.toFixed(1)} pts this quarter (now ${after.toFixed(1)})`,
    };
  }
  if (delta < 0) {
    return {
      delta,
      message: `Prize ${delta.toFixed(1)} pts this quarter (now ${after.toFixed(1)}) — off-catalogue hurts score`,
    };
  }
  return {
    delta: 0,
    message: `Prize score holds at ${after.toFixed(1)} pts this quarter`,
  };
}
