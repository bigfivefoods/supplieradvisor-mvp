'use client';

import { useMemo, useState } from 'react';
import { Download, Filter } from 'lucide-react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, StatRow, fc } from '@/components/fitness/FitForm';
import {
  buildFullReport,
  downloadCsv,
  feelingLabel,
  numLabel,
  pctLabel,
  rangeFromPreset,
  toCsv,
  type ReportDatePreset,
  type ReportFilters,
} from '@/lib/fitness/fitgraph-reports';
import { getCoachSpecialtyOptions } from '@/lib/fitness/fitgraph';
import ManagementReportPanel from '@/components/advisors/ManagementReportPanel';

type TabId =
  | 'overview'
  | 'coaches'
  | 'classes'
  | 'plan_actual'
  | 'feedback'
  | 'members'
  | 'daily';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'coaches', label: 'Coaches' },
  { id: 'classes', label: 'Classes' },
  { id: 'plan_actual', label: 'Plan vs actual' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'members', label: 'Member · classes' },
  { id: 'daily', label: 'By day' },
];

const PRESETS: { id: ReportDatePreset; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'ytd', label: 'YTD' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

export default function FitReportPage() {
  const { store, loading, summary } = useFitgraph();
  const initial = rangeFromPreset('30d');
  const [preset, setPreset] = useState<ReportDatePreset>('30d');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [coachId, setCoachId] = useState('');
  const [classTypeId, setClassTypeId] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [feedbackRole, setFeedbackRole] = useState<'' | 'member' | 'coach'>(
    ''
  );
  const [sessionStatus, setSessionStatus] = useState<
    '' | 'scheduled' | 'completed' | 'cancelled' | 'full'
  >('');
  const [tab, setTab] = useState<TabId>('overview');
  /** members tab: all | assigned | unassigned */
  const [memberAssignFilter, setMemberAssignFilter] = useState<
    'all' | 'assigned' | 'unassigned'
  >('all');

  const filters: ReportFilters = useMemo(
    () => ({
      from,
      to,
      coachId,
      classTypeId,
      specialty,
      feedbackRole,
      sessionStatus,
    }),
    [from, to, coachId, classTypeId, specialty, feedbackRole, sessionStatus]
  );

  const report = useMemo(() => {
    if (!store) return null;
    return buildFullReport(store, filters);
  }, [store, filters]);

  const specialties = useMemo(
    () => (store ? getCoachSpecialtyOptions(store) : []),
    [store]
  );

  const applyPreset = (p: ReportDatePreset) => {
    setPreset(p);
    if (p === 'custom') return;
    const r = rangeFromPreset(p);
    setFrom(r.from);
    setTo(r.to);
  };

  const exportCurrent = () => {
    if (!report || !store) return;
    const stamp = `${from}_${to}`;
    try {
      if (tab === 'coaches') {
        downloadCsv(
          `fitgraph_coaches_${stamp}.csv`,
          toCsv(
            [
              'Code',
              'Name',
              'Specialties',
              'Active',
              'Rate',
              'Sessions',
              'Planned',
              'Attended',
              'No-show',
              'Waitlist',
              'Capacity seats',
              'Fill %',
              'Show-up %',
              'Member FB',
              'Coach FB',
              'Avg feel',
              'Avg RPE',
              'Coach feel',
              'Coach RPE',
            ],
            report.coaches.map((r) => [
              r.code,
              r.name,
              r.specialties.join('; '),
              r.active ? 'Y' : 'N',
              r.rate,
              r.sessions,
              r.planned,
              r.attended,
              r.no_show,
              r.waitlist,
              r.capacity_seats,
              r.fill_pct,
              r.show_up_pct,
              r.member_feedback,
              r.coach_feedback,
              r.avg_member_feeling,
              r.avg_member_intensity,
              r.avg_coach_feeling,
              r.avg_coach_intensity,
            ])
          )
        );
      } else if (tab === 'classes') {
        downloadCsv(
          `fitgraph_classes_${stamp}.csv`,
          toCsv(
            [
              'Code',
              'Name',
              'Category',
              'Sessions',
              'Planned',
              'Attended',
              'No-show',
              'Waitlist',
              'Capacity',
              'Fill %',
              'Show-up %',
              'Member FB',
              'Avg feel',
              'Avg RPE',
              'Avg enjoy',
            ],
            report.classes.map((r) => [
              r.code,
              r.name,
              r.category,
              r.sessions,
              r.planned,
              r.attended,
              r.no_show,
              r.waitlist,
              r.capacity_seats,
              r.fill_pct,
              r.show_up_pct,
              r.member_feedback,
              r.avg_feeling,
              r.avg_intensity,
              r.avg_enjoyment,
            ])
          )
        );
      } else if (tab === 'plan_actual') {
        downloadCsv(
          `fitgraph_plan_actual_${stamp}.csv`,
          toCsv(
            [
              'Date',
              'Time',
              'Class',
              'Coach',
              'Status',
              'Capacity',
              'Planned',
              'Waitlist',
              'Attended',
              'No-show',
              'Pending',
              'Plan fill %',
              'Fill %',
              'Show-up %',
              'Member FB',
              'Avg feel',
              'Avg RPE',
            ],
            report.planActual.map((r) => [
              r.session.date,
              r.session.start_time,
              r.class_name,
              r.coach_name,
              r.session.status,
              r.capacity,
              r.planned,
              r.waitlist,
              r.attended,
              r.no_show,
              r.pending,
              r.plan_fill_pct,
              r.fill_pct,
              r.show_up_pct,
              r.feedback_member,
              r.avg_feeling,
              r.avg_intensity,
            ])
          )
        );
      } else if (tab === 'feedback') {
        downloadCsv(
          `fitgraph_feedback_${stamp}.csv`,
          toCsv(
            [
              'When',
              'Date',
              'Time',
              'Class',
              'Coach',
              'Role',
              'Author',
              'Feel',
              'Intensity',
              'Enjoy',
              'Again',
              'Tags',
              'Comment',
            ],
            report.feedback.map((r) => [
              (r.updated_at || r.created_at || '').slice(0, 16),
              r.session_date,
              r.session_time,
              r.class_name,
              r.coach_name,
              r.role,
              r.author_label,
              r.feeling,
              r.intensity,
              r.enjoyment,
              r.would_return,
              (r.tags || []).join('; '),
              r.comment || '',
            ])
          )
        );
      } else if (tab === 'members') {
        const memberRows =
          memberAssignFilter === 'assigned'
            ? report.members.filter((m) => m.assigned)
            : memberAssignFilter === 'unassigned'
              ? report.members.filter((m) => !m.assigned)
              : report.members;
        downloadCsv(
          `fitgraph_member_class_assignment_${stamp}.csv`,
          toCsv(
            [
              'Code',
              'Name',
              'Email',
              'Status',
              'Plan',
              'Home coach',
              'Assigned',
              'Class count',
              'Classes (date time · type · coach · status)',
              'Bookings',
              'Waitlist',
              'Attended',
              'No-show',
              'Check-ins',
              'Feedback',
            ],
            memberRows.map((r) => [
              r.code,
              r.name,
              r.email || '',
              r.status,
              r.plan,
              r.coach,
              r.assigned ? 'yes' : 'no',
              r.class_count,
              r.classes_label,
              r.bookings_in_range,
              r.waitlist_in_range,
              r.attended_in_range,
              r.no_show_in_range,
              r.check_ins_in_range,
              r.feedback_in_range,
            ])
          )
        );
      } else if (tab === 'daily') {
        downloadCsv(
          `fitgraph_daily_${stamp}.csv`,
          toCsv(
            ['Date', 'Sessions', 'Planned', 'Attended', 'No-show', 'Feedback'],
            report.daily.map((r) => [
              r.date,
              r.sessions,
              r.planned,
              r.attended,
              r.no_show,
              r.feedback,
            ])
          )
        );
      } else {
        // overview — export session facts summary KPIs + plan actual
        downloadCsv(
          `fitgraph_overview_sessions_${stamp}.csv`,
          toCsv(
            [
              'Date',
              'Time',
              'Class',
              'Coach',
              'Planned',
              'Attended',
              'No-show',
              'Fill %',
              'Show-up %',
            ],
            report.sessions.map((r) => [
              r.session.date,
              r.session.start_time,
              r.class_name,
              r.coach_name,
              r.planned,
              r.attended,
              r.no_show,
              r.fill_pct,
              r.show_up_pct,
            ])
          )
        );
      }
      toast.success('CSV downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const maxDaily = useMemo(() => {
    if (!report?.daily.length) return 1;
    return Math.max(
      1,
      ...report.daily.map((d) =>
        Math.max(d.sessions, d.planned, d.attended, d.feedback)
      )
    );
  }, [report]);

  return (
    <FitgraphWorkbench
      title="Management report"
      titleAccent="Govern · A4 landscape"
      description="Filter by date, coach, class type and specialty. Member · classes shows who is on which classes (multi-class OK) and who is unassigned. Export any tab as CSV."
    >

      <ManagementReportPanel advisor="fitgraph" className="mb-6" />
      {loading || !store || !report ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-5">
          {/* Filters */}
          <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4 space-y-3 dark:border-violet-600/50 dark:bg-violet-950/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-violet-950 dark:text-violet-50 inline-flex items-center gap-1.5">
                <Filter className="w-4 h-4" /> Slice filters
              </h3>
              <button
                type="button"
                onClick={exportCurrent}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300 bg-white px-3 py-1.5 text-xs font-bold text-violet-900 hover:bg-violet-100 dark:border-violet-500 dark:bg-violet-950 dark:text-violet-100"
              >
                <Download className="w-3.5 h-3.5" /> Export {tab.replace('_', ' ')} CSV
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                    preset === p.id
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : 'border-violet-200 bg-white text-violet-900 dark:border-violet-600 dark:bg-violet-950 dark:text-violet-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
              <label className="block">
                <span className="text-[10px] font-black uppercase text-violet-800 dark:text-violet-300">
                  From
                </span>
                <input
                  type="date"
                  className={fc() + ' mt-0.5'}
                  value={from}
                  onChange={(e) => {
                    setPreset('custom');
                    setFrom(e.target.value);
                  }}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase text-violet-800 dark:text-violet-300">
                  To
                </span>
                <input
                  type="date"
                  className={fc() + ' mt-0.5'}
                  value={to}
                  onChange={(e) => {
                    setPreset('custom');
                    setTo(e.target.value);
                  }}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase text-violet-800 dark:text-violet-300">
                  Coach
                </span>
                <select
                  className={fc() + ' mt-0.5'}
                  value={coachId}
                  onChange={(e) => setCoachId(e.target.value)}
                >
                  <option value="">All coaches</option>
                  {store.coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase text-violet-800 dark:text-violet-300">
                  Class type
                </span>
                <select
                  className={fc() + ' mt-0.5'}
                  value={classTypeId}
                  onChange={(e) => setClassTypeId(e.target.value)}
                >
                  <option value="">All classes</option>
                  {store.class_types.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase text-violet-800 dark:text-violet-300">
                  Specialty
                </span>
                <select
                  className={fc() + ' mt-0.5'}
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                >
                  <option value="">All specialties</option>
                  {specialties.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase text-violet-800 dark:text-violet-300">
                  Session status
                </span>
                <select
                  className={fc() + ' mt-0.5'}
                  value={sessionStatus}
                  onChange={(e) =>
                    setSessionStatus(
                      e.target.value as ReportFilters['sessionStatus']
                    )
                  }
                >
                  <option value="">All statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="full">Full</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>
            {tab === 'feedback' && (
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['', 'All feedback'],
                    ['member', 'Members only'],
                    ['coach', 'Coaches only'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v || 'all'}
                    type="button"
                    onClick={() => setFeedbackRole(v)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                      feedbackRole === v
                        ? 'border-violet-600 bg-violet-600 text-white'
                        : 'border-violet-200 bg-white text-violet-900 dark:border-violet-600 dark:bg-violet-950 dark:text-violet-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-violet-800/70 dark:text-violet-200/70">
              Showing <strong>{report.sessions.length}</strong> sessions ·{' '}
              {from} → {to}
              {coachId
                ? ` · coach ${store.coaches.find((c) => c.id === coachId)?.name || ''}`
                : ''}
              {classTypeId
                ? ` · ${store.class_types.find((c) => c.id === classTypeId)?.name || ''}`
                : ''}
              {specialty ? ` · specialty ${specialty}` : ''}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700 pb-px">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-t-xl px-3 py-2 text-xs font-bold transition-colors ${
                  tab === t.id
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-4">
              <StatRow
                tone="owner"
                items={[
                  { label: 'Sessions', value: report.overview.sessions },
                  { label: 'Completed', value: report.overview.completed },
                  {
                    label: 'Coaches teaching',
                    value: report.overview.coaches_teaching,
                  },
                  {
                    label: 'Class types',
                    value: report.overview.class_types_run,
                  },
                  {
                    label: 'Planned seats',
                    value: report.overview.planned_seats,
                  },
                  { label: 'Attended', value: report.overview.attended },
                  { label: 'No-shows', value: report.overview.no_show },
                  {
                    label: 'Pending actuals',
                    value: report.overview.pending_actuals,
                  },
                  {
                    label: 'Fill %',
                    value: pctLabel(report.overview.fill_pct),
                  },
                  {
                    label: 'Show-up %',
                    value: pctLabel(report.overview.show_up_pct),
                  },
                  {
                    label: 'Member feedback',
                    value: report.overview.member_feedback,
                  },
                  {
                    label: 'Coach feedback',
                    value: report.overview.coach_feedback,
                  },
                  {
                    label: 'Avg feel',
                    value: numLabel(report.overview.avg_feeling),
                  },
                  {
                    label: 'Avg intensity',
                    value: numLabel(report.overview.avg_intensity),
                  },
                  {
                    label: 'Check-ins',
                    value: report.overview.check_ins_in_range,
                  },
                  {
                    label: 'Active members',
                    value:
                      report.overview.active_members ||
                      Number(summary?.activeMembers) ||
                      0,
                  },
                  {
                    label: 'Open bookings',
                    value: report.overview.open_bookings,
                  },
                  {
                    label: 'PT remaining',
                    value: report.overview.pt_remaining,
                  },
                ]}
              />

              {report.daily.length > 0 && (
                <div className="rounded-2xl border border-violet-200 bg-white p-4 dark:border-violet-600/40 dark:bg-violet-950/30">
                  <h4 className="text-xs font-black uppercase tracking-wider text-violet-700 dark:text-violet-300 mb-3">
                    Daily pulse (attended vs planned)
                  </h4>
                  <div className="flex items-end gap-1 h-28 overflow-x-auto pb-1">
                    {report.daily.map((d) => (
                      <div
                        key={d.date}
                        className="flex flex-col items-center gap-0.5 min-w-[1.75rem] flex-1"
                        title={`${d.date}: planned ${d.planned}, attended ${d.attended}`}
                      >
                        <div className="flex items-end gap-0.5 h-20 w-full justify-center">
                          <div
                            className="w-1.5 rounded-t bg-violet-200 dark:bg-violet-700"
                            style={{
                              height: `${Math.max(4, (d.planned / maxDaily) * 100)}%`,
                            }}
                          />
                          <div
                            className="w-1.5 rounded-t bg-emerald-500"
                            style={{
                              height: `${Math.max(4, (d.attended / maxDaily) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[8px] font-bold text-slate-500 tabular-nums">
                          {d.date.slice(5)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    <span className="inline-block w-2 h-2 rounded-sm bg-violet-200 mr-1" />{' '}
                    Planned
                    <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 ml-3 mr-1" />{' '}
                    Attended
                  </p>
                </div>
              )}

              <DataTable
                tone="owner"
                headers={[
                  'Date',
                  'Time',
                  'Class',
                  'Coach',
                  'Plan',
                  'Act',
                  'No-show',
                  'Fill %',
                  'Feel',
                  'RPE',
                ]}
                rows={report.sessions.slice(0, 25).map((r) => ({
                  id: r.session.id,
                  cells: [
                    r.session.date,
                    r.session.start_time,
                    r.class_name,
                    r.coach_name,
                    r.planned,
                    r.attended,
                    r.no_show,
                    pctLabel(r.fill_pct),
                    numLabel(r.avg_feeling),
                    numLabel(r.avg_intensity),
                  ],
                }))}
              />
              {report.sessions.length > 25 && (
                <p className="text-[11px] text-slate-500">
                  Showing 25 of {report.sessions.length} sessions — open{' '}
                  <button
                    type="button"
                    className="font-bold text-violet-700 underline"
                    onClick={() => setTab('plan_actual')}
                  >
                    Plan vs actual
                  </button>{' '}
                  for the full list.
                </p>
              )}
            </div>
          )}

          {/* COACHES */}
          {tab === 'coaches' && (
            <div className="space-y-4">
              <StatRow
                tone="coach"
                items={[
                  {
                    label: 'Coaches in slice',
                    value: report.coaches.filter((c) => c.sessions > 0).length,
                  },
                  {
                    label: 'Sessions',
                    value: report.coaches.reduce((n, c) => n + c.sessions, 0),
                  },
                  {
                    label: 'Attended seats',
                    value: report.coaches.reduce((n, c) => n + c.attended, 0),
                  },
                  {
                    label: 'Member feedback',
                    value: report.coaches.reduce(
                      (n, c) => n + c.member_feedback,
                      0
                    ),
                  },
                ]}
              />
              <DataTable
                tone="coach"
                headers={[
                  'Code',
                  'Coach',
                  'Specialties',
                  'Rate',
                  'Sessions',
                  'Planned',
                  'Attended',
                  'No-show',
                  'Fill %',
                  'Show-up %',
                  'M-FB',
                  'C-FB',
                  'Avg feel',
                  'Avg RPE',
                  'Coach feel',
                  'Coach RPE',
                ]}
                rows={report.coaches.map((r) => ({
                  id: r.coach_id,
                  cells: [
                    r.code,
                    r.name,
                    r.specialties.join(', ') || '—',
                    r.rate,
                    r.sessions,
                    r.planned,
                    r.attended,
                    r.no_show,
                    pctLabel(r.fill_pct),
                    pctLabel(r.show_up_pct),
                    r.member_feedback,
                    r.coach_feedback,
                    numLabel(r.avg_member_feeling),
                    numLabel(r.avg_member_intensity),
                    numLabel(r.avg_coach_feeling),
                    numLabel(r.avg_coach_intensity),
                  ],
                }))}
              />
            </div>
          )}

          {/* CLASSES */}
          {tab === 'classes' && (
            <div className="space-y-4">
              <StatRow
                tone="owner"
                items={[
                  { label: 'Class types', value: report.classes.length },
                  {
                    label: 'Sessions',
                    value: report.classes.reduce((n, c) => n + c.sessions, 0),
                  },
                  {
                    label: 'Attended',
                    value: report.classes.reduce((n, c) => n + c.attended, 0),
                  },
                  {
                    label: 'Waitlist hits',
                    value: report.classes.reduce((n, c) => n + c.waitlist, 0),
                  },
                ]}
              />
              <DataTable
                tone="owner"
                headers={[
                  'Code',
                  'Class',
                  'Category',
                  'Sessions',
                  'Planned',
                  'Attended',
                  'No-show',
                  'Waitlist',
                  'Capacity',
                  'Fill %',
                  'Show-up %',
                  'Feedback',
                  'Avg feel',
                  'Avg RPE',
                  'Avg enjoy',
                ]}
                rows={report.classes.map((r) => ({
                  id: r.class_type_id,
                  cells: [
                    r.code,
                    r.name,
                    r.category,
                    r.sessions,
                    r.planned,
                    r.attended,
                    r.no_show,
                    r.waitlist,
                    r.capacity_seats,
                    pctLabel(r.fill_pct),
                    pctLabel(r.show_up_pct),
                    r.member_feedback,
                    numLabel(r.avg_feeling),
                    numLabel(r.avg_intensity),
                    numLabel(r.avg_enjoyment),
                  ],
                }))}
              />
            </div>
          )}

          {/* PLAN VS ACTUAL */}
          {tab === 'plan_actual' && (
            <div className="space-y-4">
              <StatRow
                tone="owner"
                items={[
                  {
                    label: 'Plan seats',
                    value: report.overview.planned_seats,
                  },
                  { label: 'Attended', value: report.overview.attended },
                  { label: 'No-shows', value: report.overview.no_show },
                  {
                    label: 'Still pending',
                    value: report.overview.pending_actuals,
                  },
                  {
                    label: 'Show-up %',
                    value: pctLabel(report.overview.show_up_pct),
                  },
                  {
                    label: 'Capacity fill',
                    value: pctLabel(report.overview.fill_pct),
                  },
                ]}
              />
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                <strong>Plan</strong> = booked + attended + no-show (who was on
                the list). <strong>Actual</strong> = marked attended / no-show.
                Pending = still “booked” without an actual mark.
              </p>
              <DataTable
                tone="owner"
                headers={[
                  'Date',
                  'Time',
                  'Class',
                  'Coach',
                  'Status',
                  'Cap',
                  'Plan',
                  'WL',
                  'Attended',
                  'No-show',
                  'Pending',
                  'Plan fill',
                  'Fill %',
                  'Show-up %',
                  'M-FB',
                  'Feel',
                  'RPE',
                ]}
                rows={report.planActual.map((r) => ({
                  id: r.session.id,
                  cells: [
                    r.session.date,
                    r.session.start_time,
                    r.class_name,
                    r.coach_name,
                    r.session.status,
                    r.capacity || '—',
                    r.planned,
                    r.waitlist,
                    r.attended,
                    r.no_show,
                    r.pending,
                    pctLabel(r.plan_fill_pct),
                    pctLabel(r.fill_pct),
                    pctLabel(r.show_up_pct),
                    r.feedback_member,
                    numLabel(r.avg_feeling),
                    numLabel(r.avg_intensity),
                  ],
                }))}
              />
            </div>
          )}

          {/* FEEDBACK */}
          {tab === 'feedback' && (
            <div className="space-y-4">
              <StatRow
                tone="member"
                items={[
                  {
                    label: 'Responses',
                    value: report.feedback.length,
                  },
                  {
                    label: 'Members',
                    value: report.feedback.filter((f) => f.role === 'member')
                      .length,
                  },
                  {
                    label: 'Coaches',
                    value: report.feedback.filter((f) => f.role === 'coach')
                      .length,
                  },
                  {
                    label: 'Avg feel (all)',
                    value: numLabel(
                      report.feedback.length
                        ? Math.round(
                            (report.feedback.reduce(
                              (n, f) => n + f.feeling,
                              0
                            ) /
                              report.feedback.length) *
                              10
                          ) / 10
                        : null
                    ),
                  },
                  {
                    label: 'Avg RPE (all)',
                    value: numLabel(
                      report.feedback.length
                        ? Math.round(
                            (report.feedback.reduce(
                              (n, f) => n + f.intensity,
                              0
                            ) /
                              report.feedback.length) *
                              10
                          ) / 10
                        : null
                    ),
                  },
                ]}
              />
              <DataTable
                tone="member"
                headers={[
                  'Submitted',
                  'Date',
                  'Class',
                  'Coach',
                  'Role',
                  'Who',
                  'Feel',
                  'RPE',
                  'Enjoy',
                  'Again',
                  'Tags',
                  'Comment',
                ]}
                rows={report.feedback.map((r) => ({
                  id: r.id,
                  cells: [
                    (r.updated_at || r.created_at || '')
                      .slice(0, 16)
                      .replace('T', ' '),
                    `${r.session_date} ${r.session_time}`,
                    r.class_name,
                    r.coach_name,
                    r.role,
                    r.author_label,
                    feelingLabel(r.feeling),
                    `${r.intensity}/10`,
                    r.enjoyment != null ? `${r.enjoyment}/5` : '—',
                    r.would_return != null ? `${r.would_return}/5` : '—',
                    (r.tags || []).join(', ') || '—',
                    r.comment
                      ? r.comment.length > 40
                        ? `${r.comment.slice(0, 40)}…`
                        : r.comment
                      : '—',
                  ],
                }))}
              />
              {report.feedback.length === 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  No feedback in this slice. Members submit from class join
                  links; coaches from the portal after teaching.
                </p>
              )}
            </div>
          )}

          {/* MEMBERS · CLASS ASSIGNMENT */}
          {tab === 'members' && (
            <div className="space-y-4">
              {(() => {
                const assigned = report.members.filter((m) => m.assigned);
                const unassigned = report.members.filter((m) => !m.assigned);
                const rows =
                  memberAssignFilter === 'assigned'
                    ? assigned
                    : memberAssignFilter === 'unassigned'
                      ? unassigned
                      : report.members;
                const multi = assigned.filter((m) => m.class_count > 1).length;
                return (
                  <>
                    <StatRow
                      tone="member"
                      items={[
                        {
                          label: 'All members',
                          value: report.members.length,
                        },
                        {
                          label: 'On ≥1 class',
                          value: assigned.length,
                        },
                        {
                          label: 'Not on any class',
                          value: unassigned.length,
                        },
                        {
                          label: 'On multiple classes',
                          value: multi,
                        },
                      ]}
                    />
                    <div className="flex flex-wrap gap-2 items-center">
                      {(
                        [
                          ['all', 'All'],
                          ['assigned', 'Assigned to class'],
                          ['unassigned', 'Not assigned'],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setMemberAssignFilter(id)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                            memberAssignFilter === id
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                      <p className="text-[11px] text-slate-500 sm:ml-2">
                        Members can be on many classes. Filter uses the date /
                        coach / class slice above. Unassigned = no booking in
                        range.
                      </p>
                    </div>
                    <DataTable
                      tone="member"
                      headers={[
                        'Code',
                        'Name',
                        'Status',
                        'Assigned',
                        '# Classes',
                        'Classes (multi OK)',
                        'Waitlist',
                        'Attended',
                        'No-show',
                      ]}
                      rows={rows.map((r) => ({
                        id: r.id,
                        cells: [
                          r.code,
                          <span key="n" className="block min-w-[8rem]">
                            <span className="font-semibold">{r.name}</span>
                            {r.email ? (
                              <span className="block text-[10px] text-slate-500">
                                {r.email}
                              </span>
                            ) : null}
                          </span>,
                          r.status,
                          r.assigned ? (
                            <span
                              key="a"
                              className="text-[10px] font-black uppercase text-emerald-700"
                            >
                              Yes
                            </span>
                          ) : (
                            <span
                              key="a"
                              className="text-[10px] font-black uppercase text-amber-700"
                            >
                              No
                            </span>
                          ),
                          r.class_count,
                          <span
                            key="c"
                            className="block max-w-md text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap"
                            title={r.classes_label}
                          >
                            {r.classes_label}
                          </span>,
                          r.waitlist_in_range,
                          r.attended_in_range,
                          r.no_show_in_range,
                        ],
                      }))}
                    />
                    {rows.length === 0 && (
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        No members in this filter. Widen the date range or
                        switch Assigned / Not assigned.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* DAILY */}
          {tab === 'daily' && (
            <div className="space-y-4">
              <StatRow
                tone="owner"
                items={[
                  { label: 'Days with classes', value: report.daily.length },
                  {
                    label: 'Peak planned',
                    value: report.daily.length
                      ? Math.max(...report.daily.map((d) => d.planned))
                      : 0,
                  },
                  {
                    label: 'Peak attended',
                    value: report.daily.length
                      ? Math.max(...report.daily.map((d) => d.attended))
                      : 0,
                  },
                  {
                    label: 'Peak sessions',
                    value: report.daily.length
                      ? Math.max(...report.daily.map((d) => d.sessions))
                      : 0,
                  },
                ]}
              />
              <DataTable
                tone="owner"
                headers={[
                  'Date',
                  'Sessions',
                  'Planned',
                  'Attended',
                  'No-show',
                  'Feedback',
                  'Show-up %',
                ]}
                rows={report.daily.map((d) => {
                  const denom = d.attended + d.no_show;
                  // pending not in daily — approx show-up from attended/(attended+no_show)
                  const showUp =
                    denom > 0
                      ? Math.round((d.attended / denom) * 1000) / 10
                      : null;
                  return {
                    id: d.date,
                    cells: [
                      d.date,
                      d.sessions,
                      d.planned,
                      d.attended,
                      d.no_show,
                      d.feedback,
                      pctLabel(showUp),
                    ],
                  };
                })}
              />
            </div>
          )}
        </div>
      )}
    </FitgraphWorkbench>
  );
}
