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
    product: 'NSNP school / programme kitchen',
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
  highlights: string[];
  risks: string[];
  actions: string[];
};

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
  return `${brand}-Owner-Management-${doc.period.from}_${doc.period.to}-${doc.slice}.pdf`;
}

export function managementReportApiUrl(
  advisor: AdvisorReportId,
  companyId: number,
  filters: ManagementReportFilters & { format?: 'json' | 'pdf' }
) {
  const q = new URLSearchParams({
    advisor,
    companyId: String(companyId),
    from: filters.from,
    to: filters.to,
    slice: filters.slice || 'overview',
    format: filters.format || 'json',
  });
  if (filters.dims) {
    for (const [k, v] of Object.entries(filters.dims)) {
      if (v) q.set(`dim_${k}`, v);
    }
  }
  return `/api/advisors/management-report?${q.toString()}`;
}
