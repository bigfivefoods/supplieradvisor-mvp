/**
 * Period forecast from the Sales pipeline (opportunities).
 * Slice is expected close (or won date) inside [from, to].
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { round2 } from '@/lib/accounting/server';
import { monthsInRange } from '@/lib/accounting/cash-flow-ias7';
import {
  OPPORTUNITY_STAGES,
  stageProbability,
} from '@/lib/customers/types';

export type PipelineOpp = {
  id: number;
  name?: string | null;
  stage?: string | null;
  status?: string | null;
  amount?: number | null;
  opportunity_size?: number | null;
  probability?: number | null;
  expected_close_date?: string | null;
  estimated_date?: string | null;
  actual_close_date?: string | null;
  created_at?: string | null;
  company_name?: string | null;
  currency?: string | null;
};

export type PipelineForecastDeal = {
  id: number;
  name: string;
  company_name: string | null;
  stage: string;
  kind: 'open' | 'won' | 'lost';
  amount: number;
  probability: number;
  weighted: number;
  close_date: string | null;
  month: string | null;
  overdue: boolean;
  currency: string;
};

export type PipelineForecastMonth = {
  month: string;
  expected: number;
  weighted: number;
  won: number;
  lost: number;
  deals: number;
};

export type PipelineForecastStage = {
  stage: string;
  label: string;
  amount: number;
  weighted: number;
  count: number;
};

export type PipelineForecast = {
  from: string;
  to: string;
  summary: {
    expected: number;
    weighted: number;
    won: number;
    lost: number;
    openDeals: number;
    wonDeals: number;
    lostDeals: number;
  };
  months: PipelineForecastMonth[];
  stages: PipelineForecastStage[];
  rows: PipelineForecastDeal[];
  warning?: string;
};

const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  OPPORTUNITY_STAGES.map((s) => [s.value, s.label])
);

export function normalizeStage(stage: string | null | undefined, status?: string | null): string {
  const raw = String(stage || status || 'prospecting')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (raw === 'won') return 'closed_won';
  if (raw === 'lost') return 'closed_lost';
  return raw;
}

export function dealKind(stage: string): 'open' | 'won' | 'lost' {
  if (stage === 'closed_won' || stage === 'invoiced') return 'won';
  if (stage === 'closed_lost') return 'lost';
  return 'open';
}

export function closeDateFor(o: PipelineOpp, kind: 'open' | 'won' | 'lost'): string | null {
  const raw =
    kind === 'won'
      ? o.actual_close_date || o.expected_close_date || o.estimated_date
      : o.expected_close_date || o.estimated_date || o.created_at;
  if (!raw) return null;
  const d = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : String(raw).slice(0, 10);
}

export function buildPipelineForecastFromRows(opts: {
  rows: PipelineOpp[];
  from: string;
  to: string;
}): PipelineForecast {
  const months = monthsInRange(opts.from, opts.to);
  const byMonth = new Map<string, PipelineForecastMonth>();
  for (const month of months) {
    byMonth.set(month, {
      month,
      expected: 0,
      weighted: 0,
      won: 0,
      lost: 0,
      deals: 0,
    });
  }
  const first = months[0] || opts.from.slice(0, 7);
  const stageMap = new Map<string, PipelineForecastStage>();
  const deals: PipelineForecastDeal[] = [];

  for (const o of opts.rows) {
    const amount = Number(o.amount ?? o.opportunity_size ?? 0);
    if (!(amount > 0)) continue;
    const stage = normalizeStage(o.stage, o.status);
    const kind = dealKind(stage);
    const prob =
      o.probability != null && Number(o.probability) > 0
        ? Number(o.probability)
        : stageProbability(stage);
    const close = closeDateFor(o, kind);
    let month = close ? close.slice(0, 7) : null;
    let overdue = false;
    if (kind === 'open') {
      if (!month || month < first) {
        month = first;
        overdue = Boolean(close && close < opts.from);
      }
    }
    if (!month || !byMonth.has(month)) continue;
    if (close && kind !== 'open') {
      if (close < opts.from || close > opts.to) continue;
    } else if (kind === 'open' && close && close > opts.to) {
      continue;
    }

    const weighted = kind === 'won' ? amount : kind === 'lost' ? 0 : round2((amount * prob) / 100);
    const bucket = byMonth.get(month)!;
    bucket.deals += 1;
    if (kind === 'won') bucket.won += amount;
    else if (kind === 'lost') bucket.lost += amount;
    else {
      bucket.expected += amount;
      bucket.weighted += weighted;
    }

    if (kind === 'open') {
      const st = stageMap.get(stage) || {
        stage,
        label: STAGE_LABEL[stage] || stage.replace(/_/g, ' '),
        amount: 0,
        weighted: 0,
        count: 0,
      };
      st.amount += amount;
      st.weighted += weighted;
      st.count += 1;
      stageMap.set(stage, st);
    }

    deals.push({
      id: Number(o.id),
      name: String(o.name || `Deal #${o.id}`),
      company_name: o.company_name ? String(o.company_name) : null,
      stage,
      kind,
      amount: round2(amount),
      probability: round2(prob),
      weighted: round2(weighted),
      close_date: close,
      month,
      overdue,
      currency: String(o.currency || 'ZAR'),
    });
  }

  const monthRows = months.map((m) => {
    const b = byMonth.get(m)!;
    return {
      ...b,
      expected: round2(b.expected),
      weighted: round2(b.weighted),
      won: round2(b.won),
      lost: round2(b.lost),
    };
  });

  deals.sort((a, b) => {
    const da = a.close_date || '';
    const db = b.close_date || '';
    if (da !== db) return da.localeCompare(db);
    return b.weighted - a.weighted;
  });

  const open = deals.filter((d) => d.kind === 'open');
  const won = deals.filter((d) => d.kind === 'won');
  const lost = deals.filter((d) => d.kind === 'lost');

  return {
    from: opts.from,
    to: opts.to,
    summary: {
      expected: round2(open.reduce((s, d) => s + d.amount, 0)),
      weighted: round2(open.reduce((s, d) => s + d.weighted, 0)),
      won: round2(won.reduce((s, d) => s + d.amount, 0)),
      lost: round2(lost.reduce((s, d) => s + d.amount, 0)),
      openDeals: open.length,
      wonDeals: won.length,
      lostDeals: lost.length,
    },
    months: monthRows,
    stages: [...stageMap.values()]
      .map((s) => ({
        ...s,
        amount: round2(s.amount),
        weighted: round2(s.weighted),
      }))
      .sort((a, b) => b.amount - a.amount),
    rows: deals,
  };
}

export async function buildPipelineForecast(opts: {
  profileId: number;
  from: string;
  to: string;
}): Promise<PipelineForecast> {
  const supabase = getSupabaseServer();
  const { loadHoldingSubtree } = await import(
    '@/lib/business/holding-pipeline'
  );
  const tree = await loadHoldingSubtree(opts.profileId);
  const { data, error } = await supabase
    .from('opportunities')
    .select(
      'id, name, stage, status, amount, opportunity_size, probability, expected_close_date, estimated_date, actual_close_date, company_name, currency, created_at'
    )
    .in('profile_id', tree.ids)
    .limit(2000);

  const pack = buildPipelineForecastFromRows({
    rows: (data || []) as PipelineOpp[],
    from: opts.from,
    to: opts.to,
  });
  if (error) pack.warning = error.message;
  return pack;
}
