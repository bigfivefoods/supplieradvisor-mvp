/**
 * Build owner ManagementReportDoc per Advisor from live company data.
 * Server-only (imports graph stores + may use supabase).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ADVISOR_REPORT_META,
  type AdvisorReportId,
  type ManagementReportDoc,
  type ManagementReportFilters,
  type ManagementKpi,
  type ManagementTable,
} from '@/lib/advisors/management-report';

function dim(filters: ManagementReportFilters, key: string) {
  return String(filters.dims?.[key] || '').trim();
}

function filterLine(parts: string[]) {
  return parts.filter(Boolean).join(' · ') || 'All dimensions';
}

function baseDoc(
  advisor: AdvisorReportId,
  companyId: number,
  companyName: string,
  filters: ManagementReportFilters,
  slice: string,
  sliceLabel: string,
  availableSlices: Array<{ id: string; label: string }>
): Omit<
  ManagementReportDoc,
  | 'headline'
  | 'kpis'
  | 'tables'
  | 'highlights'
  | 'risks'
  | 'actions'
  | 'filterSummary'
> {
  const meta = ADVISOR_REPORT_META[advisor];
  return {
    advisor,
    brand: meta.brand,
    product: meta.product,
    companyName,
    companyId,
    period: { from: filters.from, to: filters.to },
    slice,
    sliceLabel,
    availableSlices,
    generatedAt: new Date().toISOString(),
  };
}

function kpi(label: string, value: string | number, hint?: string): ManagementKpi {
  return { label, value, hint };
}

// ── Clinic family (physio / dental / medical / psychiatry) ───────────────

type ClinicLikeStore = {
  practitioners?: Array<{
    id: string;
    name: string;
    active?: boolean;
    code?: string;
  }>;
  staff?: Array<{ id: string; name: string; active?: boolean; code?: string }>;
  patients: Array<{
    id: string;
    name: string;
    active?: boolean;
    status?: string;
    practitioner_id?: string | null;
  }>;
  services: Array<{ id: string; name: string; active?: boolean }>;
  appointments: Array<{
    id: string;
    date: string;
    start_time: string;
    status: string;
    service_id: string;
    practitioner_id?: string | null;
    booked?: number;
  }>;
  bookings?: Array<{
    id: string;
    appointment_id: string;
    status: string;
    patient_id?: string;
  }>;
};

function buildClinicReport(
  advisor: AdvisorReportId,
  store: ClinicLikeStore,
  companyId: number,
  companyName: string,
  filters: ManagementReportFilters
): ManagementReportDoc {
  const people =
    store.practitioners ||
    store.staff ||
    ([] as Array<{ id: string; name: string; active?: boolean }>);
  const pracId = dim(filters, 'practitionerId') || dim(filters, 'staffId');
  const slice = filters.slice || 'overview';
  const slices = [
    { id: 'overview', label: 'Overview' },
    { id: 'practitioners', label: 'Practitioners' },
    { id: 'services', label: 'Services' },
    { id: 'diary', label: 'Diary' },
  ];

  let appts = (store.appointments || []).filter(
    (a) =>
      a.date >= filters.from &&
      a.date <= filters.to &&
      a.status !== 'cancelled'
  );
  if (pracId) {
    appts = appts.filter((a) => a.practitioner_id === pracId);
  }

  const bookings = store.bookings || [];
  const periodBookingIds = new Set(appts.map((a) => a.id));
  const periodBookings = bookings.filter((b) =>
    periodBookingIds.has(b.appointment_id)
  );
  const attended = periodBookings.filter((b) => b.status === 'attended').length;
  const noShow = periodBookings.filter((b) => b.status === 'no_show').length;
  const booked = periodBookings.filter((b) =>
    ['booked', 'confirmed', 'pending'].includes(String(b.status || '').toLowerCase())
  ).length;
  const cancelledAppts = (store.appointments || []).filter(
    (a) =>
      a.date >= filters.from &&
      a.date <= filters.to &&
      String(a.status || '').toLowerCase() === 'cancelled'
  ).length;
  const activePatients = store.patients.filter(
    (p) => p.active !== false && (p.status === 'active' || p.status === 'new' || !p.status)
  ).length;
  const newPatients = store.patients.filter((p) => {
    const st = String(p.status || '').toLowerCase();
    return st === 'new' || st === 'lead';
  }).length;
  const utilSeats = appts.reduce((n, a) => n + Number(a.booked || 0), 0);
  const teamActive = people.filter((p) => p.active !== false).length;
  const servicesActive = store.services.filter((s) => s.active !== false).length;

  const byPrac = new Map<string, number>();
  for (const a of appts) {
    const id = a.practitioner_id || '_none';
    byPrac.set(id, (byPrac.get(id) || 0) + 1);
  }
  const pracRows = [...byPrac.entries()]
    .map(([id, n]) => {
      const p = people.find((x) => x.id === id);
      return [p?.name || 'Unassigned', n, activePatients];
    })
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 8);

  const bySvc = new Map<string, number>();
  for (const a of appts) {
    bySvc.set(a.service_id, (bySvc.get(a.service_id) || 0) + 1);
  }
  const svcRows = [...bySvc.entries()]
    .map(([id, n]) => {
      const s = store.services.find((x) => x.id === id);
      return [s?.name || id, n];
    })
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 8);

  const diaryRows = appts
    .slice()
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : b.date.localeCompare(a.date)
    )
    .slice(0, 8)
    .map((a) => {
      const s = store.services.find((x) => x.id === a.service_id);
      const p = people.find((x) => x.id === a.practitioner_id);
      return [a.date, a.start_time, s?.name || '—', p?.name || '—', a.status];
    });

  const kpis: ManagementKpi[] = [
    kpi('Appts in period', appts.length, 'Non-cancelled diary slots'),
    kpi('Active patients', activePatients),
    kpi('Patients on book', store.patients.length, newPatients ? `${newPatients} new/lead` : undefined),
    kpi('Team active', teamActive),
    kpi('Services live', servicesActive),
    kpi('Booked seats', booked || utilSeats),
    kpi('Attended', attended),
    kpi('No-shows', noShow),
    kpi(
      'Show-up %',
      attended + noShow > 0
        ? `${Math.round((attended / (attended + noShow)) * 100)}%`
        : '—'
    ),
    kpi('Cancelled appts', cancelledAppts),
    kpi('Practitioners with load', byPrac.size),
    kpi('Top service mix', svcRows.length ? String(svcRows[0]?.[0] || '—') : '—'),
  ];

  const dayMap = new Map<string, { appts: number; attended: number; noShow: number }>();
  for (const a of appts) {
    const cur = dayMap.get(a.date) || { appts: 0, attended: 0, noShow: 0 };
    cur.appts += 1;
    dayMap.set(a.date, cur);
  }
  const apptDate = new Map(
    appts.map((a) => [a.id, a.date] as const)
  );
  for (const b of periodBookings) {
    const d = apptDate.get(b.appointment_id);
    if (!d) continue;
    const cur = dayMap.get(d) || { appts: 0, attended: 0, noShow: 0 };
    if (b.status === 'attended') cur.attended += 1;
    if (b.status === 'no_show') cur.noShow += 1;
    dayMap.set(d, cur);
  }
  const dailyRows = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => [date, v.appts, v.attended, v.noShow]);

  const tables: ManagementTable[] = [
    {
      title: 'People · practitioner load',
      headers: ['Name', 'Appts', 'Patients (active book)'],
      rows: pracRows as Array<Array<string | number>>,
    },
    {
      title: 'Floor · services',
      headers: ['Service', 'Appts'],
      rows: svcRows as Array<Array<string | number>>,
    },
    {
      title: 'Diary · recent slots',
      headers: ['Date', 'Time', 'Service', 'Clinician', 'Status'],
      rows: diaryRows as Array<Array<string | number>>,
    },
    {
      title: 'Trend · by day',
      headers: ['Date', 'Appts', 'Attended', 'No-show'],
      rows: dailyRows.slice(-14) as Array<Array<string | number>>,
    },
  ];

  const showUp =
    attended + noShow > 0
      ? Math.round((attended / (attended + noShow)) * 100)
      : null;

  return {
    ...baseDoc(
      advisor,
      companyId,
      companyName,
      filters,
      slice,
      slices.find((s) => s.id === slice)?.label || 'Overview',
      slices
    ),
    filterSummary: filterLine([
      pracId
        ? `Clinician: ${people.find((p) => p.id === pracId)?.name || pracId}`
        : '',
      `Slice: ${slice}`,
    ]),
    headline: `${ADVISOR_REPORT_META[advisor].brand} reports pack — people, floor, diary & trends`,
    kpis,
    tables,
    charts: [
      {
        id: 'clinic_activity',
        title: 'Clinic activity',
        type: 'bar',
        series: [
          { label: 'Appts', value: appts.length, color: '#0077b6' },
          { label: 'Attended', value: attended, color: '#059669' },
          { label: 'No-shows', value: noShow, color: '#e11d48' },
          { label: 'Cancelled', value: cancelledAppts, color: '#d97706' },
          { label: 'Patients', value: activePatients, color: '#7c3aed' },
        ],
      },
      {
        id: 'top_services',
        title: 'Top services by appts',
        type: 'horizontal_bar',
        series: svcRows.slice(0, 6).map((r, i) => ({
          label: String(r[0]),
          value: Number(r[1]) || 0,
          color: ['#0077b6', '#00b4d8', '#059669', '#d97706', '#7c3aed', '#0d9488'][
            i % 6
          ],
        })),
      },
      {
        id: 'prac_load',
        title: 'Practitioner load',
        type: 'donut',
        series: pracRows.slice(0, 5).map((r, i) => ({
          label: String(r[0]).slice(0, 14),
          value: Number(r[1]) || 0,
          color: ['#0077b6', '#00b4d8', '#059669', '#d97706', '#7c3aed'][i % 5],
        })),
      },
      {
        id: 'daily_appts',
        title: 'Appointments by day',
        type: 'line',
        series: dailyRows.slice(-14).map((r) => ({
          label: String(r[0]).slice(5),
          value: Number(r[1]) || 0,
          color: '#0077b6',
        })),
      },
      {
        id: 'daily_attended',
        title: 'Attendance trend',
        type: 'line',
        series: dailyRows.slice(-14).map((r) => ({
          label: String(r[0]).slice(5),
          value: Number(r[2]) || 0,
          color: '#059669',
        })),
      },
    ],
    highlights: [
      `${appts.length} appointments in period · ${teamActive} active clinicians`,
      showUp != null ? `${showUp}% show-up (attended / decided)` : 'No attendance marks yet',
      `${activePatients} active patients on the book · ${store.patients.length} total`,
      servicesActive ? `${servicesActive} live services on the menu` : 'No services configured',
    ],
    risks: [
      noShow > 0 ? `${noShow} no-shows — follow up or double-book carefully` : 'No-shows under control',
      cancelledAppts > 0
        ? `${cancelledAppts} cancelled slots in period`
        : 'Cancellations low',
      appts.length === 0 ? 'No diary activity in this period' : 'Diary active',
      teamActive === 0 ? 'No active practitioners on roster' : 'Team roster populated',
    ],
    actions: [
      'Review practitioner load balance',
      'Chase outstanding feedback / recalls',
      'Confirm website booking slots match capacity',
      noShow > 0 ? 'SMS / call no-shows for rebook' : 'Maintain confirmation cadence',
    ],
  };
}

// ── GymAdvisor ───────────────────────────────────────────────────────────

async function buildFit(
  meta: Record<string, unknown>,
  companyId: number,
  companyName: string,
  filters: ManagementReportFilters
): Promise<ManagementReportDoc> {
  const { readFitgraphFromMetadata } = await import('@/lib/fitness/fitgraph');
  const { buildFullReport } = await import('@/lib/fitness/fitgraph-reports');
  const store = readFitgraphFromMetadata(meta);
  const f = {
    from: filters.from,
    to: filters.to,
    coachId: dim(filters, 'coachId'),
    classTypeId: dim(filters, 'classTypeId'),
    specialty: dim(filters, 'specialty'),
    feedbackRole: '' as const,
    sessionStatus: '' as const,
  };
  const report = buildFullReport(store, f);
  const o = report.overview;
  const slice = filters.slice || 'overview';
  const slices = [
    { id: 'overview', label: 'Overview' },
    { id: 'coaches', label: 'Coaches' },
    { id: 'classes', label: 'Classes' },
    { id: 'members', label: 'Members' },
    { id: 'daily', label: 'By day' },
  ];

  const tables: ManagementTable[] = [
    {
      title: 'People · coaches',
      headers: ['Coach', 'Sessions', 'Attended', 'Fill %', 'Feeling'],
      rows: report.coaches.slice(0, 12).map((r) => [
        r.name,
        r.sessions,
        r.attended,
        r.fill_pct ?? '—',
        r.avg_member_feeling ?? '—',
      ]),
    },
    {
      title: 'Floor · class types',
      headers: ['Class', 'Sessions', 'Attended', 'Fill %'],
      rows: report.classes.slice(0, 12).map((r) => [
        r.name,
        r.sessions,
        r.attended,
        r.fill_pct ?? '—',
      ]),
    },
    {
      title: 'People · members',
      headers: ['Member', 'Attended', 'No-show', 'Classes'],
      rows: report.members.slice(0, 12).map((r) => [
        r.name,
        r.attended_in_range,
        r.no_show_in_range,
        r.class_count,
      ]),
    },
    {
      title: 'Trend · by day',
      headers: ['Date', 'Sessions', 'Attended', 'No-show', 'Feedback'],
      rows: report.daily.slice(-14).map((r) => [
        r.date,
        r.sessions,
        r.attended,
        r.no_show,
        r.feedback,
      ]),
    },
  ];

  return {
    ...baseDoc(
      'fitgraph',
      companyId,
      companyName,
      filters,
      slice,
      slices.find((s) => s.id === slice)?.label || 'Overview',
      slices
    ),
    filterSummary: filterLine([
      f.coachId ? `Coach filter on` : '',
      f.classTypeId ? `Class filter on` : '',
      f.specialty ? `Specialty: ${f.specialty}` : '',
    ]),
    headline: 'Gym reports pack — people, floor, attendance & trends',
    kpis: [
      kpi('Sessions', o.sessions),
      kpi('Completed', o.completed),
      kpi('Attended seats', o.attended),
      kpi('Fill %', o.fill_pct ?? '—', 'Capacity utilisation'),
      kpi('Show-up %', o.show_up_pct ?? '—'),
      kpi('No-shows', o.no_show),
      kpi('Waitlist', o.waitlist),
      kpi('Check-ins', o.check_ins_in_range),
      kpi('Active members', o.active_members),
      kpi('Coaches teaching', o.coaches_teaching),
      kpi('Class types run', o.class_types_run),
      kpi('Member feedback', o.member_feedback),
    ].slice(0, 12),
    tables,
    charts: [
      {
        id: 'attendance_mix',
        title: 'Attendance mix',
        type: 'bar',
        series: [
          { label: 'Attended', value: o.attended, color: '#059669' },
          { label: 'No-shows', value: o.no_show, color: '#e11d48' },
          { label: 'Waitlist', value: o.waitlist, color: '#d97706' },
          { label: 'Check-ins', value: o.check_ins_in_range, color: '#0077b6' },
        ],
      },
      {
        id: 'top_coaches',
        title: 'Top coaches by sessions',
        type: 'horizontal_bar',
        series: report.coaches.slice(0, 6).map((r, i) => ({
          label: r.name,
          value: r.sessions,
          color: ['#0077b6', '#00b4d8', '#059669', '#7c3aed', '#d97706', '#0d9488'][
            i % 6
          ],
        })),
      },
      {
        id: 'daily_trend',
        title: 'Daily attended seats',
        type: 'line',
        series: report.daily.slice(-14).map((d) => ({
          label: d.date.slice(5),
          value: d.attended,
          color: '#0077b6',
        })),
      },
      {
        id: 'daily_sessions',
        title: 'Sessions by day',
        type: 'line',
        series: report.daily.slice(-14).map((d) => ({
          label: d.date.slice(5),
          value: d.sessions,
          color: '#0d9488',
        })),
      },
      {
        id: 'class_mix',
        title: 'Class mix',
        type: 'donut',
        series: report.classes.slice(0, 6).map((r, i) => ({
          label: r.name.slice(0, 16),
          value: r.sessions,
          color: ['#0077b6', '#00b4d8', '#059669', '#7c3aed', '#d97706', '#0d9488'][
            i % 6
          ],
        })),
      },
      {
        id: 'no_show_trend',
        title: 'No-shows by day',
        type: 'line',
        series: report.daily.slice(-14).map((d) => ({
          label: d.date.slice(5),
          value: d.no_show,
          color: '#e11d48',
        })),
      },
    ],
    highlights: [
      `${o.sessions} sessions · ${o.attended} attended seats`,
      o.fill_pct != null ? `Fill ${o.fill_pct}% of capacity` : 'Capacity not set on all classes',
      `${o.member_feedback} member feedback responses`,
    ],
    risks: [
      o.no_show > 0 ? `${o.no_show} no-shows in period` : 'No-show rate healthy',
      o.waitlist > 5 ? `${o.waitlist} waitlist seats — add capacity` : 'Waitlist manageable',
    ],
    actions: [
      'Rebalance coach load from coach slice',
      'Promote under-filled class types',
      'Collect outstanding class feedback',
    ],
  };
}

// ── CropAdvisor ──────────────────────────────────────────────────────────

async function buildField(
  meta: Record<string, unknown>,
  companyId: number,
  companyName: string,
  filters: ManagementReportFilters
): Promise<ManagementReportDoc> {
  const { readFieldgraphFromMetadata } = await import('@/lib/agri/fieldgraph');
  const {
    buildFieldgraphReport,
    emptyDiceFilters,
  } = await import('@/lib/agri/fieldgraph-reports');
  const store = readFieldgraphFromMetadata(meta);
  const dice = emptyDiceFilters(filters.from, filters.to);
  const crop = dim(filters, 'crop');
  const farm = dim(filters, 'farm');
  if (crop) dice.crops = [crop];
  if (farm) dice.farms = [farm];
  const season = dim(filters, 'season');
  if (season) dice.seasons = [season];
  const bundle = buildFieldgraphReport(store, dice);
  const slice = filters.slice || 'overview';
  const slices = [
    { id: 'overview', label: 'Overview' },
    { id: 'yield', label: 'Yield' },
    { id: 'fleet', label: 'Fleet' },
    { id: 'labour', label: 'Labour' },
    { id: 'harvest', label: 'Harvest' },
  ];

  let tables: ManagementTable[] = [];
  if (slice === 'yield') {
    tables = [
      {
        title: 'Yield by field',
        headers: ['Field', 'Crop', 'Ha', 'Est t', 'Actual t'],
        rows: bundle.byField.slice(0, 8).map((r) => [
          r.code || r.name,
          r.crop,
          r.hectares,
          r.estimate_t,
          r.actual_t,
        ]),
      },
    ];
  } else if (slice === 'fleet') {
    tables = [
      {
        title: 'Fleet by vehicle',
        headers: ['Vehicle', 'Hours', 'Fuel L', 'Km', 'Cost'],
        rows: bundle.fleetByVehicle.slice(0, 8).map((r) => [
          r.vehicle,
          r.hours,
          r.fuel_l,
          r.km,
          r.cost_zar,
        ]),
      },
    ];
  } else if (slice === 'labour') {
    tables = [
      {
        title: 'Labour by gang',
        headers: ['Gang', 'Cost', 'Hours', 'Logs'],
        rows: bundle.labourByGang.slice(0, 8).map((r) => [
          r.gang,
          r.cost,
          r.hours,
          r.logs,
        ]),
      },
    ];
  } else if (slice === 'harvest') {
    tables = [
      {
        title: 'Harvest plan',
        headers: ['Seq', 'Field', 'Crop', 't', 'Status'],
        rows: bundle.harvest.slice(0, 8).map((r) => [
          r.sequence,
          r.field_code,
          r.crop,
          r.tonnes ?? '—',
          r.status,
        ]),
      },
    ];
  } else {
    tables = [
      {
        title: 'By crop',
        headers: ['Crop', 'Fields', 'Ha', 'Est t', 'Actual t'],
        rows: bundle.byCrop.slice(0, 8).map((r) => [
          r.crop,
          r.fields,
          r.hectares,
          r.estimate_t,
          r.actual_t,
        ]),
      },
      {
        title: 'KPI pack',
        headers: ['Metric', 'Value'],
        rows: Object.entries(bundle.kpis)
          .slice(0, 8)
          .map(([k, v]) => [k, v ?? '—']),
      },
    ];
  }

  const fields = store.fields?.filter((f) => f.active !== false).length || 0;
  const ha = bundle.byField.reduce((n, r) => n + Number(r.hectares || 0), 0);
  const estT = bundle.byCrop.reduce((n, r) => n + Number(r.estimate_t || 0), 0);
  const actT = bundle.byCrop.reduce((n, r) => n + Number(r.actual_t || 0), 0);
  const fleetHours = bundle.fleetByVehicle.reduce(
    (n, r) => n + Number(r.hours || 0),
    0
  );
  const fleetCost = bundle.fleetByVehicle.reduce(
    (n, r) => n + Number(r.cost_zar || 0),
    0
  );
  const labourCost = bundle.labourByGang.reduce(
    (n, r) => n + Number(r.cost || 0),
    0
  );
  const labourHours = bundle.labourByGang.reduce(
    (n, r) => n + Number(r.hours || 0),
    0
  );
  const harvestOpen = (store.harvest_plan || []).filter((h) => {
    const st = String(
      (h as { status?: string }).status || ''
    ).toLowerCase();
    return !['done', 'complete', 'cancelled'].includes(st);
  }).length;
  const kpiEntries = Object.entries(bundle.kpis || {}).slice(0, 6);
  return {
    ...baseDoc(
      'fieldgraph',
      companyId,
      companyName,
      filters,
      slice,
      slices.find((s) => s.id === slice)?.label || 'Overview',
      slices
    ),
    filterSummary: filterLine([
      crop ? `Crop: ${crop}` : '',
      farm ? `Farm: ${farm}` : '',
      season ? `Season: ${season}` : '',
    ]),
    headline: 'Farm owner pack — yield, fleet, labour & harvest',
    kpis: [
      kpi('Fields', fields),
      kpi('Hectares', Math.round(ha * 10) / 10),
      kpi('Est tonnes', Math.round(estT * 10) / 10),
      kpi('Actual tonnes', Math.round(actT * 10) / 10),
      kpi(
        'Yield capture %',
        estT > 0 ? `${Math.round((actT / estT) * 1000) / 10}%` : '—'
      ),
      kpi('Crops in scope', bundle.byCrop.length),
      kpi('Fleet hours', Math.round(fleetHours * 10) / 10),
      kpi('Fleet cost R', Math.round(fleetCost)),
      kpi('Labour hours', Math.round(labourHours * 10) / 10),
      kpi('Labour cost R', Math.round(labourCost)),
      kpi('Harvest open', harvestOpen),
      kpi('Estimates', store.estimates?.length || 0),
      ...kpiEntries.map(([k, v]) => kpi(String(k), (v as string | number) ?? '—')),
    ].slice(0, 12),
    tables,
    charts: [
      {
        id: 'by_crop',
        title: 'Estimate tonnes by crop',
        type: 'bar',
        series: bundle.byCrop.slice(0, 6).map((r, i) => ({
          label: r.crop,
          value: r.estimate_t || r.actual_t || 0,
          color: ['#059669', '#0077b6', '#00b4d8', '#d97706', '#7c3aed', '#0d9488'][
            i % 6
          ],
        })),
      },
      {
        id: 'fleet',
        title: 'Fleet hours by vehicle',
        type: 'horizontal_bar',
        series: bundle.fleetByVehicle.slice(0, 6).map((r, i) => ({
          label: r.vehicle,
          value: r.hours || 0,
          color: ['#0077b6', '#00b4d8', '#059669', '#d97706', '#7c3aed', '#0d9488'][
            i % 6
          ],
        })),
      },
      {
        id: 'labour',
        title: 'Labour cost by gang',
        type: 'donut',
        series: bundle.labourByGang.slice(0, 5).map((r, i) => ({
          label: String(r.gang).slice(0, 14),
          value: Number(r.cost) || 0,
          color: ['#0077b6', '#00b4d8', '#059669', '#d97706', '#7c3aed'][i % 5],
        })),
      },
    ],
    highlights: [
      `${fields} active fields · ${Math.round(ha)} ha in scope`,
      `Yield: ${Math.round(actT)} t actual vs ${Math.round(estT)} t estimate`,
      `Fleet ${Math.round(fleetHours)} h · Labour R${Math.round(labourCost).toLocaleString('en-ZA')}`,
    ],
    risks: [
      fields === 0 ? 'No fields on the master list' : 'Field master populated',
      estT > 0 && actT / estT < 0.7
        ? 'Actual yield lagging estimate — investigate fields'
        : 'Yield tracking on plan',
      harvestOpen > 0
        ? `${harvestOpen} harvest line(s) still open`
        : 'Harvest plan clear',
    ],
    actions: [
      'Close yield actuals vs estimates',
      'Review high R/km vehicles',
      'Align harvest sequence with mill board',
      'Balance labour gangs vs remaining cut',
    ],
  };
}

// ── QuarryAdvisor ────────────────────────────────────────────────────────

async function buildQuarry(
  meta: Record<string, unknown>,
  companyId: number,
  companyName: string,
  filters: ManagementReportFilters
): Promise<ManagementReportDoc> {
  const {
    readQuarrygraphFromMetadata,
    summariseQuarrygraph,
  } = await import('@/lib/quarry/quarrygraph');
  const store = readQuarrygraphFromMetadata(meta);
  const summary = summariseQuarrygraph(store) as Record<string, unknown>;
  const quarryId = dim(filters, 'quarryId');
  const slice = filters.slice || 'overview';
  const slices = [
    { id: 'overview', label: 'Overview' },
    { id: 'quarries', label: 'By quarry' },
    { id: 'fleet', label: 'Fleet' },
    { id: 'dispatch', label: 'Dispatch' },
    { id: 'compliance', label: 'Permits' },
  ];

  const quarries = (store.quarries || []).filter((q) =>
    quarryId ? q.id === quarryId : true
  );
  const dispatches = (store.dispatches || []).filter((d) => {
    const dt = String(
      (d as { date?: string; ticket_date?: string }).date ||
        (d as { ticket_date?: string }).ticket_date ||
        ''
    ).slice(0, 10);
    if (!dt) return true;
    return dt >= filters.from && dt <= filters.to;
  });

  const dispatchTonnes = dispatches.reduce(
    (n, d) => n + Number(d.net_tonnes || 0),
    0
  );
  const permitsExpiring = Number(summary.permitsExpiring || 0);
  const productionLogs = (store as { production?: unknown[] }).production?.length
    || (store as { production_logs?: unknown[] }).production_logs?.length
    || 0;
  const reserves = (store as { reserves?: unknown[] }).reserves?.length || 0;
  const plantStock = (store as { plant_stock?: unknown[]; stock?: unknown[] })
    .plant_stock?.length
    || (store as { stock?: unknown[] }).stock?.length
    || 0;
  const extra = Object.entries(summary || {})
    .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
    .slice(0, 6)
    .map(([k, v]) => kpi(k, v as string | number));
  const allKpis = [
    kpi('Quarries', quarries.length),
    kpi('Sites', (store.sites || []).length),
    kpi('Products', (store.products || []).length),
    kpi('Vehicles', (store.vehicles || []).length),
    kpi('Dispatches', dispatches.length, 'In period window'),
    kpi('Dispatch tonnes', Math.round(dispatchTonnes * 10) / 10),
    kpi('Permits', (store.permits || []).length),
    kpi('Permits expiring', permitsExpiring),
    kpi('Reserves rows', reserves || '—'),
    kpi('Production logs', productionLogs || '—'),
    kpi('Plant stock lines', plantStock || '—'),
    kpi('Labour crews', (store as { labour?: unknown[] }).labour?.length || (store as { crews?: unknown[] }).crews?.length || '—'),
    ...extra,
  ].slice(0, 12);

  let tables: ManagementTable[] = [
    {
      title: 'Quarries',
      headers: ['Code', 'Name', 'Status'],
      rows: quarries.slice(0, 8).map((q) => [
        q.code || q.name,
        q.name,
        q.status || '—',
      ]),
    },
  ];
  if (slice === 'fleet') {
    tables = [
      {
        title: 'Fleet',
        headers: ['Code', 'Type', 'Status'],
        rows: (store.vehicles || []).slice(0, 8).map((v) => [
          v.code || v.name || '—',
          v.type || '—',
          v.status || '—',
        ]),
      },
    ];
  } else if (slice === 'dispatch') {
    tables = [
      {
        title: 'Recent dispatches',
        headers: ['Date', 'Product', 'Tonnes', 'Customer'],
        rows: dispatches.slice(0, 8).map((d) => [
          String(d.date || '—').slice(0, 10),
          String(d.product_id || d.order_ref || '—'),
          d.net_tonnes ?? '—',
          d.customer || '—',
        ]),
      },
    ];
  } else if (slice === 'compliance') {
    tables = [
      {
        title: 'Permits',
        headers: ['Ref', 'Type', 'Status', 'Expires'],
        rows: (store.permits || []).slice(0, 8).map((c) => [
          c.ref_no || '—',
          c.type || '—',
          c.status || '—',
          String(c.expires_at || '—').slice(0, 10),
        ]),
      },
    ];
  }

  return {
    ...baseDoc(
      'quarrygraph',
      companyId,
      companyName,
      filters,
      slice,
      slices.find((s) => s.id === slice)?.label || 'Overview',
      slices
    ),
    filterSummary: filterLine([
      quarryId
        ? `Quarry: ${quarries[0]?.name || quarryId}`
        : 'All quarries',
    ]),
    headline: 'Quarry owner pack — production, fleet, dispatch & compliance',
    kpis: allKpis,
    tables,
    charts: [
      {
        id: 'quarry_ops',
        title: 'Operations snapshot',
        type: 'bar',
        series: [
          { label: 'Quarries', value: quarries.length, color: '#0077b6' },
          { label: 'Sites', value: (store.sites || []).length, color: '#00b4d8' },
          { label: 'Vehicles', value: (store.vehicles || []).length, color: '#059669' },
          { label: 'Dispatches', value: dispatches.length, color: '#d97706' },
          { label: 'Permits', value: (store.permits || []).length, color: '#7c3aed' },
          {
            label: 'Tonnes',
            value: Math.round(dispatchTonnes) || 0,
            color: '#0d9488',
          },
        ],
      },
      {
        id: 'dispatch_mix',
        title: 'Dispatch volume (tonnes)',
        type: 'donut',
        series: dispatches.slice(0, 5).map((d, i) => ({
          label: String(d.customer || d.ticket_no || `Ticket ${i + 1}`).slice(0, 14),
          value: Number(d.net_tonnes) || 1,
          color: ['#0077b6', '#00b4d8', '#059669', '#d97706', '#7c3aed'][i % 5],
        })),
      },
      {
        id: 'quarry_sites',
        title: 'Quarries in scope',
        type: 'horizontal_bar',
        series: quarries.slice(0, 6).map((q, i) => ({
          label: String(q.code || q.name || `Q${i + 1}`).slice(0, 14),
          value: 1,
          color: ['#0077b6', '#00b4d8', '#059669', '#d97706', '#7c3aed', '#0d9488'][
            i % 6
          ],
        })),
      },
    ],
    highlights: [
      `${quarries.length} quarry(ies) · ${(store.sites || []).length} site(s)`,
      `${dispatches.length} dispatch tickets · ${Math.round(dispatchTonnes)} t in period`,
      `${(store.vehicles || []).length} vehicles · ${(store.products || []).length} product grades`,
    ],
    risks: [
      (store.permits || []).length === 0
        ? 'No permits on register — add rights / WUL / EMP'
        : `${permitsExpiring} permit(s) expiring soon`,
      dispatches.length === 0
        ? 'No dispatches in period — check weighbridge tickets'
        : 'Dispatch activity present',
    ],
    actions: [
      'Review cost per tonne by quarry',
      'Chase expiring permits',
      'Balance plant stock vs dispatch',
      'Close production vs reserve survey gaps',
    ],
  };
}

// ── Schools ──────────────────────────────────────────────────────────────

/**
 * DBE / PEU department owner pack — detailed network roll-up from every
 * school joined via school_agency_links. Never reads another department's schools.
 */
async function buildSchoolsAgency(
  supabase: SupabaseClient,
  companyId: number,
  companyName: string,
  filters: ManagementReportFilters,
  agency: Record<string, unknown>
): Promise<ManagementReportDoc> {
  const { fetchAgencySchoolLinks, fetchByIds } = await import(
    '@/lib/schools/supabase-page'
  );

  let links: Array<Record<string, unknown>> = [];
  try {
    links = await fetchAgencySchoolLinks(supabase, companyId, [
      'active',
      'pending',
      'suspended',
    ]);
  } catch {
    links = [];
  }

  const activeLinks = links.filter((l) => l.status === 'active');
  const pendingLinks = links.filter((l) => l.status === 'pending');
  const suspendedLinks = links.filter((l) => l.status === 'suspended');

  // Prefer active schools for learner totals; fall back to all if none active
  const rollupLinks = activeLinks.length ? activeLinks : links;
  const schoolIds = [
    ...new Set(
      rollupLinks
        .map((l) => Number(l.school_profile_id))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];

  let schools: Array<Record<string, unknown>> = [];
  if (schoolIds.length) {
    try {
      schools = await fetchByIds(
        supabase,
        'school_profiles',
        'id, profile_id, school_name, emis_number, province, district, circuit, quintile, learner_count_enrolled, learner_count_verified, learner_count_nsnp_eligible, final_nsnp_approved_enrol, final_emis_enrol, staff_count, status, member_type',
        schoolIds
      );
    } catch {
      try {
        schools = await fetchByIds(
          supabase,
          'school_profiles',
          'id, profile_id, school_name, emis_number, province, district, learner_count_enrolled, learner_count_verified, learner_count_nsnp_eligible, staff_count, status, member_type',
          schoolIds
        );
      } catch {
        schools = [];
      }
    }
  }

  // Education desk only
  schools = schools.filter((s) => {
    const mt = String(s.member_type || 'school');
    return !['hospital', 'clinic', 'shelter'].includes(mt);
  });

  // Optional slice-and-dice within this department's network only
  const filterProvince = dim(filters, 'province').toLowerCase();
  const filterDistrict = dim(filters, 'district').toLowerCase();
  if (filterProvince) {
    schools = schools.filter(
      (s) => String(s.province || '').toLowerCase() === filterProvince
    );
  }
  if (filterDistrict) {
    schools = schools.filter(
      (s) => String(s.district || '').toLowerCase() === filterDistrict
    );
  }

  const learnerOf = (s: Record<string, unknown>) =>
    Number(
      s.learner_count_enrolled ||
        s.final_emis_enrol ||
        s.final_nsnp_approved_enrol ||
        0
    );

  const totalLearners = schools.reduce((n, s) => n + learnerOf(s), 0);
  const totalVerified = schools.reduce(
    (n, s) => n + Number(s.learner_count_verified || 0),
    0
  );
  const totalEligible = schools.reduce(
    (n, s) => n + Number(s.learner_count_nsnp_eligible || 0),
    0
  );
  const totalNsnpApproved = schools.reduce(
    (n, s) => n + Number(s.final_nsnp_approved_enrol || 0),
    0
  );
  const totalStaff = schools.reduce(
    (n, s) => n + Number(s.staff_count || 0),
    0
  );

  const byDistrict = new Map<string, { schools: number; learners: number }>();
  const byProvince = new Map<string, { schools: number; learners: number }>();
  const byQuintile = new Map<string, { schools: number; learners: number }>();
  for (const s of schools) {
    const d = String(s.district || '—').trim() || '—';
    const p = String(s.province || '—').trim() || '—';
    const q =
      s.quintile != null && Number.isFinite(Number(s.quintile))
        ? `Q${Number(s.quintile)}`
        : '—';
    const L = learnerOf(s);
    const dist = byDistrict.get(d) || { schools: 0, learners: 0 };
    dist.schools += 1;
    dist.learners += L;
    byDistrict.set(d, dist);
    const prov = byProvince.get(p) || { schools: 0, learners: 0 };
    prov.schools += 1;
    prov.learners += L;
    byProvince.set(p, prov);
    const quint = byQuintile.get(q) || { schools: 0, learners: 0 };
    quint.schools += 1;
    quint.learners += L;
    byQuintile.set(q, quint);
  }

  // Light ops sample (meals / open compliance) for smaller networks only
  let mealsServed = 0;
  let openCompliance = 0;
  const sampleIds = schools.map((s) => Number(s.id)).filter((n) => n > 0);
  if (sampleIds.length > 0 && sampleIds.length <= 400) {
    try {
      for (let i = 0; i < sampleIds.length; i += 100) {
        const chunk = sampleIds.slice(i, i + 100);
        const [feedRes, compRes] = await Promise.all([
          supabase
            .from('school_feeding_days')
            .select('school_profile_id, served_meals')
            .in('school_profile_id', chunk)
            .gte('feed_date', filters.from)
            .lte('feed_date', filters.to)
            .limit(8000),
          supabase
            .from('school_compliance_events')
            .select('id, status, school_profile_id')
            .in('school_profile_id', chunk)
            .limit(2000),
        ]);
        for (const f of feedRes.data || []) {
          mealsServed += Number(
            (f as { served_meals?: number }).served_meals || 0
          );
        }
        openCompliance += (compRes.data || []).filter(
          (c) =>
            !['closed', 'resolved'].includes(
              String((c as { status?: string }).status || '').toLowerCase()
            )
        ).length;
      }
    } catch {
      /* soft — network pack still valid without ops sample */
    }
  }

  const topSchools = schools
    .slice()
    .sort((a, b) => learnerOf(b) - learnerOf(a))
    .slice(0, 8)
    .map((s) => [
      String(s.school_name || '—').slice(0, 36),
      String(s.district || '—').slice(0, 18),
      learnerOf(s),
      Number(s.learner_count_verified || 0),
    ]);

  const districtRows = [...byDistrict.entries()]
    .sort((a, b) => b[1].learners - a[1].learners || b[1].schools - a[1].schools)
    .slice(0, 8)
    .map(([d, v]) => [d, v.schools, v.learners]);

  const provinceRows = [...byProvince.entries()]
    .sort((a, b) => b[1].learners - a[1].learners || b[1].schools - a[1].schools)
    .slice(0, 8)
    .map(([p, v]) => [p, v.schools, v.learners]);

  const quintileRows = [...byQuintile.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([q, v]) => [q, v.schools, v.learners]);

  const agencyName = String(
    agency.agency_name || agency.name || companyName
  );
  const agencyType = String(agency.agency_type || 'dbe');
  const slice = filters.slice || 'overview';
  const slices = [
    { id: 'overview', label: 'Overview' },
    { id: 'learners', label: 'Learners' },
    { id: 'schools', label: 'Schools' },
    { id: 'district', label: 'By district' },
    { id: 'province', label: 'By province' },
    { id: 'quintile', label: 'By quintile' },
  ];

  let tables: ManagementTable[] = [];
  if (slice === 'learners' || slice === 'schools') {
    tables = [
      {
        title: 'Top schools by learners (this department only)',
        headers: ['School', 'District', 'Enrolled', 'Verified'],
        rows: topSchools.length
          ? (topSchools as Array<Array<string | number>>)
          : [['—', '—', 0, 0]],
      },
    ];
  } else if (slice === 'district') {
    tables = [
      {
        title: 'Schools & learners by district',
        headers: ['District', 'Schools', 'Learners'],
        rows: districtRows.length
          ? (districtRows as Array<Array<string | number>>)
          : [['—', 0, 0]],
      },
    ];
  } else if (slice === 'province') {
    tables = [
      {
        title: 'Schools & learners by province',
        headers: ['Province', 'Schools', 'Learners'],
        rows: provinceRows.length
          ? (provinceRows as Array<Array<string | number>>)
          : [['—', 0, 0]],
      },
    ];
  } else if (slice === 'quintile') {
    tables = [
      {
        title: 'Schools & learners by quintile',
        headers: ['Quintile', 'Schools', 'Learners'],
        rows: quintileRows.length
          ? (quintileRows as Array<Array<string | number>>)
          : [['—', 0, 0]],
      },
    ];
  } else {
    tables = [
      {
        title: 'Department network roll-up',
        headers: ['Metric', 'Value'],
        rows: [
          ['Linked schools (active)', activeLinks.length],
          ['Pending joins', pendingLinks.length],
          ['Suspended', suspendedLinks.length],
          ['Learners enrolled (all joined schools)', totalLearners],
          ['Learners verified', totalVerified],
          ['NSNP eligible', totalEligible || totalNsnpApproved],
          ['Staff (network)', totalStaff],
          ['Districts', byDistrict.size],
          ['Provinces', byProvince.size],
          ...(mealsServed > 0
            ? ([['Meals served (period sample)', mealsServed]] as Array<
                Array<string | number>
              >)
            : []),
          ...(openCompliance > 0
            ? ([['Open compliance items', openCompliance]] as Array<
                Array<string | number>
              >)
            : []),
        ],
      },
      {
        title: 'Top schools by learners',
        headers: ['School', 'District', 'Enrolled', 'Verified'],
        rows: topSchools.slice(0, 5) as Array<Array<string | number>>,
      },
    ];
  }

  const fmt = (n: number) =>
    Number.isFinite(n) ? n.toLocaleString('en-ZA') : '0';

  return {
    ...baseDoc(
      'schools',
      companyId,
      agencyName,
      filters,
      slice,
      slices.find((s) => s.id === slice)?.label || 'Overview',
      slices
    ),
    product: 'NSNP department (DBE / PEU) — network programme pack',
    filterSummary: filterLine([
      `Department ${agencyType.toUpperCase()}`,
      'All joined schools',
      filterProvince ? `Province ${filterProvince}` : '',
      filterDistrict ? `District ${filterDistrict}` : '',
      `${activeLinks.length} active school link(s)`,
      `Period ${filters.from} → ${filters.to}`,
    ]),
    headline:
      'SchoolAdvisor® department pack — learners & schools across the DBE network',
    kpis: [
      kpi(
        'Learners',
        fmt(totalLearners),
        'Sum of enrolled across all schools joined to this department'
      ),
      kpi('Schools', schools.length, 'Joined schools in this filter'),
      kpi('Verified learners', fmt(totalVerified)),
      kpi('NSNP eligible', fmt(totalEligible || totalNsnpApproved)),
      kpi('Districts', byDistrict.size),
      kpi('Pending joins', pendingLinks.length),
      ...(mealsServed > 0
        ? [kpi('Meals served', fmt(mealsServed), 'Period · linked schools')]
        : []),
    ].slice(0, 8),
    tables,
    charts: [
      {
        id: 'learners_network',
        title: 'Network learners (joined schools)',
        type: 'bar',
        series: [
          { label: 'Enrolled', value: totalLearners, color: '#0077b6' },
          { label: 'Verified', value: totalVerified, color: '#059669' },
          {
            label: 'Eligible',
            value: totalEligible || totalNsnpApproved,
            color: '#00b4d8',
          },
          { label: 'Schools', value: schools.length, color: '#7c3aed' },
        ],
      },
      {
        id: 'by_district',
        title: 'Learners by district',
        type: 'horizontal_bar',
        series: [...byDistrict.entries()]
          .sort((a, b) => b[1].learners - a[1].learners)
          .slice(0, 8)
          .map(([d, v], i) => ({
            label: d.slice(0, 16),
            value: v.learners,
            color: ['#0077b6', '#00b4d8', '#059669', '#d97706', '#7c3aed'][
              i % 5
            ],
          })),
      },
    ],
    highlights: [
      `${fmt(totalLearners)} learners rolled up from ${schools.length} school(s) joined to this department`,
      `${activeLinks.length} active · ${pendingLinks.length} pending · ${suspendedLinks.length} suspended join(s)`,
      byProvince.size
        ? `Coverage: ${byProvince.size} province(s), ${byDistrict.size} district(s)`
        : 'No geographic coverage yet',
      'Each school sees only its own school pack — this is the department network view',
    ].slice(0, 5),
    risks: [
      schools.length === 0
        ? 'No schools joined — approve joins on the agency desk'
        : totalLearners === 0
          ? 'Schools linked but learner counts are zero — refresh EMIS / school learner rolls'
          : 'Learner roll-up available from joined schools only',
      pendingLinks.length > 0
        ? `${pendingLinks.length} school join(s) awaiting approval`
        : 'No pending school joins',
      openCompliance > 0
        ? `${openCompliance} open compliance item(s) across sample`
        : 'No open compliance in sample',
    ].slice(0, 5),
    actions: [
      'Approve pending school joins so they enter the learner roll-up',
      'Drive schools to keep learner rolls / EMIS current',
      'Review district coverage gaps on the agency map',
      'Use agency claims / monitoring for period close-out',
    ],
  };
}

/**
 * Single-school owner pack — scoped strictly to this company's school_profiles row.
 * Does not include other schools or the department network.
 */
async function buildSchoolsSingle(
  supabase: SupabaseClient,
  companyId: number,
  companyName: string,
  filters: ManagementReportFilters
): Promise<ManagementReportDoc> {
  const { getOrCreateSchoolProfile } = await import(
    '@/lib/schools/school-context'
  );
  const { school } = await getOrCreateSchoolProfile(supabase, companyId);
  const schoolId = Number(school?.id || 0);
  const name = String(school?.school_name || companyName);

  const [learners, feeding, stock, orders, compliance] = await Promise.all([
    supabase
      .from('school_learners')
      .select('id, grade, status, nsnp_eligible, verification_status')
      .eq('school_profile_id', schoolId)
      .limit(5000),
    supabase
      .from('school_feeding_days')
      .select('feed_date, served_meals, planned_meals, present_count')
      .eq('school_profile_id', schoolId)
      .gte('feed_date', filters.from)
      .lte('feed_date', filters.to)
      .limit(500),
    supabase
      .from('school_kitchen_stock')
      .select('id, qty_on_hand, reorder_level')
      .eq('school_profile_id', schoolId)
      .limit(500),
    supabase
      .from('school_purchase_orders')
      .select('id, status, order_date')
      .eq('school_profile_id', schoolId)
      .gte('order_date', filters.from)
      .lte('order_date', filters.to)
      .limit(200),
    supabase
      .from('school_compliance_events')
      .select('id, status, severity, title')
      .eq('school_profile_id', schoolId)
      .limit(100),
  ]);

  // Kitchen safety + monthly R638 audits (critical for owner / DBE pack)
  let kitchenBand = 'unknown';
  let kitchenLabel = 'Kitchen safety unknown';
  let monthlyRows: Array<Array<string | number>> = [];
  let monthlyKpis: ManagementKpi[] = [];
  let monthlyHighlights: string[] = [];
  let monthlyRisks: string[] = [];
  try {
    const {
      readKitchenPassport,
      evaluateKitchenRisk,
      readMonthlyAudits,
      monthlyAuditStats,
      refreshMonthlyAuditStatuses,
    } = await import('@/lib/schools/kitchen-safety');
    const smeta =
      school?.metadata && typeof school.metadata === 'object'
        ? (school.metadata as Record<string, unknown>)
        : {};
    const risk = evaluateKitchenRisk(readKitchenPassport(smeta));
    kitchenBand = risk.band;
    kitchenLabel = risk.label;
    const monthly = refreshMonthlyAuditStatuses(readMonthlyAudits(smeta)).filter(
      (m) => {
        if (m.status === 'cancelled') return false;
        const d = m.completed_date || m.planned_date;
        if (filters.from && d < filters.from) return false;
        if (filters.to && d > filters.to) return false;
        return true;
      }
    );
    const stats = monthlyAuditStats(monthly, {
      from: filters.from,
      to: filters.to,
    });
    monthlyKpis = [
      kpi('Month audits done', stats.done),
      kpi('Month audits overdue', stats.overdue),
      kpi('Avg R638 score', stats.avg_score != null ? `${stats.avg_score}%` : '—'),
      kpi(
        'This month',
        stats.this_month_status === 'none'
          ? 'Not scheduled'
          : `${stats.this_month_status}${stats.this_month_score != null ? ` · ${stats.this_month_score}%` : ''}`
      ),
    ];
    monthlyRows = monthly
      .slice()
      .sort((a, b) =>
        String(b.planned_date).localeCompare(String(a.planned_date))
      )
      .slice(0, 8)
      .map((m) => [
        m.planned_date,
        m.status,
        m.completed_date || '—',
        m.score != null ? `${m.score}%` : '—',
        m.band || '—',
      ]);
    monthlyHighlights = [
      `${stats.done} monthly R638 audit(s) done in period`,
      stats.avg_score != null
        ? `Average kitchen audit score ${stats.avg_score}%`
        : 'No completed monthly scores yet',
    ];
    monthlyRisks = [
      stats.overdue > 0
        ? `${stats.overdue} overdue monthly audit(s)`
        : 'No overdue monthly audits',
      stats.this_month_status === 'none' || stats.this_month_status === 'overdue'
        ? 'This month kitchen audit not complete'
        : `This month audit: ${stats.this_month_status}`,
    ];
  } catch {
    /* soft */
  }

  const feed = feeding.data || [];
  const served = feed.reduce((n, f) => n + Number(f.served_meals || 0), 0);
  const planned = feed.reduce((n, f) => n + Number(f.planned_meals || 0), 0);
  const learnersN = (learners.data || []).filter(
    (l) => l.status === 'active' || !l.status
  ).length;
  const stockShort = (stock.data || []).filter((s) => {
    const qty = Number(s.qty_on_hand || 0);
    const reorder = Number(s.reorder_level || 0);
    return reorder > 0 ? qty <= reorder : qty <= 0;
  }).length;
  const openCompliance = (compliance.data || []).filter(
    (c) => !['closed', 'resolved'].includes(String(c.status || '').toLowerCase())
  ).length;

  const byGrade = new Map<string, number>();
  for (const l of learners.data || []) {
    const g = String(l.grade || '—');
    byGrade.set(g, (byGrade.get(g) || 0) + 1);
  }
  const gradeRows = [...byGrade.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([g, n]) => [g, n]);

  const feedRows = feed
    .slice()
    .sort((a, b) => String(b.feed_date).localeCompare(String(a.feed_date)))
    .slice(0, 8)
    .map((f) => [
      String(f.feed_date).slice(0, 10),
      Number(f.served_meals || 0),
      Number(f.planned_meals || 0),
      Number(f.present_count || 0),
    ]);

  const slice = filters.slice || 'overview';
  const slices = [
    { id: 'overview', label: 'Overview' },
    { id: 'kitchen_audit', label: 'Kitchen audits' },
    { id: 'meals', label: 'Meals' },
    { id: 'learners', label: 'Learners' },
    { id: 'stock', label: 'Stock' },
    { id: 'compliance', label: 'Compliance' },
  ];

  let tables: ManagementTable[] = [];
  if (slice === 'learners') {
    tables = [
      {
        title: 'Learners by grade',
        headers: ['Grade', 'Count'],
        rows: gradeRows as Array<Array<string | number>>,
      },
    ];
  } else if (slice === 'meals') {
    tables = [
      {
        title: 'Serve days',
        headers: ['Date', 'Served', 'Planned', 'Present'],
        rows: feedRows as Array<Array<string | number>>,
      },
    ];
  } else if (slice === 'stock') {
    tables = [
      {
        title: 'Stock pressure',
        headers: ['Metric', 'Value'],
        rows: [
          ['Stock lines', (stock.data || []).length],
          ['At / below reorder', stockShort],
          ['Orders in period', (orders.data || []).length],
        ],
      },
    ];
  } else if (slice === 'kitchen_audit') {
    tables = [
      {
        title: 'Monthly R638 kitchen audits',
        headers: ['Planned', 'Status', 'Completed', 'Score', 'Band'],
        rows: monthlyRows.length
          ? monthlyRows
          : [['—', 'none', '—', '—', '—']],
      },
    ];
  } else if (slice === 'compliance') {
    tables = [
      {
        title: 'Open compliance',
        headers: ['Title', 'Severity', 'Status'],
        rows: (compliance.data || [])
          .filter(
            (c) =>
              !['closed', 'resolved'].includes(
                String(c.status || '').toLowerCase()
              )
          )
          .slice(0, 8)
          .map((c) => [
            String(c.title || '—').slice(0, 40),
            String(c.severity || '—'),
            String(c.status || '—'),
          ]),
      },
      {
        title: 'Monthly R638 kitchen audits',
        headers: ['Planned', 'Status', 'Completed', 'Score', 'Band'],
        rows: monthlyRows.slice(0, 6).length
          ? monthlyRows.slice(0, 6)
          : [['—', 'none', '—', '—', '—']],
      },
    ];
  } else {
    tables = [
      {
        title: 'Monthly R638 kitchen audits',
        headers: ['Planned', 'Status', 'Completed', 'Score', 'Band'],
        rows: monthlyRows.slice(0, 5).length
          ? monthlyRows.slice(0, 5)
          : [['—', 'none', '—', '—', '—']],
      },
      {
        title: 'Serve days (latest)',
        headers: ['Date', 'Served', 'Planned', 'Present'],
        rows: feedRows.slice(0, 5) as Array<Array<string | number>>,
      },
    ];
  }

  return {
    ...baseDoc(
      'schools',
      companyId,
      name,
      filters,
      slice,
      slices.find((s) => s.id === slice)?.label || 'Overview',
      slices
    ),
    product: 'NSNP school kitchen — this school only',
    filterSummary: filterLine([
      'Single school',
      `EMIS ${school?.emis_number || '—'}`,
      kitchenLabel,
    ]),
    headline:
      'SchoolAdvisor® school pack — this school’s feed, stock & kitchen audits',
    kpis: [
      kpi('Learners', learnersN, 'This school only'),
      kpi('Meals served', served),
      kpi('Kitchen CoA band', kitchenBand),
      kpi('Open compliance', openCompliance),
      ...monthlyKpis.slice(0, 4),
    ].slice(0, 8),
    tables,
    charts: [
      {
        id: 'feeding',
        title: 'Meals planned vs served',
        type: 'bar',
        series: [
          { label: 'Served', value: served, color: '#059669' },
          { label: 'Planned', value: planned, color: '#0077b6' },
          { label: 'Feed days', value: feed.length, color: '#00b4d8' },
          { label: 'Stock short', value: stockShort, color: '#d97706' },
        ],
      },
      {
        id: 'kitchen_audits',
        title: 'Monthly R638 audit scores',
        type: 'line',
        series: monthlyRows
          .slice()
          .reverse()
          .map((r) => {
            const scoreStr = String(r[3] ?? '').replace('%', '');
            const score = Number(scoreStr);
            return {
              label: String(r[0]).slice(5),
              value: Number.isFinite(score) ? score : 0,
              color: '#0077b6',
            };
          })
          .filter((p) => p.value > 0)
          .slice(-10),
      },
    ],
    highlights: [
      `${learnersN} learners enrolled at this school`,
      `${served} meals served across ${feed.length} feed days`,
      kitchenLabel,
      ...monthlyHighlights,
    ].slice(0, 5),
    risks: [
      stockShort > 0 ? `${stockShort} stock line(s) at/below reorder` : 'Stock cover OK',
      kitchenBand === 'red' || kitchenBand === 'amber'
        ? 'Kitchen food safety needs remediation'
        : 'Kitchen safety band acceptable',
      ...monthlyRisks,
      openCompliance > 0
        ? `${openCompliance} open compliance item(s)`
        : 'No open compliance',
    ].slice(0, 5),
    actions: [
      'Schedule and complete this month’s R638 kitchen audit on the calendar',
      'Complete serve-day + daily micro-log',
      'Keep CoA / PIC passport current',
      'Submit claims only when match + SLA + CoA gates are green',
    ],
  };
}

/**
 * SchoolAdvisor management report entry:
 *  - Department (DBE / PEU) → network aggregate of joined schools
 *  - School → this school only
 *  - SP → no school kitchen create; school pack only if they already have a school row
 */
async function buildSchools(
  supabase: SupabaseClient,
  companyId: number,
  companyName: string,
  filters: ManagementReportFilters
): Promise<ManagementReportDoc> {
  const { resolveProgrammeRole } = await import(
    '@/lib/schools/programme-role'
  );
  const roleInfo = await resolveProgrammeRole(supabase, companyId);

  if (roleInfo.role === 'department') {
    let agency: Record<string, unknown> | null = null;
    try {
      const { getAgencyRegistration } = await import(
        '@/lib/schools/approved-catalogue'
      );
      agency = await getAgencyRegistration(supabase, companyId);
    } catch {
      agency = null;
    }
    if (!agency) {
      try {
        const { data } = await supabase
          .from('nsnp_agency_profiles')
          .select('*')
          .eq('profile_id', companyId)
          .maybeSingle();
        agency = (data as Record<string, unknown>) || null;
      } catch {
        agency = null;
      }
    }
    return buildSchoolsAgency(
      supabase,
      companyId,
      companyName,
      filters,
      agency || {
        agency_name: companyName,
        agency_type: 'dbe',
      }
    );
  }

  // School (and SP with an existing school profile): never the department network
  if (roleInfo.role === 'sp') {
    const { data: existing } = await supabase
      .from('school_profiles')
      .select('id')
      .eq('profile_id', companyId)
      .maybeSingle();
    if (!existing) {
      // SP desk — no school kitchen pack; point them at ISP tools
      const slice = filters.slice || 'overview';
      const slices = [{ id: 'overview', label: 'Overview' }];
      return {
        ...baseDoc(
          'schools',
          companyId,
          companyName,
          filters,
          slice,
          'Overview',
          slices
        ),
        product: 'NSNP service provider — not a school kitchen pack',
        filterSummary: filterLine(['Service provider workspace']),
        headline:
          'SchoolAdvisor® SP workspace — use ISP scorecard & orders, not school kitchen pack',
        kpis: [
          kpi('Role', 'Service provider'),
          kpi('School pack', 'N/A'),
        ],
        tables: [
          {
            title: 'Scope',
            headers: ['Note', 'Detail'],
            rows: [
              [
                'Management report',
                'Each school has its own pack; department has the network pack',
              ],
              ['This company', 'Service provider — open ISP desk for SLA & orders'],
            ],
          },
        ],
        highlights: [
          'Schools only see their own school management report',
          'DBE / PEU sees the aggregated network of joined schools',
        ],
        risks: ['SP is not the school kitchen owner pack'],
        actions: [
          'Open ISP desk for deliveries and SLA',
          'Use the department catalogue for approved brands',
        ],
      };
    }
  }

  return buildSchoolsSingle(supabase, companyId, companyName, filters);
}

// ── Health (DoH) ─────────────────────────────────────────────────────────

async function buildHealth(
  supabase: SupabaseClient,
  companyId: number,
  companyName: string,
  filters: ManagementReportFilters
): Promise<ManagementReportDoc> {
  let agency: Record<string, unknown> | null = null;
  try {
    const { data } = await supabase
      .from('health_agency_profiles')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();
    agency = (data as Record<string, unknown>) || null;
  } catch {
    agency = null;
  }

  // Soft: facilities via links if table exists
  let facilities: Array<Record<string, unknown>> = [];
  try {
    const { data, error } = await supabase
      .from('health_facility_links')
      .select('*')
      .eq('agency_profile_id', companyId)
      .limit(200);
    if (!error) facilities = (data || []) as Array<Record<string, unknown>>;
  } catch {
    facilities = [];
  }
  if (!facilities.length) {
    try {
      const { data, error } = await supabase
        .from('health_facilities')
        .select('*')
        .eq('agency_profile_id', companyId)
        .limit(200);
      if (!error) facilities = (data || []) as Array<Record<string, unknown>>;
    } catch {
      facilities = [];
    }
  }

  const active = facilities.filter((f) => {
    const st = String(f.status || f.link_status || '').toLowerCase();
    return st !== 'pending' && st !== 'suspended' && st !== 'rejected';
  });
  const pending = facilities.filter(
    (f) => String(f.status || f.link_status || '').toLowerCase() === 'pending'
  );
  const suspended = facilities.filter(
    (f) => String(f.status || f.link_status || '').toLowerCase() === 'suspended'
  );
  const slice = filters.slice || 'overview';
  const slices = [
    { id: 'overview', label: 'Overview' },
    { id: 'facilities', label: 'Facilities' },
    { id: 'district', label: 'By district' },
  ];

  const byDistrict = new Map<string, number>();
  const byType = new Map<string, number>();
  let patientsProxy = 0;
  for (const f of facilities) {
    const fac = (f.facility || f) as Record<string, unknown>;
    const d = String(fac.district || f.district || '—');
    byDistrict.set(d, (byDistrict.get(d) || 0) + 1);
    const typ = String(
      fac.facility_type || fac.type || fac.member_type || 'facility'
    );
    byType.set(typ, (byType.get(typ) || 0) + 1);
    patientsProxy += Number(
      fac.learner_count_enrolled ||
        fac.patient_count ||
        fac.bed_count ||
        0
    );
  }

  return {
    ...baseDoc(
      'health',
      companyId,
      String(agency?.name || agency?.agency_name || companyName),
      filters,
      slice,
      slices.find((s) => s.id === slice)?.label || 'Overview',
      slices
    ),
    filterSummary: filterLine([
      'DoH programme network',
      `Period ${filters.from} → ${filters.to}`,
    ]),
    headline: 'Health programme owner pack — facilities, coverage & network',
    kpis: [
      kpi('Facilities', facilities.length),
      kpi('Active links', active.length),
      kpi('Pending joins', pending.length),
      kpi('Suspended', suspended.length),
      kpi('Districts', byDistrict.size),
      kpi('Facility types', byType.size),
      kpi(
        'Patients / beds proxy',
        patientsProxy || '—',
        'From facility enrol fields when present'
      ),
      kpi('Agency profile', agency ? 'Yes' : 'No'),
    ],
    tables: [
      {
        title: 'Facilities by district',
        headers: ['District', 'Count'],
        rows: [...byDistrict.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([d, n]) => [d, n]),
      },
      {
        title: 'Facilities',
        headers: ['Name', 'Status', 'District', 'Type'],
        rows: facilities.slice(0, 8).map((f) => {
          const fac = (f.facility || f) as Record<string, unknown>;
          return [
            String(fac.name || fac.facility_name || '—'),
            String(f.link_status || f.status || '—'),
            String(fac.district || f.district || '—'),
            String(fac.facility_type || fac.type || '—'),
          ];
        }),
      },
      {
        title: 'By facility type',
        headers: ['Type', 'Count'],
        rows: [...byType.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([t, n]) => [t, n]),
      },
    ],
    charts: [
      {
        id: 'health_network',
        title: 'Programme network',
        type: 'bar',
        series: [
          { label: 'Facilities', value: facilities.length, color: '#0077b6' },
          { label: 'Active', value: active.length, color: '#059669' },
          { label: 'Pending', value: pending.length, color: '#d97706' },
          { label: 'Districts', value: byDistrict.size, color: '#7c3aed' },
        ],
      },
      {
        id: 'by_district',
        title: 'Facilities by district',
        type: 'horizontal_bar',
        series: [...byDistrict.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([d, n], i) => ({
            label: d.slice(0, 16),
            value: n,
            color: ['#0077b6', '#00b4d8', '#059669', '#d97706', '#7c3aed', '#0d9488'][
              i % 6
            ],
          })),
      },
    ],
    highlights: [
      `${facilities.length} facilities on the programme book · ${active.length} active`,
      `${byDistrict.size} district(s) · ${byType.size} facility type(s)`,
      pending.length
        ? `${pending.length} join(s) awaiting approval`
        : 'No pending facility joins',
    ],
    risks: [
      facilities.length === 0
        ? 'No facilities linked — use join / facilities desk'
        : 'Network has facilities',
      pending.length > 5
        ? 'Large pending queue — prioritise approvals'
        : 'Pending queue manageable',
    ],
    actions: [
      'Approve pending facility joins',
      'Review district coverage gaps',
      'Align approved nutrition catalogue',
      'Drive facilities to keep enrol / bed counts current',
    ],
  };
}

// ── HireAdvisor® rental marketplace ──────────────────────────────────────

async function buildHire(
  meta: Record<string, unknown>,
  companyId: number,
  companyName: string,
  filters: ManagementReportFilters
): Promise<ManagementReportDoc> {
  const {
    readHiregraphFromMetadata,
    summariseHiregraph,
    HIRE_CATEGORIES,
  } = await import('@/lib/hire/hiregraph');
  const {
    HIRE_CUSTOMER_COMMISSION_PCT,
    HIRE_SUPPLIER_COMMISSION_PCT,
  } = await import('@/lib/hire/commercial');
  const store = readHiregraphFromMetadata(meta);
  const summary = summariseHiregraph(store);
  const slice = filters.slice || 'overview';
  const slices = [
    { id: 'overview', label: 'Overview' },
    { id: 'bookings', label: 'Bookings' },
    { id: 'catalogue', label: 'Catalogue' },
    { id: 'settlements', label: 'Settlements' },
  ];

  const kpis: ManagementKpi[] = [
    kpi('Suppliers', summary.supplierCount),
    kpi('Customers (B2C)', summary.customerCount),
    kpi('Listed items', summary.listedItems, `${summary.itemCount} total`),
    kpi('Open bookings', summary.openBookings, `${summary.outNow} out now`),
    kpi(
      'Hire GMV',
      `R${Number(summary.gmvZar || 0).toLocaleString('en-ZA')}`
    ),
    kpi(
      `Supplier ${HIRE_SUPPLIER_COMMISSION_PCT}%`,
      `R${Number(summary.supplierCommissionZar || 0).toLocaleString('en-ZA')}`
    ),
    kpi(
      `Customer ${HIRE_CUSTOMER_COMMISSION_PCT}%`,
      `R${Number(summary.customerCommissionZar || 0).toLocaleString('en-ZA')}`
    ),
    kpi(
      'Platform total',
      `R${Number(summary.platformFeesZar || 0).toLocaleString('en-ZA')}`
    ),
  ];

  let tables: ManagementTable[] = [
    {
      title: 'Open bookings',
      headers: ['Code', 'Item', 'Customer', 'Status'],
      rows: store.bookings
        .filter((b) =>
          ['requested', 'awaiting_requirements', 'approved', 'paid', 'out'].includes(
            String(b.status || '')
          )
        )
        .slice(0, 8)
        .map((b) => [
          b.code,
          b.item_title || '—',
          b.customer_name || '—',
          b.status || '—',
        ]),
    },
    {
      title: 'Catalogue by category',
      headers: ['Category', 'Items'],
      rows: HIRE_CATEGORIES.map((c) => [
        c.short,
        (summary.categoryCounts as Record<string, number>)?.[c.id] || 0,
      ])
        .filter(([, n]) => Number(n) > 0)
        .slice(0, 8) as Array<Array<string | number>>,
    },
  ];

  if (slice === 'bookings') {
    tables = [
      {
        title: 'Bookings',
        headers: ['Code', 'Item', 'Customer pays', 'Status'],
        rows: store.bookings.slice(0, 8).map((b) => [
          b.code,
          b.item_title || '—',
          b.customer_pays_zar != null
            ? Number(b.customer_pays_zar).toLocaleString('en-ZA')
            : '—',
          b.status || '—',
        ]),
      },
    ];
  } else if (slice === 'catalogue') {
    tables = [
      {
        title: 'Catalogue',
        headers: ['Code', 'Title', 'Category', 'Rate'],
        rows: store.items.slice(0, 8).map((i) => [
          i.code,
          i.title,
          i.category_name || i.category_id,
          `R${Number(i.rate_zar || 0).toLocaleString('en-ZA')}/${i.rate_unit || 'day'}`,
        ]),
      },
    ];
  } else if (slice === 'settlements') {
    tables = [
      {
        title: 'Commission ledger',
        headers: ['Code', 'Rental', 'Supp. fee', 'Cust. fee', 'Platform'],
        rows: store.bookings
          .filter((b) => Number(b.platform_total_zar) > 0)
          .slice(0, 8)
          .map((b) => [
            b.code,
            Number(b.rental_zar || 0).toLocaleString('en-ZA'),
            Number(b.supplier_commission_zar || 0).toLocaleString('en-ZA'),
            Number(b.customer_commission_zar || 0).toLocaleString('en-ZA'),
            Number(b.platform_total_zar || 0).toLocaleString('en-ZA'),
          ]),
      },
    ];
  }

  const base = baseDoc(
    'hiregraph',
    companyId,
    companyName,
    filters,
    slice,
    slices.find((s) => s.id === slice)?.label || 'Overview',
    slices
  );

  return {
    ...base,
    filterSummary: filterLine([
      `${filters.from} → ${filters.to}`,
      `Slice: ${slice}`,
      `${HIRE_SUPPLIER_COMMISSION_PCT}% on the business · members free`,
    ]),
    headline:
      summary.openBookings > 0 || summary.gmvZar > 0
        ? `${summary.openBookings} open hires · R${Number(summary.gmvZar || 0).toLocaleString('en-ZA')} GMV · R${Number(summary.platformFeesZar || 0).toLocaleString('en-ZA')} platform (${HIRE_SUPPLIER_COMMISSION_PCT}% · members free)`
        : 'HireAdvisor® marketplace — list gear, take free B2C bookings, earn 2.5% on the listing business',
    kpis,
    tables,
    highlights: [
      `${summary.supplierCount} hire suppliers · ${summary.customerCount} B2C renters`,
      `${summary.listedItems} listed items across categories`,
      `Take-rate: ${HIRE_SUPPLIER_COMMISSION_PCT}% on the listing business · members free (deposits not commissionable)`,
    ],
    risks: [
      summary.openBookings > 0 && summary.outNow === 0
        ? 'Open bookings but nothing marked out — check handovers'
        : '',
      store.bookings.some(
        (b) =>
          b.status === 'awaiting_requirements' &&
          (b.requirements_pending || []).length > 0
      )
        ? 'Bookings blocked on category requirements'
        : '',
    ].filter(Boolean),
    actions: [
      'Clear outstanding category requirements on open bookings',
      'Record OUT / RETURN handovers with condition notes',
      'Complete returned bookings so supplier commission posts to GMV',
    ],
  };
}

// ── Public entry ─────────────────────────────────────────────────────────

export async function buildAdvisorManagementReport(opts: {
  advisor: AdvisorReportId;
  companyId: number;
  companyName?: string;
  filters: ManagementReportFilters;
  supabase: SupabaseClient;
  profileMeta?: Record<string, unknown>;
  profileName?: string;
}): Promise<ManagementReportDoc> {
  const { advisor, companyId, filters, supabase } = opts;
  const companyName =
    opts.companyName || opts.profileName || `Company #${companyId}`;
  const meta = opts.profileMeta || {};

  let core: ManagementReportDoc;

  if (advisor === 'fitgraph') {
    core = await buildFit(meta, companyId, companyName, filters);
  } else if (advisor === 'fieldgraph') {
    core = await buildField(meta, companyId, companyName, filters);
  } else if (advisor === 'quarrygraph') {
    core = await buildQuarry(meta, companyId, companyName, filters);
  } else if (advisor === 'hiregraph') {
    core = await buildHire(meta, companyId, companyName, filters);
  } else if (advisor === 'schools') {
    core = await buildSchools(supabase, companyId, companyName, filters);
  } else if (advisor === 'health') {
    core = await buildHealth(supabase, companyId, companyName, filters);
  } else if (advisor === 'physiograph') {
    const { readPhysiographFromMetadata } = await import(
      '@/lib/clinic/physiograph'
    );
    core = buildClinicReport(
      advisor,
      readPhysiographFromMetadata(meta) as ClinicLikeStore,
      companyId,
      companyName,
      filters
    );
  } else if (advisor === 'dentalgraph') {
    const { readDentalgraphFromMetadata } = await import(
      '@/lib/dental/dentalgraph'
    );
    core = buildClinicReport(
      advisor,
      readDentalgraphFromMetadata(meta) as ClinicLikeStore,
      companyId,
      companyName,
      filters
    );
  } else if (advisor === 'medicalgraph') {
    const { readMedicalgraphFromMetadata } = await import(
      '@/lib/clinic/medicalgraph'
    );
    core = buildClinicReport(
      advisor,
      readMedicalgraphFromMetadata(meta) as ClinicLikeStore,
      companyId,
      companyName,
      filters
    );
  } else if (advisor === 'vetgraph') {
    const { readVetgraphFromMetadata } = await import('@/lib/clinic/vetgraph');
    core = buildClinicReport(
      advisor,
      readVetgraphFromMetadata(meta) as ClinicLikeStore,
      companyId,
      companyName,
      filters
    );
  } else if (advisor === 'psychiatrygraph') {
    const { readPsychiatrygraphFromMetadata } = await import(
      '@/lib/clinic/psychiatrygraph'
    );
    core = buildClinicReport(
      advisor,
      readPsychiatrygraphFromMetadata(meta) as ClinicLikeStore,
      companyId,
      companyName,
      filters
    );
  } else {
    throw new Error(`Unknown advisor: ${advisor}`);
  }

  // Enrich every Advisor pack with company commercial + network metrics
  try {
    const {
      loadCompanyManagementMetrics,
      mergeCompanyMetricsIntoReport,
    } = await import('@/lib/advisors/company-management-metrics');
    const company = await loadCompanyManagementMetrics(
      supabase,
      companyId,
      { from: filters.from, to: filters.to },
      meta
    );
    return mergeCompanyMetricsIntoReport(
      core,
      company,
      filters.slice || core.slice || 'overview'
    );
  } catch {
    return core;
  }
}
