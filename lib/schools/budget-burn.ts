/**
 * Category budget burn vs remaining feeding calendar days.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type BudgetBurnRow = {
  category: string;
  budget_amount: number;
  spent_amount: number;
  remaining_amount: number;
  burn_pct: number;
  feeding_days_total: number;
  feeding_days_done: number;
  feeding_days_left: number;
  /** Suggested max spend per remaining day */
  per_day_left: number | null;
  status: 'ok' | 'watch' | 'over';
  period_from: string;
  period_to: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function countWeekdaysInclusive(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  if (b < a) return 0;
  let n = 0;
  const d = new Date(a);
  while (d <= b) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) n += 1;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

export async function buildBudgetBurn(
  supabase: SupabaseClient,
  opts: {
    agencyProfileId: number;
    schoolProfileId?: number | null;
    from?: string;
    to?: string;
  }
): Promise<{ rows: BudgetBurnRow[]; tip: string }> {
  const from =
    opts.from ||
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10);
  const to =
    opts.to ||
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);
  const todayStr = today();

  const { data: budgets } = await supabase
    .from('nsnp_category_budgets')
    .select('*')
    .eq('agency_profile_id', opts.agencyProfileId)
    .lte('period_from', to)
    .gte('period_to', from)
    .limit(50);

  // Spend from school POs (lines by category if available, else total split later)
  let poQuery = supabase
    .from('school_purchase_orders')
    .select('id, total_amount, lines, order_date, school_profile_id')
    .gte('order_date', from)
    .lte('order_date', to)
    .limit(500);
  if (opts.schoolProfileId) {
    poQuery = poQuery.eq('school_profile_id', opts.schoolProfileId);
  }
  const { data: pos } = await poQuery;

  const spendByCat = new Map<string, number>();
  let uncategorised = 0;
  for (const p of pos || []) {
    const lines = Array.isArray(p.lines)
      ? (p.lines as Array<Record<string, unknown>>)
      : [];
    if (!lines.length) {
      uncategorised += Number(p.total_amount || 0);
      continue;
    }
    for (const l of lines) {
      const cat = String(l.category || l.product_category || 'other')
        .toLowerCase()
        .trim() || 'other';
      const lineTotal =
        Number(l.qty || 0) * Number(l.unit_price || 0) ||
        Number(l.line_total || 0) ||
        0;
      spendByCat.set(cat, (spendByCat.get(cat) || 0) + lineTotal);
    }
  }

  // Feeding calendar / weekdays in period
  let feedingDaysTotal = countWeekdaysInclusive(from, to);
  try {
    const { data: cal } = await supabase
      .from('nsnp_feeding_calendars')
      .select('service_days, year, metadata')
      .eq('agency_profile_id', opts.agencyProfileId)
      .limit(5);
    // soft: if calendar has explicit day count for months, leave weekdays as basis
    void cal;
  } catch {
    /* soft */
  }

  const daysDone = countWeekdaysInclusive(
    from,
    todayStr < to ? todayStr : to
  );
  const daysLeft = Math.max(0, feedingDaysTotal - daysDone);

  const rows: BudgetBurnRow[] = [];
  for (const b of budgets || []) {
    const cat = String(b.category || 'other').toLowerCase();
    const budget = Number(b.amount || b.budget_amount || b.limit_amount || 0);
    let spent = spendByCat.get(cat) || 0;
    // Soft: if only one budget category and uncategorised spend, attach it
    if ((budgets || []).length === 1 && uncategorised > 0) {
      spent += uncategorised;
      uncategorised = 0;
    }
    const remaining = Math.round((budget - spent) * 100) / 100;
    const burn_pct =
      budget > 0 ? Math.round((spent / budget) * 1000) / 10 : 0;
    let status: BudgetBurnRow['status'] = 'ok';
    if (burn_pct >= 100 || remaining < 0) status = 'over';
    else if (burn_pct >= 80 || (daysLeft > 0 && remaining / daysLeft < spent / Math.max(1, daysDone) * 0.5))
      status = 'watch';

    rows.push({
      category: String(b.category || cat),
      budget_amount: budget,
      spent_amount: Math.round(spent * 100) / 100,
      remaining_amount: remaining,
      burn_pct,
      feeding_days_total: feedingDaysTotal,
      feeding_days_done: daysDone,
      feeding_days_left: daysLeft,
      per_day_left:
        daysLeft > 0
          ? Math.round((Math.max(0, remaining) / daysLeft) * 100) / 100
          : null,
      status,
      period_from: String(b.period_from || from).slice(0, 10),
      period_to: String(b.period_to || to).slice(0, 10),
    });
  }

  rows.sort((a, b) => b.burn_pct - a.burn_pct);
  const over = rows.filter((r) => r.status === 'over').length;
  const tip =
    rows.length === 0
      ? 'No category budgets set — DBE can add them under Recipes → Budgets.'
      : over > 0
        ? `${over} categor(y/ies) over budget — slow orders or reallocate.`
        : `Track spend vs ${daysLeft} feeding day(s) left in period.`;

  return { rows, tip };
}
