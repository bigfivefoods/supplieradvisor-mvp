/**
 * Owner management report — shared contract for all Advisors.
 * One-page A4 PDF + on-screen slice-and-dice pack.
 */

export type AdvisorReportId =
  | 'fitgraph'
  | 'physiograph'
  | 'dentalgraph'
  | 'medicalgraph'
  | 'psychiatrygraph'
  | 'fieldgraph'
  | 'quarrygraph'
  | 'schools'
  | 'health';

export const ADVISOR_REPORT_META: Record<
  AdvisorReportId,
  { brand: string; product: string; defaultHref: string }
> = {
  fitgraph: {
    brand: 'FitAdvisor®',
    product: 'Gym / fitness operations',
    defaultHref: '/dashboard/fitgraph/report',
  },
  physiograph: {
    brand: 'PhysioAdvisor®',
    product: 'Physiotherapy clinic',
    defaultHref: '/dashboard/physiograph/report',
  },
  dentalgraph: {
    brand: 'DentalAdvisor®',
    product: 'Dental practice',
    defaultHref: '/dashboard/dentalgraph/report',
  },
  medicalgraph: {
    brand: 'MedicalAdvisor®',
    product: 'Medical practice',
    defaultHref: '/dashboard/medicalgraph/report',
  },
  psychiatrygraph: {
    brand: 'PsychiatryAdvisor®',
    product: 'Psychiatry / mental health clinic',
    defaultHref: '/dashboard/psychiatrygraph/report',
  },
  fieldgraph: {
    brand: 'CropAdvisor®',
    product: 'Primary production / farming',
    defaultHref: '/dashboard/fieldgraph/report',
  },
  quarrygraph: {
    brand: 'QuarryAdvisor®',
    product: 'Quarrying & aggregates',
    defaultHref: '/dashboard/quarrygraph/report',
  },
  schools: {
    brand: 'SchoolAdvisor®',
    product: 'NSNP school or department programme',
    defaultHref: '/dashboard/schools/report',
  },
  health: {
    brand: 'HealthAdvisor®',
    product: 'DoH / facility nutrition programme',
    defaultHref: '/dashboard/health/report',
  },
};

export type ManagementKpi = {
  label: string;
  value: string | number;
  hint?: string;
};

export type ManagementTable = {
  title: string;
  headers: string[];
  /** Max ~8 rows rendered on one-page PDF */
  rows: Array<Array<string | number>>;
};

export type ManagementChartType = 'bar' | 'horizontal_bar' | 'donut' | 'line';

export type ManagementChartPoint = {
  label: string;
  value: number;
  /** Optional hex color e.g. #00b4d8 */
  color?: string;
};

/** Chart series for PDF + on-screen report pack */
export type ManagementChart = {
  id: string;
  title: string;
  type: ManagementChartType;
  unit?: string;
  series: ManagementChartPoint[];
};

export type ManagementSliceOption = {
  id: string;
  label: string;
};

export type ManagementReportDoc = {
  advisor: AdvisorReportId;
  brand: string;
  product: string;
  companyName: string;
  companyId: number;
  period: { from: string; to: string };
  /** Active slice tab / view */
  slice: string;
  sliceLabel: string;
  availableSlices: ManagementSliceOption[];
  /** Human filter summary for PDF footer */
  filterSummary: string;
  generatedAt: string;
  headline: string;
  kpis: ManagementKpi[];
  tables: ManagementTable[];
  /** Optional charts — auto-filled from tables/KPIs when omitted */
  charts?: ManagementChart[];
  highlights: string[];
  risks: string[];
  actions: string[];
};

const CHART_PALETTE = [
  '#0077b6',
  '#00b4d8',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#e11d48',
  '#0d9488',
  '#4f46e5',
];

function parseNumeric(v: string | number | null | undefined): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v == null) return null;
  const s = String(v).replace(/[%\s,R$]/g, '').trim();
  if (!s || s === '—' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ensure charts for web + PDF. Prefer builder charts; otherwise derive from KPIs/tables.
 * Returns up to 4 charts (PDF renders the first 2).
 */
export function ensureManagementCharts(
  doc: ManagementReportDoc
): ManagementChart[] {
  if (doc.charts && doc.charts.length > 0) {
    return doc.charts.slice(0, 4).map((c) => ({
      ...c,
      series: c.series.map((p, j) => ({
        ...p,
        color: p.color || CHART_PALETTE[j % CHART_PALETTE.length],
      })),
    }));
  }

  const charts: ManagementChart[] = [];

  // Chart 1: numeric KPIs as bars
  const kpiSeries = doc.kpis
    .map((k) => {
      const value = parseNumeric(k.value);
      if (value == null || value < 0) return null;
      return { label: k.label, value };
    })
    .filter((p): p is ManagementChartPoint => p != null)
    .slice(0, 8);
  if (kpiSeries.length >= 2) {
    charts.push({
      id: 'kpi_bars',
      title: 'Key metrics',
      type: 'bar',
      series: kpiSeries.map((p, i) => ({
        ...p,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
      })),
    });
  }

  // Chart 2: first table with label + numeric column
  const table = doc.tables[0];
  if (table && table.rows.length >= 2) {
    let valueCol = -1;
    for (let c = 1; c < (table.headers?.length || 0); c++) {
      const nums = table.rows
        .map((r) => parseNumeric(r[c]))
        .filter((n): n is number => n != null);
      if (nums.length >= Math.min(2, table.rows.length)) {
        valueCol = c;
        break;
      }
    }
    if (valueCol > 0) {
      const series = table.rows
        .map((r) => {
          const value = parseNumeric(r[valueCol]);
          if (value == null) return null;
          return {
            label: String(r[0] ?? '—').slice(0, 18),
            value,
          };
        })
        .filter((p): p is ManagementChartPoint => p != null)
        .slice(0, 8);
      if (series.length >= 2) {
        charts.push({
          id: 'table_bars',
          title: table.title,
          type: 'horizontal_bar',
          series: series.map((p, i) => ({
            ...p,
            color: CHART_PALETTE[i % CHART_PALETTE.length],
          })),
        });
      }
    }
  }

  // Chart 3: donut from risk/highlight counts if we only have one chart
  if (charts.length === 1) {
    const donut = [
      { label: 'Highlights', value: Math.max(1, doc.highlights.length) },
      { label: 'Risks', value: Math.max(1, doc.risks.length) },
      { label: 'Actions', value: Math.max(1, doc.actions.length) },
    ];
    charts.push({
      id: 'focus_mix',
      title: 'Board focus mix',
      type: 'donut',
      series: donut.map((p, i) => ({
        ...p,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
      })),
    });
  }

  // Prefer a second table chart when available
  const table2 = doc.tables[1];
  if (table2 && table2.rows.length >= 2 && charts.length < 3) {
    let valueCol = -1;
    for (let c = 1; c < (table2.headers?.length || 0); c++) {
      const nums = table2.rows
        .map((r) => parseNumeric(r[c]))
        .filter((n): n is number => n != null);
      if (nums.length >= Math.min(2, table2.rows.length)) {
        valueCol = c;
        break;
      }
    }
    if (valueCol > 0) {
      const series = table2.rows
        .map((r) => {
          const value = parseNumeric(r[valueCol]);
          if (value == null) return null;
          return {
            label: String(r[0] ?? '—').slice(0, 18),
            value,
          };
        })
        .filter((p): p is ManagementChartPoint => p != null)
        .slice(0, 8);
      if (series.length >= 2) {
        charts.push({
          id: 'table2_bars',
          title: table2.title,
          type: 'horizontal_bar',
          series: series.map((p, i) => ({
            ...p,
            color: CHART_PALETTE[i % CHART_PALETTE.length],
          })),
        });
      }
    }
  }

  return charts.slice(0, 4);
}

export type ManagementReportFilters = {
  from: string;
  to: string;
  slice?: string;
  /** Free-form dimension filters (coachId, practitionerId, quarryId, district…) */
  dims?: Record<string, string>;
};

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(dateIso: string, days: number) {
  const d = new Date(`${dateIso.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function defaultPeriod(days = 30): { from: string; to: string } {
  const to = todayIso();
  return { from: addDaysIso(to, -(days - 1)), to };
}

export function managementReportPdfFilename(doc: ManagementReportDoc) {
  const brand = doc.brand.replace(/[®™]/g, '').replace(/\s+/g, '');
  return `${brand}-Management-A4-Landscape-${doc.period.from}_${doc.period.to}.pdf`;
}

export function managementReportApiUrl(
  advisor: AdvisorReportId,
  companyId: number,
  filters: ManagementReportFilters & {
    format?: 'json' | 'pdf';
    /** PDF is always one-page A4 landscape key-metrics pack */
    orientation?: 'landscape' | 'portrait';
  }
) {
  const q = new URLSearchParams({
    advisor,
    companyId: String(companyId),
    from: filters.from,
    to: filters.to,
    // PDF pack always uses overview (full key metrics)
    slice:
      filters.format === 'pdf'
        ? 'overview'
        : filters.slice || 'overview',
    format: filters.format || 'json',
    orientation: filters.orientation || 'landscape',
  });
  if (filters.dims) {
    for (const [k, v] of Object.entries(filters.dims)) {
      if (v) q.set(`dim_${k}`, v);
    }
  }
  return `/api/advisors/management-report?${q.toString()}`;
}
