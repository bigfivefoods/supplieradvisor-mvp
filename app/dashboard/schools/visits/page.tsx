'use client';

/**
 * PEU field pack + visit planner + planned vs actual report.
 * School mode: planned (notified) + actual audit results + linked RIADs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  GripVertical,
  Loader2,
  MapPin,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Upload,
  UserCog,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { uploadCompanyAssetServerFirst } from '@/lib/business/uploadCompanyAssets';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import {
  clearOfflineDraft,
  isBrowserOnline,
  loadOfflineDraft,
  saveOfflineDraft,
} from '@/lib/schools/offline-draft';
import { useProgrammeRole } from '@/lib/schools/useProgrammeRole';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';

type SchoolOpt = {
  id: number;
  school_name: string;
  label?: string;
  emis_number?: string | null;
  natemis?: string | null;
  district?: string | null;
  circuit?: string | null;
  cmc?: string | null;
  local_municipality?: string | null;
  learners?: number;
};

export default function VisitsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const programme = useProgrammeRole();
  const isAgency = programme.role === 'department';

  if (programme.loading) {
    return (
      <SchoolsPage>
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </SchoolsPage>
    );
  }

  if (isAgency) return <AgencyVisits companyId={companyId} />;
  return <SchoolVisits companyId={companyId} />;
}

/* ═══════════════════════════════════════════════════════════════════════
 * DBE / PEU
 * ═════════════════════════════════════════════════════════════════════ */

function AgencyVisits({ companyId }: { companyId: number }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'calendar' | 'plan' | 'field' | 'report'>(
    'calendar'
  );
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Array<Record<string, unknown>>>([]);
  const [plans, setPlans] = useState<Array<Record<string, unknown>>>([]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('this_month', 3)
  );
  // Trip calendar (feeding-calendar style)
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1);
  const [calDays, setCalDays] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [calSummary, setCalSummary] = useState<Record<string, number>>({});
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [bulkVisitor, setBulkVisitor] = useState('');
  const [selectedVisitIds, setSelectedVisitIds] = useState<number[]>([]);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  // Smart school filter
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [facets, setFacets] = useState<Record<string, string[]>>({});
  const [q, setQ] = useState('');
  const [district, setDistrict] = useState('');
  const [circuit, setCircuit] = useState('');
  const [cmc, setCmc] = useState('');
  const [municipality, setMunicipality] = useState('');

  // Field pack
  const [schoolId, setSchoolId] = useState('');
  const [visitDate, setVisitDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [plannedVisitId, setPlannedVisitId] = useState<number | null>(null);
  const [checks, setChecks] = useState({
    hygiene: true,
    stock_matches_menu: true,
    menu_ok: true,
    learners_vs_meals: true,
    kitchen_ok: true,
  });
  const [notes, setNotes] = useState('');
  const [findings, setFindings] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [raiseRiad, setRaiseRiad] = useState(false);
  const [riadTitle, setRiadTitle] = useState('');
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);

  // Plan form
  const [planDate, setPlanDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [planSchoolIds, setPlanSchoolIds] = useState<number[]>([]);
  const [planNotify, setPlanNotify] = useState(true);
  const [planVisitor, setPlanVisitor] = useState('');
  const [planNotes, setPlanNotes] = useState('');
  const [planTitle, setPlanTitle] = useState('');

  const loadSchools = useCallback(async () => {
    const params = new URLSearchParams({
      companyId: String(companyId),
      mode: 'schools',
    });
    if (q) params.set('q', q);
    if (district) params.set('district', district);
    if (circuit) params.set('circuit', circuit);
    if (cmc) params.set('cmc', cmc);
    if (municipality) params.set('municipality', municipality);
    const res = await fetch(`/api/schools/visits?${params}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const data = await res.json();
    if (res.ok) {
      setSchools(data.schools || []);
      setFacets(data.facets || {});
    }
  }, [companyId, q, district, circuit, cmc, municipality]);

  const loadCalendar = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/schools/visits?companyId=${companyId}&mode=calendar&year=${viewYear}&month=${viewMonth}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (res.ok) {
        setCalDays((data.days || {}) as Record<string, Record<string, unknown>>);
        setCalSummary((data.summary || {}) as Record<string, number>);
      }
    } catch {
      /* soft */
    }
  }, [companyId, viewYear, viewMonth]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, pRes, rRes] = await Promise.all([
        fetch(`/api/schools/visits?companyId=${companyId}&mode=agency`, {
          cache: 'no-store',
          credentials: 'same-origin',
        }),
        fetch(`/api/schools/visits?companyId=${companyId}&mode=plans`, {
          cache: 'no-store',
          credentials: 'same-origin',
        }),
        fetch(
          `/api/schools/visits?companyId=${companyId}&mode=report&from=${period.from}&to=${period.to}`,
          { cache: 'no-store', credentials: 'same-origin' }
        ),
        loadCalendar(),
      ]);
      const v = await vRes.json();
      const p = await pRes.json();
      const r = await rRes.json();
      if (vRes.ok) setVisits(v.visits || []);
      if (pRes.ok) setPlans(p.plans || []);
      if (rRes.ok) setReport(r);
      if (v.warning) toast.message(v.warning);

      const draft = loadOfflineDraft<{
        schoolId?: string;
        checks?: typeof checks;
        notes?: string;
        findings?: string;
        visitorName?: string;
        visitDate?: string;
        lat?: number | null;
        lng?: number | null;
        photos?: string[];
      }>('peu-visit', companyId, 'draft');
      if (draft?.payload) {
        if (draft.payload.schoolId) setSchoolId(draft.payload.schoolId);
        if (draft.payload.checks) setChecks(draft.payload.checks);
        if (draft.payload.notes) setNotes(draft.payload.notes);
        if (draft.payload.findings) setFindings(draft.payload.findings);
        if (draft.payload.visitorName)
          setVisitorName(draft.payload.visitorName);
        if (draft.payload.visitDate) setVisitDate(draft.payload.visitDate);
        if (draft.payload.lat != null) setLat(draft.payload.lat);
        if (draft.payload.lng != null) setLng(draft.payload.lng);
        if (draft.payload.photos) setPhotos(draft.payload.photos);
        setDraftNote(
          `Restored field draft (${new Date(draft.savedAt).toLocaleString()})`
        );
      }
      await loadSchools();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, period.from, period.to, loadSchools, loadCalendar]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    const t = setTimeout(() => void loadSchools(), 300);
    return () => clearTimeout(t);
  }, [loadSchools]);

  useEffect(() => {
    // Keep plan form date in sync with calendar selection
    setPlanDate(selectedDate);
    setSelectedVisitIds([]);
  }, [selectedDate]);

  useEffect(() => {
    const t = setTimeout(() => {
      saveOfflineDraft(
        'peu-visit',
        companyId,
        'draft',
        {
          schoolId,
          checks,
          notes,
          findings,
          visitorName,
          visitDate,
          lat,
          lng,
          photos,
        },
        'PEU visit'
      );
    }, 500);
    return () => clearTimeout(t);
  }, [
    companyId,
    schoolId,
    checks,
    notes,
    findings,
    visitorName,
    visitDate,
    lat,
    lng,
    photos,
  ]);

  const plannedToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return visits.filter(
      (v) =>
        String(v.status) === 'planned' &&
        String(v.planned_date || v.visit_date).slice(0, 10) === today
    );
  }, [visits]);

  const captureGps = () => {
    if (!navigator.geolocation) {
      return toast.error('GPS not available on this device');
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setAccuracy(
          pos.coords.accuracy != null
            ? Math.round(pos.coords.accuracy)
            : null
        );
        toast.success('GPS captured');
        setGpsBusy(false);
      },
      (err) => {
        toast.error(err.message || 'GPS failed');
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const onPhoto = async (file: File | null) => {
    if (!file) return;
    try {
      const up = await uploadCompanyAssetServerFirst({
        file,
        companyId,
        kind: 'peu_visit_photo',
      });
      if (!up.url) throw new Error(up.error || 'Upload failed');
      setPhotos((p) => [...p, up.url!]);
      toast.success('Photo attached');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  const submitVisit = async () => {
    if (!schoolId) return toast.error('Select a school');
    setSaving(true);
    try {
      if (!isBrowserOnline()) {
        saveOfflineDraft(
          'peu-visit',
          companyId,
          'draft',
          {
            schoolId,
            checks,
            notes,
            findings,
            visitorName,
            visitDate,
            lat,
            lng,
            photos,
            pendingSubmit: true,
          },
          'PEU visit pending'
        );
        toast.message('Saved offline — open again online to sync');
        return;
      }
      const res = await fetch('/api/schools/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'complete_visit',
          school_profile_id: Number(schoolId),
          visit_id: plannedVisitId,
          visit_date: visitDate,
          checklist: checks,
          notes,
          findings_summary: findings || notes,
          visitor_name: visitorName || null,
          lat,
          lng,
          accuracy_m: accuracy,
          photo_urls: photos,
          offline_synced: Boolean(draftNote),
          notify_school: notifyOnComplete,
          raise_riad: raiseRiad,
          riad_title: raiseRiad ? riadTitle || notes || 'PEU visit finding' : null,
          riad_description: findings || notes,
          riad_type: 'issue',
          riad_priority: checks.hygiene && checks.kitchen_ok ? 'medium' : 'high',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.message || `Visit logged · score ${data.visit?.overall_score}`);
      clearOfflineDraft('peu-visit', companyId, 'draft');
      setNotes('');
      setFindings('');
      setPhotos([]);
      setRaiseRiad(false);
      setRiadTitle('');
      setPlannedVisitId(null);
      setDraftNote(null);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const createPlan = async () => {
    if (!planSchoolIds.length) {
      return toast.error('Add at least one school to the day plan');
    }
    setSaving(true);
    try {
      const res = await fetch('/api/schools/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'create_plan',
          plan_date: planDate,
          school_ids: planSchoolIds,
          notify_schools: planNotify,
          visitor_name: planVisitor || null,
          notes: planNotes || null,
          title: planTitle || null,
          district: district || null,
          circuit: circuit || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.message || 'Plan created');
      setPlanSchoolIds([]);
      setPlanNotes('');
      setPlanTitle('');
      void load();
      void loadCalendar();
      setTab('calendar');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const togglePlanSchool = (id: number) => {
    setPlanSchoolIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const startPlanned = (v: Record<string, unknown>) => {
    setSchoolId(String(v.school_profile_id));
    setPlannedVisitId(Number(v.id));
    setVisitDate(
      String(v.planned_date || v.visit_date || visitDate).slice(0, 10)
    );
    if (v.visitor_name) setVisitorName(String(v.visitor_name));
    setTab('field');
    toast.message(`Field pack loaded for ${v.school_name || v.school_profile_id}`);
  };

  const openMonitoring = (peuVisitId: number) => {
    window.location.href = `/dashboard/schools/monitoring?peuVisitId=${peuVisitId}`;
  };

  const printDayPack = (date?: string) => {
    const d = date || selectedDate;
    window.open(
      `/api/schools/visits?companyId=${companyId}&mode=day_pack&date=${d}&format=pdf`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const rescheduleVisit = async (
    visitId: number,
    newDate: string,
    notify = false
  ) => {
    try {
      const res = await fetch('/api/schools/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'reschedule_visit',
          visit_id: visitId,
          plan_date: newDate,
          notify_schools: notify,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Move failed');
      toast.success(data.message || `Moved to ${newDate}`);
      setSelectedDate(newDate);
      void loadCalendar();
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Move failed');
    }
  };

  const reassignVisitor = async (opts?: {
    visitIds?: number[];
    date?: string;
  }) => {
    const name = bulkVisitor.trim() || planVisitor.trim();
    if (!name) {
      return toast.error('Enter visitor / PEU officer name first');
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        companyId,
        action: 'reassign_visitor',
        visitor_name: name,
      };
      // Prefer explicit args: selected IDs vs whole day must not clash
      if (opts?.visitIds?.length) body.visit_ids = opts.visitIds;
      else if (opts?.date) body.plan_date = opts.date;
      else if (selectedVisitIds.length) body.visit_ids = selectedVisitIds;
      else body.plan_date = selectedDate;

      const res = await fetch('/api/schools/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reassign failed');
      toast.success(data.message || 'Visitor assigned');
      setSelectedVisitIds([]);
      void loadCalendar();
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectVisit = (id: number) => {
    setSelectedVisitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const monthGrid = useMemo(() => {
    const first = new Date(viewYear, viewMonth - 1, 1, 12, 0, 0);
    const startPad = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const cells: Array<{ date: string | null; day: number | null }> = [];
    for (let i = 0; i < startPad; i++) cells.push({ date: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date: iso, day: d });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
    return cells;
  }, [viewYear, viewMonth]);

  const selectedCell = calDays[selectedDate] as
    | {
        planned?: Array<Record<string, unknown>>;
        completed?: Array<Record<string, unknown>>;
        monitoring?: Array<Record<string, unknown>>;
      }
    | undefined;

  const selectAllPlannedOnDay = () => {
    const ids = (selectedCell?.planned || [])
      .map((v) => Number(v.id))
      .filter((n) => Number.isFinite(n));
    setSelectedVisitIds(ids);
  };

  const shiftMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  const monthLabel = new Date(viewYear, viewMonth - 1, 1).toLocaleString(
    'en-ZA',
    { month: 'long', year: 'numeric' }
  );

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Monitoring trips"
        titleAccent="Calendar · form · report"
        mode="agency"
        description="Plan PEU circuit days on the calendar (like the feeding calendar), run the full NSNP Monitoring Tool on site, and track planned vs actual."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/schools/monitoring"
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Monitoring form
            </Link>
            <Link
              href="/dashboard/schools/monitoring-report"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              KPI report
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            { id: 'calendar', label: 'Trip calendar', icon: CalendarDays },
            { id: 'plan', label: 'Build day plan', icon: Plus },
            { id: 'field', label: 'Quick field pack', icon: ClipboardCheck },
            { id: 'report', label: 'Planned vs actual', icon: Search },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold border inline-flex items-center gap-1.5 ${
              tab === t.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {[
          { l: 'Planned (month)', v: calSummary.planned ?? 0 },
          { l: 'Completed', v: calSummary.completed ?? 0 },
          { l: 'Monitoring forms', v: calSummary.monitoring_forms ?? 0 },
          { l: 'Trip days', v: calSummary.trip_days ?? 0 },
          { l: 'Schools touched', v: calSummary.schools ?? 0 },
        ].map((k) => (
          <div
            key={k.l}
            className="rounded-2xl border border-sky-200 bg-white dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/40 px-3 py-2"
          >
            <p className="text-[10px] font-bold uppercase text-slate-400">
              {k.l}
            </p>
            <p className="text-xl font-black tabular-nums">{k.v}</p>
          </div>
        ))}
      </div>

      {tab === 'calendar' ? (
        <div className="grid lg:grid-cols-5 gap-4 mb-4">
          <div className="lg:col-span-3 rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 overflow-hidden">
            <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-sky-50 to-violet-50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="rounded-xl border border-slate-200 bg-white p-1.5 hover:bg-slate-50"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="text-sm font-black min-w-[9rem] text-center">
                  {monthLabel}
                </h3>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="rounded-xl border border-slate-200 bg-white p-1.5 hover:bg-slate-50"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Planned
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Done
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500" /> Form
                </span>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b text-[10px] font-bold uppercase text-slate-400 text-center">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthGrid.map((c, i) => {
                if (!c.date) {
                  return (
                    <div
                      key={`e-${i}`}
                      className="min-h-[72px] border-b border-r border-slate-50 bg-slate-50/40"
                    />
                  );
                }
                const cell = calDays[c.date] as
                  | {
                      planned?: unknown[];
                      completed?: unknown[];
                      monitoring?: unknown[];
                    }
                  | undefined;
                const p = cell?.planned?.length || 0;
                const d = cell?.completed?.length || 0;
                const mon = cell?.monitoring?.length || 0;
                const isSel = c.date === selectedDate;
                const isToday =
                  c.date === new Date().toISOString().slice(0, 10);
                const hasTrip = p + d + mon > 0;
                const isDrop = dragOverDate === c.date;
                return (
                  <button
                    key={c.date}
                    type="button"
                    onClick={() => {
                      setSelectedDate(c.date!);
                      setPlanDate(c.date!);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverDate(c.date);
                    }}
                    onDragLeave={() => {
                      if (dragOverDate === c.date) setDragOverDate(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverDate(null);
                      const id = Number(
                        e.dataTransfer.getData('text/peu-visit-id') ||
                          e.dataTransfer.getData('text/plain')
                      );
                      if (!Number.isFinite(id) || !c.date) return;
                      // Planned list is for selectedDate — dropping on same day is a no-op
                      if (c.date === selectedDate) return;
                      void rescheduleVisit(id, c.date, false);
                    }}
                    className={`min-h-[72px] border-b border-r border-slate-100 p-1.5 text-left transition-colors ${
                      isDrop
                        ? 'bg-sky-200 ring-2 ring-inset ring-sky-500'
                        : isSel
                          ? 'bg-sky-100 ring-2 ring-inset ring-[#00b4d8]'
                        : hasTrip
                          ? 'bg-amber-50/50 hover:bg-amber-50'
                          : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-black tabular-nums ${
                          isToday
                            ? 'bg-slate-900 text-white rounded-full w-6 h-6 flex items-center justify-center'
                            : 'text-slate-700'
                        }`}
                      >
                        {c.day}
                      </span>
                      {hasTrip ? (
                        <span className="text-[9px] font-bold text-slate-500">
                          {p + d}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {p > 0 ? (
                        <span className="text-[9px] font-bold bg-amber-200 text-amber-950 rounded px-1">
                          {p} plan
                        </span>
                      ) : null}
                      {d > 0 ? (
                        <span className="text-[9px] font-bold bg-emerald-200 text-emerald-950 rounded px-1">
                          {d} done
                        </span>
                      ) : null}
                      {mon > 0 ? (
                        <span className="text-[9px] font-bold bg-violet-200 text-violet-950 rounded px-1">
                          {mon} form
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 p-4">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Selected day
              </p>
              <h3 className="text-lg font-black mt-0.5">{selectedDate}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPlanDate(selectedDate);
                    setTab('plan');
                  }}
                  className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Plan schools this day
                </button>
                <button
                  type="button"
                  onClick={() => printDayPack(selectedDate)}
                  className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                  title="Print circuit day pack PDF"
                >
                  <Printer className="w-3.5 h-3.5" /> Print day pack
                </button>
                <Link
                  href={`/dashboard/schools/monitoring`}
                  className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" /> Full form
                </Link>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                Tip: drag a planned school onto another calendar day to
                reschedule.
              </p>
            </div>

            {/* Bulk reassign */}
            <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <UserCog className="w-3.5 h-3.5" /> Bulk reassign visitor
              </p>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="PEU officer name"
                value={bulkVisitor}
                onChange={(e) => setBulkVisitor(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void reassignVisitor({ date: selectedDate })}
                  className="btn-secondary !py-1.5 !px-3 text-xs"
                >
                  Assign all on this day
                </button>
                <button
                  type="button"
                  disabled={saving || !selectedVisitIds.length}
                  onClick={() =>
                    void reassignVisitor({ visitIds: selectedVisitIds })
                  }
                  className="btn-primary !py-1.5 !px-3 text-xs disabled:opacity-40"
                >
                  Assign selected ({selectedVisitIds.length})
                </button>
                <button
                  type="button"
                  onClick={selectAllPlannedOnDay}
                  className="text-xs font-bold text-[#0077b6] underline"
                >
                  Select all planned
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-amber-100 text-xs font-bold uppercase text-amber-900">
                Planned · {selectedCell?.planned?.length || 0}
              </div>
              <ul className="max-h-56 overflow-y-auto divide-y divide-amber-100/80">
                {(selectedCell?.planned || []).length === 0 ? (
                  <li className="px-4 py-6 text-sm text-slate-500 text-center">
                    No schools planned — click Plan schools this day
                  </li>
                ) : (
                  (selectedCell?.planned || []).map((v) => {
                    const vid = Number(v.id);
                    const checked = selectedVisitIds.includes(vid);
                    return (
                      <li
                        key={String(v.id)}
                        draggable
                        onDragStart={(e) => {
                          setDraggingId(vid);
                          e.dataTransfer.setData(
                            'text/peu-visit-id',
                            String(vid)
                          );
                          e.dataTransfer.setData('text/plain', String(vid));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverDate(null);
                        }}
                        className={`px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 cursor-grab active:cursor-grabbing ${
                          draggingId === vid ? 'opacity-50' : ''
                        } ${checked ? 'bg-amber-100/80' : ''}`}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <GripVertical className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={() => toggleSelectVisit(vid)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">
                              {String(v.school_name || v.school_profile_id)}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {v.visitor_name
                                ? String(v.visitor_name)
                                : 'Unassigned officer'}
                              {v.district ? ` · ${String(v.district)}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => openMonitoring(vid)}
                            className="rounded-lg bg-violet-600 text-white text-[10px] font-bold px-2 py-1.5 inline-flex items-center gap-1"
                          >
                            Monitoring form
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => startPlanned(v)}
                            className="rounded-lg border border-slate-200 bg-white text-[10px] font-bold px-2 py-1.5"
                          >
                            Quick pack
                          </button>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-emerald-100 text-xs font-bold uppercase text-emerald-900 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Completed ·{' '}
                {(selectedCell?.completed?.length || 0) +
                  (selectedCell?.monitoring?.length || 0)}
              </div>
              <ul className="max-h-40 overflow-y-auto divide-y text-sm">
                {(selectedCell?.completed || []).map((v) => (
                  <li key={`c-${v.id}`} className="px-4 py-2">
                    <span className="font-semibold">
                      {String(v.school_name || v.school_profile_id)}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">
                      PEU pack
                      {v.overall_score != null
                        ? ` · score ${v.overall_score}`
                        : ''}
                    </span>
                  </li>
                ))}
                {(selectedCell?.monitoring || []).map((v) => (
                  <li key={`m-${v.id}`} className="px-4 py-2 flex justify-between gap-2">
                    <span className="font-semibold">
                      {String(v.school_name || v.school_profile_id)}
                    </span>
                    <Link
                      href={`/dashboard/schools/monitoring?id=${v.id}`}
                      className="text-[10px] font-bold text-violet-700 underline"
                    >
                      Open form
                    </Link>
                  </li>
                ))}
                {(selectedCell?.completed?.length || 0) +
                  (selectedCell?.monitoring?.length || 0) ===
                0 ? (
                  <li className="px-4 py-4 text-xs text-slate-500 text-center">
                    Nothing completed this day yet
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {/* Shared smart school filters — plan/field */}
      {tab === 'plan' || tab === 'field' ? (
      <div className="mb-4 rounded-2xl border border-sky-200 bg-white dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/40 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase text-slate-400">
          Smart school filter · metadata
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <label className="text-xs sm:col-span-2">
            <span className="sr-only">Search</span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 pl-8 pr-2 py-2 text-sm"
                placeholder="Name, NATEMIS, EMIS, circuit…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </label>
          <select
            className="rounded-xl border border-slate-200 px-2 py-2 text-sm"
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value);
              setCircuit('');
            }}
          >
            <option value="">All districts</option>
            {(facets.districts || []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-slate-200 px-2 py-2 text-sm"
            value={circuit}
            onChange={(e) => setCircuit(e.target.value)}
          >
            <option value="">All circuits</option>
            {(facets.circuits || []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-slate-200 px-2 py-2 text-sm"
            value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
          >
            <option value="">All municipalities</option>
            {(facets.municipalities || []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-slate-500">
          {schools.length.toLocaleString('en-ZA')} school(s) match filters
        </p>
      </div>
      ) : null}

      {tab === 'plan' ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-sky-700" />
              Plan a circuit day · {planDate}
            </h3>
            <label className="text-xs block">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Plan date
              </span>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
              />
            </label>
            <label className="text-xs block">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Title (optional)
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                placeholder="e.g. King Cetshwayo west circuit"
              />
            </label>
            <label className="text-xs block">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Visitor / PEU officer
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={planVisitor}
                onChange={(e) => setPlanVisitor(e.target.value)}
              />
            </label>
            <label className="text-xs block">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Notes
              </span>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[60px]"
                value={planNotes}
                onChange={(e) => setPlanNotes(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={planNotify}
                onChange={(e) => setPlanNotify(e.target.checked)}
              />
              Notify schools of this planned visit
            </label>
            <p className="text-[11px] text-slate-500">
              Selected: <strong>{planSchoolIds.length}</strong> school(s). Use
              filters above, then tick schools below.
            </p>
            <button
              type="button"
              disabled={saving || !planSchoolIds.length}
              onClick={() => void createPlan()}
              className="btn-primary w-full !py-3 text-sm"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : (
                'Save day plan'
              )}
            </button>
          </div>

          <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
              Pick schools for {planDate}
            </div>
            <ul className="max-h-[28rem] overflow-y-auto divide-y">
              {schools.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-slate-500">
                  No schools match filters
                </li>
              ) : (
                schools.map((s) => {
                  const on = planSchoolIds.includes(s.id);
                  return (
                    <li key={s.id}>
                      <label className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1 w-4 h-4"
                          checked={on}
                          onChange={() => togglePlanSchool(s.id)}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {s.school_name}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono truncate">
                            {[s.natemis || s.emis_number, s.district, s.circuit]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {plans.length > 0 ? (
            <div className="lg:col-span-2 rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 overflow-hidden">
              <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
                Upcoming plans
              </div>
              <ul className="divide-y">
                {plans.slice(0, 20).map((p) => (
                  <li key={String(p.plan_id)} className="px-4 py-3">
                    <p className="font-bold text-sm">
                      {String(p.plan_date)} · {String(p.title)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {Number(p.count)} school(s)
                      {p.visitor_name ? ` · ${String(p.visitor_name)}` : ''}
                      {p.notify_schools ? ' · schools notified' : ' · silent'}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {((p.schools as Array<Record<string, unknown>>) || [])
                        .slice(0, 8)
                        .map((s) => (
                          <button
                            key={String(s.id)}
                            type="button"
                            onClick={() => startPlanned(s)}
                            className="text-[10px] font-bold rounded-full bg-sky-50 border border-sky-100 text-sky-900 px-2 py-0.5"
                          >
                            {String(s.school_name || s.school_profile_id)}
                          </button>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'field' ? (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-3">
            {draftNote ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {draftNote}
              </div>
            ) : null}

            {plannedToday.length > 0 ? (
              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase text-sky-800 mb-2">
                  Planned today — field pack or full monitoring form
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {plannedToday.map((v) => (
                    <div
                      key={String(v.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-white border border-sky-200 pl-2.5 pr-1 py-0.5"
                    >
                      <button
                        type="button"
                        onClick={() => startPlanned(v)}
                        className="text-xs font-bold"
                      >
                        {String(v.school_name || v.school_profile_id)}
                      </button>
                      <Link
                        href={`/dashboard/schools/monitoring?peuVisitId=${v.id}`}
                        className="text-[10px] font-bold rounded-full bg-sky-600 text-white px-2 py-0.5"
                        title="Open full NSNP monitoring tool"
                      >
                        Monitor
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 p-5 space-y-3">
              <label className="text-xs block">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  School (filtered list)
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm min-h-[48px]"
                  value={schoolId}
                  onChange={(e) => {
                    setSchoolId(e.target.value);
                    setPlannedVisitId(null);
                  }}
                >
                  <option value="">Select school…</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label || s.school_name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid sm:grid-cols-2 gap-2">
                <label className="text-xs block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Date visited
                  </span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                  />
                </label>
                <label className="text-xs block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Visitor name
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    placeholder="PEU officer"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  disabled={gpsBusy}
                  onClick={captureGps}
                  className="btn-secondary !py-2.5 !px-3 text-xs inline-flex items-center gap-1 min-h-[44px]"
                >
                  {gpsBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5" />
                  )}
                  Capture GPS
                </button>
                {lat != null && lng != null ? (
                  <span className="text-[11px] font-mono text-slate-600">
                    {lat.toFixed(5)}, {lng.toFixed(5)}
                    {accuracy != null ? ` ±${accuracy}m` : ''}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">No GPS yet</span>
                )}
              </div>

              <div className="space-y-2">
                {(
                  [
                    ['hygiene', 'Hygiene OK'],
                    ['stock_matches_menu', 'Stock matches menu'],
                    ['menu_ok', 'Menu adherence'],
                    ['learners_vs_meals', 'Learners vs meals reasonable'],
                    ['kitchen_ok', 'Kitchen condition OK'],
                  ] as const
                ).map(([k, label]) => (
                  <label
                    key={k}
                    className="flex items-center gap-3 text-sm font-semibold min-h-[44px]"
                  >
                    <input
                      type="checkbox"
                      className="w-5 h-5"
                      checked={checks[k]}
                      onChange={(e) =>
                        setChecks((c) => ({ ...c, [k]: e.target.checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>

              <label className="text-xs block">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Findings summary
                </span>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm min-h-[64px]"
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="Key findings for school audit trail"
                />
              </label>

              <label className="text-xs block">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Notes
                </span>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm min-h-[72px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>

              <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={raiseRiad}
                    onChange={(e) => setRaiseRiad(e.target.checked)}
                  />
                  <AlertTriangle className="w-4 h-4 text-rose-700" />
                  Raise RIAD from this visit
                </label>
                {raiseRiad ? (
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={riadTitle}
                    onChange={(e) => setRiadTitle(e.target.value)}
                    placeholder="RIAD title (risk / issue)"
                  />
                ) : null}
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={notifyOnComplete}
                  onChange={(e) => setNotifyOnComplete(e.target.checked)}
                />
                Notify school of visit results
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="btn-secondary !py-2.5 !px-3 text-xs inline-flex items-center gap-1 min-h-[44px]"
                >
                  <Camera className="w-3.5 h-3.5" /> Photo
                </button>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="btn-secondary !py-2.5 !px-3 text-xs inline-flex items-center gap-1 min-h-[44px]"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload
                </button>
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void onPhoto(e.target.files?.[0] || null)}
                />
              </div>
              {photos.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {photos.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover border"
                    />
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                disabled={saving}
                onClick={() => void submitVisit()}
                className="btn-primary w-full !py-3.5 text-sm inline-flex items-center justify-center gap-2 min-h-[52px]"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="w-4 h-4" />
                )}
                {plannedVisitId
                  ? 'Complete planned visit'
                  : 'Submit PEU visit'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 overflow-hidden">
              <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
                Recent visits / trip log
              </div>
              {loading ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
                </div>
              ) : (
                <ul className="divide-y text-sm max-h-[32rem] overflow-y-auto">
                  {visits.length === 0 ? (
                    <li className="px-4 py-8 text-center text-slate-500">
                      No visits yet
                    </li>
                  ) : (
                    visits.slice(0, 40).map((v) => (
                      <li key={String(v.id)} className="px-4 py-3">
                        <div className="flex justify-between gap-2">
                          <div>
                            <p className="font-bold">
                              {String(v.school_name || v.school_profile_id)}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Visited {String(v.visit_date)}
                              {v.planned_date &&
                              String(v.planned_date) !== String(v.visit_date)
                                ? ` · planned ${String(v.planned_date)}`
                                : ''}
                              {' · '}
                              <span className="capitalize">
                                {String(v.status)}
                              </span>
                              {v.overall_score != null
                                ? ` · score ${Number(v.overall_score).toFixed(0)}`
                                : ''}
                              {v.lat != null ? ' · GPS' : ''}
                              {v.notify_school ? ' · school notified' : ''}
                            </p>
                            {v.findings_summary ? (
                              <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                                {String(v.findings_summary)}
                              </p>
                            ) : null}
                            {Array.isArray(v.riad_ids) &&
                            (v.riad_ids as unknown[]).length > 0 ? (
                              <p className="text-[10px] font-bold text-rose-700 mt-0.5">
                                {(v.riad_ids as unknown[]).length} RIAD linked
                              </p>
                            ) : null}
                          </div>
                          {String(v.status) === 'planned' ? (
                            <div className="flex flex-col gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => startPlanned(v)}
                                className="btn-secondary !py-1 !px-2 text-[10px]"
                              >
                                Field pack
                              </button>
                              <Link
                                href={`/dashboard/schools/monitoring?peuVisitId=${v.id}`}
                                className="btn-primary !py-1 !px-2 text-[10px] text-center"
                              >
                                Full monitoring
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'report' ? (
        <div className="space-y-4">
          <PeriodSlicer value={period} onChange={setPeriod} />
          {report ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {[
                  {
                    l: 'Planned open',
                    v: (report.kpis as Record<string, number>)?.planned_open,
                  },
                  {
                    l: 'Completed',
                    v: (report.kpis as Record<string, number>)?.completed,
                  },
                  {
                    l: 'Cancelled',
                    v: (report.kpis as Record<string, number>)?.cancelled,
                  },
                  {
                    l: 'Coverage %',
                    v: (report.kpis as Record<string, number>)?.coverage_pct,
                  },
                  {
                    l: 'Plan miss',
                    v: (report.kpis as Record<string, number>)?.plan_miss,
                  },
                  {
                    l: 'Avg score',
                    v: (report.kpis as Record<string, number>)?.avg_score,
                  },
                ].map((k) => (
                  <div
                    key={k.l}
                    className="rounded-2xl border border-sky-200 bg-white dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/40 px-3 py-2.5"
                  >
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      {k.l}
                    </p>
                    <p className="text-xl font-black tabular-nums">
                      {k.v != null ? k.v : '—'}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 overflow-hidden">
                <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
                  By district
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 text-left">
                    <tr>
                      <th className="px-3 py-2">District</th>
                      <th className="px-3 py-2 text-right">Planned</th>
                      <th className="px-3 py-2 text-right">Completed</th>
                      <th className="px-3 py-2 text-right">Cancelled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      (report.byDistrict || []) as Array<Record<string, unknown>>
                    ).map((d) => (
                      <tr
                        key={String(d.district)}
                        className="border-t border-slate-50"
                      >
                        <td className="px-3 py-2 font-medium">
                          {String(d.district)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(d.planned || 0)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(d.completed || 0)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(d.cancelled || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">No report data</p>
          )}
        </div>
      ) : null}
    </SchoolsPage>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * School dashboard
 * ═════════════════════════════════════════════════════════════════════ */

function SchoolVisits({ companyId }: { companyId: number }) {
  const [loading, setLoading] = useState(true);
  const [planned, setPlanned] = useState<Array<Record<string, unknown>>>([]);
  const [actual, setActual] = useState<Array<Record<string, unknown>>>([]);
  const [riads, setRiads] = useState<Array<Record<string, unknown>>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/visits?companyId=${companyId}&mode=school`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPlanned(data.planned || []);
      setActual(data.actual || []);
      setRiads(data.riads || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const riadById = useMemo(() => {
    const m = new Map<number, Record<string, unknown>>();
    for (const r of riads) m.set(Number(r.id), r);
    return m;
  }, [riads]);

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="PEU visits"
        titleAccent="Your school"
        mode="school"
        description="Planned visits the department has notified you about, plus completed monitor results and any RIADs raised on site."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-sky-100 bg-sky-50/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-sky-100 text-xs font-bold uppercase text-sky-900 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Planned visits
            </div>
            {planned.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                No notified planned visits. Silent PEU checks may still occur.
              </p>
            ) : (
              <ul className="divide-y divide-sky-100/80">
                {planned.map((v) => (
                  <li key={String(v.id)} className="px-4 py-3 text-sm">
                    <p className="font-bold">
                      {String(v.planned_date || v.visit_date)}
                    </p>
                    <p className="text-xs text-slate-600">
                      {v.visitor_name
                        ? `Officer: ${String(v.visitor_name)}`
                        : 'Department monitor'}
                      {v.visit_type
                        ? ` · ${String(v.visit_type)}`
                        : ' · monitor'}
                    </p>
                    {v.notes ? (
                      <p className="text-xs text-slate-500 mt-1">
                        {String(v.notes)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" /> Visit results (audit)
            </div>
            {actual.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                No completed PEU visits on record yet.
              </p>
            ) : (
              <ul className="divide-y max-h-[28rem] overflow-y-auto">
                {actual.map((v) => {
                  const ids = Array.isArray(v.riad_ids)
                    ? (v.riad_ids as number[])
                    : [];
                  return (
                    <li key={String(v.id)} className="px-4 py-3 text-sm">
                      <div className="flex justify-between gap-2">
                        <p className="font-bold">
                          Visited {String(v.visit_date)}
                        </p>
                        <span className="font-black tabular-nums text-[#0077b6]">
                          {v.overall_score != null
                            ? Number(v.overall_score).toFixed(0)
                            : '—'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {[
                          v.hygiene_score != null &&
                            `Hygiene ${Number(v.hygiene_score).toFixed(0)}`,
                          v.stock_score != null &&
                            `Stock ${Number(v.stock_score).toFixed(0)}`,
                          v.menu_score != null &&
                            `Menu ${Number(v.menu_score).toFixed(0)}`,
                          v.feeding_score != null &&
                            `Feeding ${Number(v.feeding_score).toFixed(0)}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {v.findings_summary || v.notes ? (
                        <p className="text-xs text-slate-600 mt-1">
                          {String(v.findings_summary || v.notes)}
                        </p>
                      ) : null}
                      {Array.isArray(v.photo_urls) &&
                      (v.photo_urls as string[]).length > 0 ? (
                        <div className="flex gap-1 mt-2">
                          {(v.photo_urls as string[]).slice(0, 4).map((u) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={u}
                              src={u}
                              alt=""
                              className="w-12 h-12 rounded object-cover border"
                            />
                          ))}
                        </div>
                      ) : null}
                      {ids.length > 0 ? (
                        <div className="mt-2 rounded-xl bg-rose-50 border border-rose-100 px-2 py-1.5">
                          <p className="text-[10px] font-bold uppercase text-rose-800">
                            RIADs from this visit
                          </p>
                          {ids.map((id) => {
                            const r = riadById.get(Number(id));
                            return (
                              <p key={id} className="text-xs text-rose-900">
                                {r
                                  ? `${String(r.riad_type)}: ${String(r.title)} (${String(r.status)})`
                                  : `RIAD #${id}`}
                              </p>
                            );
                          })}
                          <Link
                            href="/dashboard/schools/riad"
                            className="text-[11px] font-bold text-rose-800 underline"
                          >
                            Open school RIAD log
                          </Link>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}
