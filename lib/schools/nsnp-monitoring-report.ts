/**
 * Aggregations for the NSNP Monitoring Tool report (slice & dice + charts).
 */

export type MonitoringReportRow = {
  id: number;
  visit_date: string | null;
  status: string;
  monitor_name: string | null;
  school_profile_id: number | null;
  school_name: string | null;
  emis_number: string | null;
  district: string | null;
  circuit: string | null;
  province: string | null;
  quintile: string | number | null;
  overall_kpi: number | null;
  rkmp_score: number | null;
  nehs_score: number | null;
  gardens_score: number | null;
  traffic_light: string | null;
  feeding_today: string | null;
  food_groups_served: number | null;
  breakfast_served: string | null;
  sp_name: string | null;
  nsnp_learners: number | null;
  learners_eating: number | null;
  peu_visit_id: number | null;
  submitted_at: string | null;
};

export type MonitoringReportSummary = {
  total: number;
  submitted: number;
  drafts: number;
  avg_kpi: number | null;
  avg_rkmp: number | null;
  avg_nehs: number | null;
  avg_gardens: number | null;
  green: number;
  yellow: number;
  red: number;
  feeding_yes: number;
  feeding_no: number;
  feeding_unknown: number;
  breakfast_yes: number;
  breakfast_no: number;
  with_peu_link: number;
  schools_visited: number;
  monitors: number;
};

export type NamedCount = { name: string; count: number; avg_kpi?: number | null };
export type TimePoint = { period: string; count: number; avg_kpi: number | null };

export type MonitoringReportPayload = {
  summary: MonitoringReportSummary;
  traffic: NamedCount[];
  byDistrict: NamedCount[];
  byCircuit: NamedCount[];
  byQuintile: NamedCount[];
  byMonitor: NamedCount[];
  byMonth: TimePoint[];
  kpiBands: NamedCount[];
  scoreAverages: Array<{ name: string; value: number }>;
  topSchools: NamedCount[];
  bottomSchools: NamedCount[];
  feeding: NamedCount[];
  breakfast: NamedCount[];
  rows: MonitoringReportRow[];
  facets: {
    districts: string[];
    circuits: string[];
    quintiles: string[];
    monitors: string[];
    traffic: string[];
    statuses: string[];
  };
};

function n(v: unknown): number | null {
  if (v == null || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function monthKey(d: string | null): string {
  if (!d) return 'Unknown';
  return String(d).slice(0, 7); // YYYY-MM
}

function groupAvg(
  rows: MonitoringReportRow[],
  keyFn: (r: MonitoringReportRow) => string
): NamedCount[] {
  const map = new Map<string, number[]>();
  for (const r of rows) {
    const k = keyFn(r) || '—';
    const list = map.get(k) || [];
    if (r.overall_kpi != null) list.push(Number(r.overall_kpi));
    else list.push(NaN);
    map.set(k, list);
  }
  return Array.from(map.entries())
    .map(([name, vals]) => {
      const kpiVals = vals.filter((x) => Number.isFinite(x));
      return {
        name,
        count: vals.length,
        avg_kpi: avg(kpiVals),
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function buildMonitoringReport(
  rowsIn: MonitoringReportRow[]
): MonitoringReportPayload {
  const rows = [...rowsIn];

  const kpiVals = rows
    .map((r) => r.overall_kpi)
    .filter((x): x is number => x != null && Number.isFinite(x));
  const rkmpVals = rows
    .map((r) => r.rkmp_score)
    .filter((x): x is number => x != null && Number.isFinite(x));
  const nehsVals = rows
    .map((r) => r.nehs_score)
    .filter((x): x is number => x != null && Number.isFinite(x));
  const gardenVals = rows
    .map((r) => r.gardens_score)
    .filter((x): x is number => x != null && Number.isFinite(x));

  let green = 0;
  let yellow = 0;
  let red = 0;
  let feeding_yes = 0;
  let feeding_no = 0;
  let feeding_unknown = 0;
  let breakfast_yes = 0;
  let breakfast_no = 0;
  let with_peu_link = 0;
  let submitted = 0;
  let drafts = 0;
  const schoolSet = new Set<string>();
  const monitorSet = new Set<string>();

  for (const r of rows) {
    const tl = String(r.traffic_light || '').toLowerCase();
    if (tl === 'green') green++;
    else if (tl === 'yellow') yellow++;
    else if (tl === 'red') red++;

    const f = String(r.feeding_today || '').toLowerCase();
    if (f === 'yes') feeding_yes++;
    else if (f === 'no') feeding_no++;
    else feeding_unknown++;

    const b = String(r.breakfast_served || '').toLowerCase();
    if (b === 'yes') breakfast_yes++;
    else if (b === 'no') breakfast_no++;

    if (r.peu_visit_id != null) with_peu_link++;
    if (String(r.status) === 'submitted') submitted++;
    else drafts++;

    if (r.school_name || r.school_profile_id) {
      schoolSet.add(String(r.school_profile_id || r.school_name));
    }
    if (r.monitor_name) monitorSet.add(String(r.monitor_name));
  }

  const summary: MonitoringReportSummary = {
    total: rows.length,
    submitted,
    drafts,
    avg_kpi: avg(kpiVals),
    avg_rkmp: avg(rkmpVals),
    avg_nehs: avg(nehsVals),
    avg_gardens: avg(gardenVals),
    green,
    yellow,
    red,
    feeding_yes,
    feeding_no,
    feeding_unknown,
    breakfast_yes,
    breakfast_no,
    with_peu_link,
    schools_visited: schoolSet.size,
    monitors: monitorSet.size,
  };

  const traffic: NamedCount[] = [
    { name: 'Green', count: green },
    { name: 'Yellow', count: yellow },
    { name: 'Red', count: red },
  ];

  const feeding: NamedCount[] = [
    { name: 'Feeding yes', count: feeding_yes },
    { name: 'Feeding no', count: feeding_no },
    { name: 'Unknown', count: feeding_unknown },
  ];

  const breakfast: NamedCount[] = [
    { name: 'Breakfast yes', count: breakfast_yes },
    { name: 'Breakfast no', count: breakfast_no },
  ];

  // KPI bands
  const bands = [
    { name: '81–100 Green', min: 81, max: 100 },
    { name: '50–80 Yellow', min: 50, max: 80.999 },
    { name: '0–49 Red', min: 0, max: 49.999 },
    { name: 'No score', min: null as number | null, max: null as number | null },
  ];
  const kpiBands: NamedCount[] = bands.map((b) => {
    if (b.min == null) {
      return {
        name: b.name,
        count: rows.filter((r) => r.overall_kpi == null).length,
      };
    }
    return {
      name: b.name,
      count: rows.filter(
        (r) =>
          r.overall_kpi != null &&
          r.overall_kpi >= b.min! &&
          r.overall_kpi <= b.max!
      ).length,
    };
  });

  // By month
  const monthMap = new Map<string, number[]>();
  for (const r of rows) {
    const k = monthKey(r.visit_date);
    const list = monthMap.get(k) || [];
    if (r.overall_kpi != null) list.push(Number(r.overall_kpi));
    else list.push(NaN);
    monthMap.set(k, list);
  }
  const byMonth: TimePoint[] = Array.from(monthMap.entries())
    .map(([period, vals]) => ({
      period,
      count: vals.length,
      avg_kpi: avg(vals.filter((x) => Number.isFinite(x))),
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  // School ranking by avg KPI (min 1 visit)
  const schoolGroups = groupAvg(rows, (r) =>
    String(r.school_name || `School #${r.school_profile_id || '?'}`)
  ).filter((x) => x.avg_kpi != null);
  const ranked = [...schoolGroups].sort(
    (a, b) => (b.avg_kpi ?? 0) - (a.avg_kpi ?? 0)
  );

  const facets = {
    districts: uniq(rows.map((r) => r.district)),
    circuits: uniq(rows.map((r) => r.circuit)),
    quintiles: uniq(
      rows.map((r) => (r.quintile != null ? String(r.quintile) : null))
    ),
    monitors: uniq(rows.map((r) => r.monitor_name)),
    traffic: ['green', 'yellow', 'red'],
    statuses: uniq(rows.map((r) => r.status)),
  };

  return {
    summary,
    traffic,
    byDistrict: groupAvg(rows, (r) => String(r.district || '—')).slice(0, 20),
    byCircuit: groupAvg(rows, (r) => String(r.circuit || '—')).slice(0, 20),
    byQuintile: groupAvg(rows, (r) =>
      r.quintile != null ? `Q${r.quintile}` : '—'
    ),
    byMonitor: groupAvg(rows, (r) => String(r.monitor_name || '—')).slice(0, 15),
    byMonth,
    kpiBands,
    scoreAverages: [
      { name: 'KPI /100', value: summary.avg_kpi ?? 0 },
      { name: 'RKMP /20', value: summary.avg_rkmp ?? 0 },
      { name: 'NEHS /20', value: summary.avg_nehs ?? 0 },
      { name: 'Gardens /10', value: summary.avg_gardens ?? 0 },
    ],
    topSchools: ranked.slice(0, 10),
    bottomSchools: [...ranked].reverse().slice(0, 10),
    feeding,
    breakfast,
    rows: rows.slice(0, 500),
    facets,
  };
}

function uniq(vals: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      vals
        .map((v) => (v == null ? '' : String(v).trim()))
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function rowFromVisit(v: Record<string, unknown>): MonitoringReportRow {
  const fd = (v.form_data || {}) as Record<string, unknown>;
  const scores = (v.scores || {}) as Record<string, unknown>;
  return {
    id: Number(v.id),
    visit_date: v.visit_date != null ? String(v.visit_date).slice(0, 10) : null,
    status: String(v.status || 'draft'),
    monitor_name:
      (v.monitor_name as string) ||
      (fd.a6_monitor_name as string) ||
      null,
    school_profile_id:
      v.school_profile_id != null ? Number(v.school_profile_id) : null,
    school_name:
      (v.school_name as string) || (fd.a1_school_name as string) || null,
    emis_number:
      (v.emis_number as string) || (fd.a2_emis as string) || null,
    district: (v.district as string) || (fd.a4_district as string) || null,
    circuit: (v.circuit as string) || null,
    province: (v.province as string) || null,
    quintile:
      v.quintile != null
        ? (v.quintile as string | number)
        : fd.a5_quintile != null
          ? (fd.a5_quintile as string | number)
          : null,
    overall_kpi: n(v.overall_kpi),
    rkmp_score: n(v.rkmp_score),
    nehs_score: n(v.nehs_score),
    gardens_score: n(v.gardens_score),
    traffic_light: v.traffic_light != null ? String(v.traffic_light) : null,
    feeding_today:
      fd.a15_feeding_today != null ? String(fd.a15_feeding_today) : null,
    food_groups_served: n(scores.food_groups_served),
    breakfast_served:
      fd.bf1_served != null ? String(fd.bf1_served) : null,
    sp_name: fd.a10_sp_name != null ? String(fd.a10_sp_name) : null,
    nsnp_learners: n(fd.a12_nsnp_learners),
    learners_eating: n(fd.a13_learners_eating),
    peu_visit_id: v.peu_visit_id != null ? Number(v.peu_visit_id) : null,
    submitted_at: v.submitted_at != null ? String(v.submitted_at) : null,
  };
}
