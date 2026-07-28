'use client';

/**
 * NSNP Monitoring Tool (KZN 2026-27) — DBE field worker online form.
 * Digitises the paper monitoring tool with live auto-scoring.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  WifiOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
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
import {
  B_QUESTIONS,
  D_QUESTIONS,
  emptyMonitoringForm,
  FOOD_QUALITY_PRODUCTS,
  foodGroupPct,
  scoreMonitoringForm,
  type MonitoringFormData,
  type MonitoringScores,
  type YesNo,
} from '@/lib/schools/nsnp-monitoring-tool';

const OFFLINE_SCOPE = 'nsnp-monitoring';

type SchoolOpt = {
  id: number;
  profile_id?: number | null;
  school_name: string;
  emis_number?: string | null;
  natemis?: string | null;
  province?: string | null;
  district?: string | null;
  circuit?: string | null;
  cmc?: string | null;
  local_municipality?: string | null;
  municipality_ward?: string | null;
  quintile?: number | string | null;
  phase?: string | null;
  school_type?: string | null;
  level_label?: string | null;
  principal_name?: string | null;
  principal_phone?: string | null;
  principal_email?: string | null;
  school_phone?: string | null;
  urban_rural?: string | null;
  learners?: number | null;
  learner_count_enrolled?: number | null;
  learner_count_nsnp_eligible?: number | null;
  final_nsnp_approved_enrol?: number | null;
  nsnp_approved_learners?: number | null;
  label?: string | null;
  status?: string | null;
};

function resolvePhaseBand(
  s: Pick<SchoolOpt, 'phase' | 'level_label' | 'school_type' | 'quintile'>
): MonitoringFormData['school_phase_band'] {
  const phase = [
    s.phase,
    s.level_label,
    s.school_type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const q = Number(s.quintile);
  if (
    (phase.includes('secondary') || phase.includes('high')) &&
    Number.isFinite(q) &&
    q >= 2
  ) {
    return 'secondary_q2_5';
  }
  return 'primary_combined_intermediate_sec_q1';
}

/** Map approved school registry row → Section A1 form fields */
function fillFormFromSchool(
  prev: MonitoringFormData,
  s: SchoolOpt
): MonitoringFormData {
  const phone =
    s.school_phone || s.principal_phone || prev.a3_school_phone || '';
  const nsnpLearners =
    s.nsnp_approved_learners ??
    s.final_nsnp_approved_enrol ??
    s.learner_count_nsnp_eligible ??
    s.learners ??
    s.learner_count_enrolled ??
    null;
  const emis = s.emis_number || s.natemis || prev.a2_emis || '';

  return {
    ...prev,
    school_profile_id: s.id,
    a1_school_name: s.school_name || prev.a1_school_name,
    a2_emis: emis,
    a3_school_phone: phone,
    a4_district: s.district || prev.a4_district,
    a5_quintile:
      s.quintile != null && s.quintile !== ''
        ? String(s.quintile)
        : prev.a5_quintile,
    school_phase_band: resolvePhaseBand(s),
    a12_nsnp_learners:
      nsnpLearners != null && Number(nsnpLearners) > 0
        ? String(nsnpLearners)
        : prev.a12_nsnp_learners,
    // Prefill respondent 1 from principal if empty
    a9_r1_name: prev.a9_r1_name || s.principal_name || '',
    a9_r1_position: prev.a9_r1_position || (s.principal_name ? 'Principal' : ''),
    a9_r1_contact: prev.a9_r1_contact || phone || '',
  };
}

type VisitRow = {
  id: number;
  school_name?: string | null;
  emis_number?: string | null;
  district?: string | null;
  visit_date?: string;
  status?: string;
  monitor_name?: string | null;
  overall_kpi?: number | null;
  rkmp_score?: number | null;
  nehs_score?: number | null;
  gardens_score?: number | null;
  traffic_light?: string | null;
  peu_visit_id?: number | null;
  form_data?: MonitoringFormData;
  scores?: MonitoringScores;
};

type PlannedPeu = {
  id: number;
  school_profile_id?: number;
  school_name?: string | null;
  planned_date?: string | null;
  visit_date?: string | null;
  visitor_name?: string | null;
  status?: string;
  district?: string | null;
};

const STEPS = [
  { id: 'a1', label: 'School & interview' },
  { id: 'a2', label: 'Main meal' },
  { id: 'b', label: 'Record keeping' },
  { id: 'c', label: 'Food groups' },
  { id: 'd', label: 'Health & safety' },
  { id: 'e', label: 'Food gardens' },
  { id: 'bf', label: 'Breakfast' },
  { id: 'sum', label: 'KPI & submit' },
] as const;

export default function MonitoringPage() {
  return (
    <CompanyRequired>
      <Suspense
        fallback={
          <SchoolsPage>
            <div className="py-20 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
            </div>
          </SchoolsPage>
        }
      >
        <Inner />
      </Suspense>
    </CompanyRequired>
  );
}

function offlineDraftId(editId: number | null, peuVisitId: number | null) {
  if (editId) return `m-${editId}`;
  if (peuVisitId) return `peu-${peuVisitId}`;
  return 'new';
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [role, setRole] = useState<'agency' | 'school' | 'none'>('none');
  const [editId, setEditId] = useState<number | null>(null);
  const [peuVisitId, setPeuVisitId] = useState<number | null>(null);
  const [plannedVisits, setPlannedVisits] = useState<PlannedPeu[]>([]);
  const [form, setForm] = useState<MonitoringFormData>(() =>
    emptyMonitoringForm()
  );
  const [step, setStep] = useState(0);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [schoolFacets, setSchoolFacets] = useState<{
    districts?: string[];
    circuits?: string[];
    cmcs?: string[];
    quintiles?: string[];
    phases?: string[];
  }>({});
  const [schoolQ, setSchoolQ] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterCircuit, setFilterCircuit] = useState('');
  const [filterQuintile, setFilterQuintile] = useState('');
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [selectedSchoolMeta, setSelectedSchoolMeta] =
    useState<SchoolOpt | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [offlineNote, setOfflineNote] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);

  const scores = useMemo(() => scoreMonitoringForm(form), [form]);
  const draftKey = offlineDraftId(editId, peuVisitId);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/monitoring?companyId=${companyId}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setVisits(data.visits || []);
      setCanCreate(Boolean(data.canCreate));
      setRole(data.role || 'none');
      if (data.warning) toast.message(data.warning);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const loadSchools = useCallback(async () => {
    setSchoolsLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        mode: 'schools',
      });
      if (schoolQ.trim()) params.set('q', schoolQ.trim());
      if (filterDistrict) params.set('district', filterDistrict);
      if (filterCircuit) params.set('circuit', filterCircuit);
      const res = await fetch(`/api/schools/visits?${params}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (res.ok) {
        let list = (data.schools || []) as SchoolOpt[];
        if (filterQuintile) {
          list = list.filter(
            (s) => String(s.quintile ?? '') === filterQuintile
          );
        }
        setSchools(list);
        setSchoolFacets(data.facets || {});
      }
    } finally {
      setSchoolsLoading(false);
    }
  }, [companyId, schoolQ, filterDistrict, filterCircuit, filterQuintile]);

  const loadPlannedVisits = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/schools/visits?companyId=${companyId}&mode=agency&status=planned`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) return;
      const list = (data.visits || []) as PlannedPeu[];
      setPlannedVisits(
        list.filter((v) => String(v.status || '') === 'planned')
      );
    } catch {
      /* soft */
    }
  }, [companyId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (mode === 'form' && canCreate) {
      void loadSchools();
      void loadPlannedVisits();
    }
  }, [mode, canCreate, loadSchools, loadPlannedVisits]);

  useEffect(() => {
    setOnline(isBrowserOnline());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Auto-save offline draft while editing
  useEffect(() => {
    if (mode !== 'form' || readOnly) return;
    const t = setTimeout(() => {
      saveOfflineDraft(
        OFFLINE_SCOPE,
        companyId,
        draftKey,
        {
          form,
          step,
          editId,
          peuVisitId,
        },
        form.a1_school_name || 'Monitoring draft'
      );
      setOfflineNote(`Offline draft saved · ${new Date().toLocaleTimeString()}`);
    }, 800);
    return () => clearTimeout(t);
  }, [form, step, editId, peuVisitId, companyId, draftKey, mode, readOnly]);

  const applyPlannedPeu = useCallback(
    (v: PlannedPeu, schoolsList: SchoolOpt[]) => {
      setPeuVisitId(Number(v.id));
      const sid = Number(v.school_profile_id);
      const match = schoolsList.find((s) => s.id === sid);
      if (match) setSelectedSchoolMeta(match);
      setForm((prev) => {
        let next = {
          ...prev,
          a7_visit_date: String(
            v.planned_date || v.visit_date || prev.a7_visit_date
          ).slice(0, 10),
          a6_monitor_name: v.visitor_name
            ? String(v.visitor_name)
            : prev.a6_monitor_name,
        };
        if (match) {
          next = fillFormFromSchool(next, match);
        } else if (Number.isFinite(sid)) {
          next = {
            ...next,
            school_profile_id: sid,
            a1_school_name: String(v.school_name || next.a1_school_name),
          };
        }
        return next;
      });
    },
    []
  );

  const openNew = (opts?: { peuVisitId?: number | null }) => {
    setEditId(null);
    setPeuVisitId(opts?.peuVisitId ?? null);
    setForm(emptyMonitoringForm());
    setStep(0);
    setReadOnly(false);
    setOfflineNote(null);
    setMode('form');

    // Restore offline draft for this key if present
    const key = offlineDraftId(null, opts?.peuVisitId ?? null);
    const draft = loadOfflineDraft<{
      form?: MonitoringFormData;
      step?: number;
      peuVisitId?: number | null;
    }>(OFFLINE_SCOPE, companyId, key);
    if (draft?.payload?.form) {
      setForm({ ...emptyMonitoringForm(), ...draft.payload.form });
      if (draft.payload.step != null) setStep(Number(draft.payload.step) || 0);
      if (draft.payload.peuVisitId != null)
        setPeuVisitId(Number(draft.payload.peuVisitId));
      setOfflineNote(
        `Restored offline draft (${new Date(draft.savedAt).toLocaleString()})`
      );
      toast.message('Restored offline monitoring draft');
    }
  };

  const openVisit = async (id: number, forceReadOnly = false) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/monitoring?companyId=${companyId}&id=${id}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const v = data.visit;
      const fd = {
        ...emptyMonitoringForm(),
        ...(v.form_data || {}),
      } as MonitoringFormData;

      // Prefer newer offline draft if any
      const draft = loadOfflineDraft<{
        form?: MonitoringFormData;
        step?: number;
        peuVisitId?: number | null;
      }>(OFFLINE_SCOPE, companyId, offlineDraftId(id, null));
      if (
        draft?.payload?.form &&
        String(v.status) !== 'submitted' &&
        data.canEdit
      ) {
        const serverUpdated = v.updated_at
          ? new Date(String(v.updated_at)).getTime()
          : 0;
        const draftAt = new Date(draft.savedAt).getTime();
        if (draftAt > serverUpdated) {
          setForm({ ...emptyMonitoringForm(), ...draft.payload.form });
          if (draft.payload.step != null) setStep(Number(draft.payload.step) || 0);
          setOfflineNote(
            `Restored newer offline draft (${new Date(draft.savedAt).toLocaleString()})`
          );
        } else {
          setForm(fd);
          setStep(0);
        }
      } else {
        setForm(fd);
        setStep(0);
      }

      setEditId(Number(v.id));
      setPeuVisitId(
        v.peu_visit_id != null ? Number(v.peu_visit_id) : null
      );
      setReadOnly(
        forceReadOnly || String(v.status) === 'submitted' || !data.canEdit
      );
      setMode('form');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Open failed');
    } finally {
      setLoading(false);
    }
  };

  // Deep-link: ?id= or ?peuVisitId=
  useEffect(() => {
    if (bootstrapped) return;
    const idParam = searchParams.get('id');
    const peuParam = searchParams.get('peuVisitId');
    if (idParam && Number.isFinite(Number(idParam))) {
      setBootstrapped(true);
      void openVisit(Number(idParam));
      return;
    }
    if (peuParam && Number.isFinite(Number(peuParam))) {
      setBootstrapped(true);
      void (async () => {
        // Existing monitoring for this PEU visit?
        const res = await fetch(
          `/api/schools/monitoring?companyId=${companyId}&peuVisitId=${peuParam}`,
          { cache: 'no-store', credentials: 'same-origin' }
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.visit?.id) {
          await openVisit(Number(data.visit.id));
          return;
        }
        openNew({ peuVisitId: Number(peuParam) });
        // Prefill from PEU list
        const vRes = await fetch(
          `/api/schools/visits?companyId=${companyId}&mode=agency&status=planned`,
          { cache: 'no-store', credentials: 'same-origin' }
        );
        const vData = await vRes.json().catch(() => ({}));
        const planned = ((vData.visits || []) as PlannedPeu[]).find(
          (x) => Number(x.id) === Number(peuParam)
        );
        const sRes = await fetch(
          `/api/schools/visits?companyId=${companyId}&mode=schools`,
          { cache: 'no-store', credentials: 'same-origin' }
        );
        const sData = await sRes.json().catch(() => ({}));
        const schoolList = (sData.schools || []) as SchoolOpt[];
        setSchools(schoolList);
        if (planned) applyPlannedPeu(planned, schoolList);
      })();
      return;
    }
    setBootstrapped(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once from URL
  }, [searchParams, companyId, bootstrapped]);

  const setF = <K extends keyof MonitoringFormData>(
    key: K,
    value: MonitoringFormData[K]
  ) => {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pickSchool = (s: SchoolOpt) => {
    // Tap selected school again → unselect
    if (form.school_profile_id === s.id) {
      clearSchoolSelection();
      return;
    }
    setSelectedSchoolMeta(s);
    setForm((prev) => fillFormFromSchool(prev, s));
    setSchoolQ(s.school_name || '');
    toast.success(
      `Loaded ${s.school_name} — EMIS, district, quintile, learners & principal filled`
    );
  };

  const clearSchoolSelection = () => {
    setSelectedSchoolMeta(null);
    setForm((prev) => ({
      ...prev,
      school_profile_id: null,
      a1_school_name: '',
      a2_emis: '',
      a3_school_phone: '',
      a4_district: '',
      a5_quintile: '',
      school_phase_band: 'primary_combined_intermediate_sec_q1',
      a12_nsnp_learners: '',
      // Clear principal prefill if it still looks like auto-filled respondent
      a9_r1_name: '',
      a9_r1_position: '',
      a9_r1_contact: '',
    }));
    setSchoolQ('');
    toast.message('School unselected — search again or enter details manually');
  };

  const linkPeuVisit = (id: number | null) => {
    if (readOnly) return;
    if (!id) {
      setPeuVisitId(null);
      return;
    }
    const planned = plannedVisits.find((v) => Number(v.id) === id);
    setPeuVisitId(id);
    if (planned) applyPlannedPeu(planned, schools);
  };

  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      if (editId && isBrowserOnline()) {
        const url = `/api/schools/monitoring/pdf?companyId=${companyId}&id=${editId}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      // Live form PDF (draft / offline preview)
      const res = await fetch('/api/schools/monitoring/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          id: editId,
          peu_visit_id: peuVisitId,
          form_data: form,
          status: readOnly ? 'submitted' : 'draft',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'PDF failed');
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `NSNP-Monitoring-Feedback-${(form.a1_school_name || 'school').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40)}.pdf`;
      a.click();
      URL.revokeObjectURL(href);
      toast.success('Feedback PDF downloaded');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'PDF failed');
    } finally {
      setPdfBusy(false);
    }
  };

  const save = async (submit: boolean) => {
    if (readOnly) return;
    if (submit && !form.a1_school_name.trim()) {
      toast.error('School name is required');
      setStep(0);
      return;
    }
    if (submit && !form.a6_monitor_name.trim()) {
      toast.error('Name of official monitoring is required');
      setStep(0);
      return;
    }

    // Always keep offline copy first
    saveOfflineDraft(
      OFFLINE_SCOPE,
      companyId,
      draftKey,
      { form, step, editId, peuVisitId },
      form.a1_school_name || 'Monitoring draft'
    );

    if (!isBrowserOnline()) {
      setOfflineNote(
        `Saved offline (device only) · ${new Date().toLocaleTimeString()}`
      );
      toast.message(
        submit
          ? 'You are offline — draft kept on this device. Submit when back online.'
          : 'Draft saved on this device (offline)'
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/schools/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          id: editId,
          status: submit ? 'submitted' : 'draft',
          form_data: form,
          peu_visit_id: peuVisitId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const newId = Number(data.visit?.id) || editId;
      setEditId(newId);
      if (data.peu_visit_id != null) setPeuVisitId(Number(data.peu_visit_id));
      toast.success(data.message || (submit ? 'Submitted' : 'Draft saved'));
      if (submit) {
        clearOfflineDraft(OFFLINE_SCOPE, companyId, draftKey);
        if (newId)
          clearOfflineDraft(
            OFFLINE_SCOPE,
            companyId,
            offlineDraftId(newId, null)
          );
        if (peuVisitId)
          clearOfflineDraft(
            OFFLINE_SCOPE,
            companyId,
            offlineDraftId(null, peuVisitId)
          );
        setOfflineNote(null);
        setMode('list');
        void loadList();
      } else {
        // Migrate draft key if we got a server id
        if (newId && draftKey === 'new') {
          clearOfflineDraft(OFFLINE_SCOPE, companyId, 'new');
          saveOfflineDraft(
            OFFLINE_SCOPE,
            companyId,
            offlineDraftId(newId, peuVisitId),
            { form, step, editId: newId, peuVisitId },
            form.a1_school_name || 'Monitoring draft'
          );
        }
        setOfflineNote(`Synced to server · ${new Date().toLocaleTimeString()}`);
      }
    } catch (e: unknown) {
      setOfflineNote(
        `Server save failed — kept offline · ${new Date().toLocaleTimeString()}`
      );
      toast.error(
        e instanceof Error
          ? `${e.message} (kept offline draft)`
          : 'Save failed (kept offline draft)'
      );
    } finally {
      setSaving(false);
    }
  };

  if (mode === 'list') {
    return (
      <SchoolsPage>
        <SchoolsHeader
          title="NSNP Monitoring Tool"
          titleAccent="2026-27"
          description="KZN field-worker monitoring form for DBE/PEU. Live scoring for KPI, record keeping, health & safety, and food gardens."
          mode="agency"
          action={
            <div className="flex gap-2">
              <Link
                href="/dashboard/schools/monitoring-report"
                className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                Report & graphs
              </Link>
              <button
                type="button"
                onClick={() => void loadList()}
                className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              {canCreate ? (
                <button
                  type="button"
                  onClick={() => openNew()}
                  className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> New visit form
                </button>
              ) : null}
            </div>
          }
        />

        {!canCreate && role === 'school' ? (
          <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-sky-950">
            Submitted PEU monitoring visits for your school appear below.
          </div>
        ) : null}
        {!canCreate && role === 'none' ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            Register as a DBE/PEU agency to complete monitoring visits.
          </div>
        ) : null}

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : visits.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-800">No monitoring visits yet</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Start a new visit form on site — sections A–E, breakfast and KPI
              feedback match the paper KZN Monitoring Tool.
            </p>
            {canCreate ? (
              <button
                type="button"
                onClick={() => openNew()}
                className="btn-primary !py-2.5 !px-4 text-sm mt-4 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Start monitoring visit
              </button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-3 py-3">School</th>
                  <th className="px-3 py-3">Monitor</th>
                  <th className="px-3 py-3">KPI</th>
                  <th className="px-3 py-3">RKMP</th>
                  <th className="px-3 py-3">NEHS</th>
                  <th className="px-3 py-3">Gardens</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-slate-50 hover:bg-sky-50/40"
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {v.visit_date || '—'}
                      {v.peu_visit_id ? (
                        <div className="text-[10px] text-sky-700 font-bold">
                          PEU #{v.peu_visit_id}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold">
                        {v.school_name || '—'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {[v.emis_number, v.district].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {v.monitor_name || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <TrafficBadge
                        light={v.traffic_light}
                        score={v.overall_kpi}
                      />
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-xs">
                      {v.rkmp_score != null ? `${v.rkmp_score}/20` : '—'}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-xs">
                      {v.nehs_score != null ? `${v.nehs_score}/20` : '—'}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-xs">
                      {v.gardens_score != null ? `${v.gardens_score}/10` : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          v.status === 'submitted'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {v.status || 'draft'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <a
                          href={`/api/schools/monitoring/pdf?companyId=${companyId}&id=${v.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-slate-600 hover:underline inline-flex items-center gap-0.5"
                        >
                          <FileDown className="w-3 h-3" /> PDF
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            void openVisit(
                              v.id,
                              v.status === 'submitted' && !canCreate
                            )
                          }
                          className="text-xs font-bold text-[#0077b6] hover:underline"
                        >
                          {v.status === 'draft' && canCreate
                            ? 'Continue'
                            : 'View'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SchoolsPage>
    );
  }

  // ── Form wizard ────────────────────────────────────────────────────
  return (
    <SchoolsPage>
      <SchoolsHeader
        title={readOnly ? 'Monitoring visit' : 'Field monitoring form'}
        titleAccent={form.a1_school_name || 'NSNP'}
        description="Complete each section on site. Scores calculate automatically from the official 2026-27 tool."
        mode="agency"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('list');
                void loadList();
              }}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All visits
            </button>
            <button
              type="button"
              disabled={pdfBusy}
              onClick={() => void exportPdf()}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              {pdfBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              Feedback PDF
            </button>
            {!readOnly ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save(false)}
                  className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save(true)}
                  className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" /> Submit
                </button>
              </>
            ) : null}
          </div>
        }
      />

      {(!online || offlineNote) && (
        <div
          className={`mb-3 rounded-2xl border px-4 py-2.5 text-sm flex items-start gap-2 ${
            online
              ? 'border-sky-100 bg-sky-50/70 text-sky-950'
              : 'border-amber-200 bg-amber-50 text-amber-950'
          }`}
        >
          {!online ? (
            <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <Save className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div>
            {!online ? (
              <strong>Offline mode.</strong>
            ) : (
              <strong>Device draft.</strong>
            )}{' '}
            {offlineNote ||
              'Changes auto-save on this device and sync when you save online.'}
            {peuVisitId ? (
              <span className="block text-xs mt-0.5 font-semibold">
                Linked PEU visit #{peuVisitId}
                {peuVisitId
                  ? ' — submitting will complete that planned visit'
                  : ''}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* Live score strip */}
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
        <ScoreChip
          label="KPI"
          value={`${scores.overall_kpi}/100`}
          tone={scores.traffic_light}
        />
        <ScoreChip label="RKMP" value={`${scores.rkmp}/20`} />
        <ScoreChip label="NEHS" value={`${scores.nehs}/20`} />
        <ScoreChip label="Gardens" value={`${scores.gardens}/10`} />
        <ScoreChip
          label="Status"
          value={readOnly ? 'Submitted' : editId ? 'Draft' : 'New'}
        />
      </div>

      {/* Step nav */}
      <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(i)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-colors ${
              i === step
                ? 'bg-[#0077b6] text-white border-[#0077b6]'
                : 'bg-white text-slate-600 border-slate-200 hover:border-[#00b4d8]'
            }`}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
        {step === 0 && (
          <SectionA1
            form={form}
            setF={setF}
            schools={schools}
            schoolQ={schoolQ}
            setSchoolQ={setSchoolQ}
            pickSchool={pickSchool}
            clearSchoolSelection={clearSchoolSelection}
            readOnly={readOnly}
            plannedVisits={plannedVisits}
            peuVisitId={peuVisitId}
            linkPeuVisit={linkPeuVisit}
            schoolFacets={schoolFacets}
            filterDistrict={filterDistrict}
            setFilterDistrict={setFilterDistrict}
            filterCircuit={filterCircuit}
            setFilterCircuit={setFilterCircuit}
            filterQuintile={filterQuintile}
            setFilterQuintile={setFilterQuintile}
            schoolsLoading={schoolsLoading}
            selectedSchoolMeta={selectedSchoolMeta}
            reloadSchools={() => void loadSchools()}
          />
        )}
        {step === 1 && (
          <SectionA2 form={form} setF={setF} scores={scores} readOnly={readOnly} />
        )}
        {step === 2 && (
          <SectionB form={form} setF={setF} scores={scores} readOnly={readOnly} />
        )}
        {step === 3 && (
          <SectionC form={form} setF={setF} scores={scores} readOnly={readOnly} />
        )}
        {step === 4 && (
          <SectionD form={form} setF={setF} scores={scores} readOnly={readOnly} />
        )}
        {step === 5 && (
          <SectionE form={form} setF={setF} scores={scores} readOnly={readOnly} />
        )}
        {step === 6 && (
          <SectionBreakfast form={form} setF={setF} readOnly={readOnly} />
        )}
        {step === 7 && (
          <SectionSummary
            form={form}
            setF={setF}
            scores={scores}
            readOnly={readOnly}
          />
        )}

        <div className="flex flex-wrap justify-between gap-2 pt-4 border-t border-slate-100">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1 disabled:opacity-40"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : !readOnly ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(true)}
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Submit monitoring report
            </button>
          ) : null}
        </div>
      </div>
    </SchoolsPage>
  );
}

/* ─── UI helpers ─────────────────────────────────────────────────────── */

function ScoreChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  const toneCls =
    tone === 'green'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'yellow'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : tone === 'red'
          ? 'border-rose-200 bg-rose-50 text-rose-900'
          : 'border-slate-200 bg-white text-slate-900';
  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneCls}`}>
      <div className="text-[9px] font-bold uppercase tracking-wider opacity-60">
        {label}
      </div>
      <div className="text-lg font-black tabular-nums">{value}</div>
    </div>
  );
}

function TrafficBadge({
  light,
  score,
}: {
  light?: string | null;
  score?: number | null;
}) {
  const cls =
    light === 'green'
      ? 'bg-emerald-100 text-emerald-900'
      : light === 'yellow'
        ? 'bg-amber-100 text-amber-900'
        : light === 'red'
          ? 'bg-rose-100 text-rose-900'
          : 'bg-slate-100 text-slate-600';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black tabular-nums ${cls}`}
    >
      {score != null ? score : '—'}
      {light ? (
        <span className="text-[9px] uppercase font-bold opacity-70">
          {light}
        </span>
      ) : null}
    </span>
  );
}

function Field({
  label,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block text-xs ${className}`}>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="block mt-1 text-[10px] text-slate-500 leading-snug">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function inputCls() {
  return 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white';
}

function YesNoToggle({
  value,
  onChange,
  disabled,
  yesLabel = 'Yes',
  noLabel = 'No',
}: {
  value: YesNo;
  onChange: (v: YesNo) => void;
  disabled?: boolean;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
      {(
        [
          ['yes', yesLabel],
          ['no', noLabel],
        ] as const
      ).map(([v, lab]) => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          onClick={() => onChange(v)}
          className={`px-4 py-2.5 text-sm font-bold min-w-[4.5rem] transition-colors ${
            value === v
              ? v === 'yes'
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {lab}
        </button>
      ))}
    </div>
  );
}

function SectionTitle({
  code,
  title,
  sub,
}: {
  code: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#0077b6]">
        {code}
      </div>
      <h3 className="text-lg font-black text-slate-900">{title}</h3>
      {sub ? <p className="text-sm text-slate-500 mt-0.5">{sub}</p> : null}
    </div>
  );
}

/* ─── Sections ───────────────────────────────────────────────────────── */

function SectionA1({
  form,
  setF,
  schools,
  schoolQ,
  setSchoolQ,
  pickSchool,
  clearSchoolSelection,
  readOnly,
  plannedVisits,
  peuVisitId,
  linkPeuVisit,
  schoolFacets,
  filterDistrict,
  setFilterDistrict,
  filterCircuit,
  setFilterCircuit,
  filterQuintile,
  setFilterQuintile,
  schoolsLoading,
  selectedSchoolMeta,
  reloadSchools,
}: {
  form: MonitoringFormData;
  setF: <K extends keyof MonitoringFormData>(
    k: K,
    v: MonitoringFormData[K]
  ) => void;
  schools: SchoolOpt[];
  schoolQ: string;
  setSchoolQ: (q: string) => void;
  pickSchool: (s: SchoolOpt) => void;
  clearSchoolSelection: () => void;
  readOnly: boolean;
  plannedVisits: PlannedPeu[];
  peuVisitId: number | null;
  linkPeuVisit: (id: number | null) => void;
  schoolFacets: {
    districts?: string[];
    circuits?: string[];
    cmcs?: string[];
    quintiles?: string[];
    phases?: string[];
  };
  filterDistrict: string;
  setFilterDistrict: (v: string) => void;
  filterCircuit: string;
  setFilterCircuit: (v: string) => void;
  filterQuintile: string;
  setFilterQuintile: (v: string) => void;
  schoolsLoading: boolean;
  selectedSchoolMeta: SchoolOpt | null;
  reloadSchools: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle
        code="Section A1"
        title="Interview and school details"
        sub="Search your approved school register with deep metadata, select a school to auto-fill A1–A5 / A12 / principal, then complete the interview."
      />

      {!readOnly ? (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-3 space-y-2">
          <Field
            label="Link planned PEU visit (optional)"
            hint="Completing this monitoring form will mark the planned visit as completed and copy KPI scores."
          >
            <select
              className={inputCls()}
              value={peuVisitId != null ? String(peuVisitId) : ''}
              onChange={(e) =>
                linkPeuVisit(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">— no PEU plan linked —</option>
              {plannedVisits.map((v) => (
                <option key={v.id} value={v.id}>
                  {String(v.planned_date || v.visit_date || '').slice(0, 10)} ·{' '}
                  {v.school_name || `School #${v.school_profile_id}`}
                  {v.visitor_name ? ` · ${v.visitor_name}` : ''}
                </option>
              ))}
            </select>
          </Field>
          {peuVisitId ? (
            <p className="text-[11px] font-semibold text-violet-900">
              Linked to PEU visit #{peuVisitId}. Open from Visits → Start
              monitoring to pre-fill.
            </p>
          ) : null}
        </div>
      ) : peuVisitId ? (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/40 px-3 py-2 text-xs font-semibold text-violet-900">
          Linked PEU visit #{peuVisitId}
        </div>
      ) : null}

      {!readOnly ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
                Find approved school
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Deep search: school name, EMIS, NATEMIS, district, circuit, CMC,
                municipality, ward, phase, quintile, principal, phone…
              </p>
            </div>
            <button
              type="button"
              onClick={reloadSchools}
              className="btn-secondary !py-1.5 !px-2.5 text-[11px] inline-flex items-center gap-1"
            >
              {schoolsLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Search
            </button>
          </div>
          <Field label="Metadata search">
            <input
              className={inputCls()}
              value={schoolQ}
              onChange={(e) => setSchoolQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  reloadSchools();
                }
              }}
              placeholder="e.g. Umlazi Q3 primary 50012… or principal name"
              autoComplete="off"
            />
          </Field>
          <div className="grid sm:grid-cols-3 gap-2">
            <Field label="District">
              <select
                className={inputCls()}
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
              >
                <option value="">All districts</option>
                {(schoolFacets.districts || []).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Circuit">
              <select
                className={inputCls()}
                value={filterCircuit}
                onChange={(e) => setFilterCircuit(e.target.value)}
              >
                <option value="">All circuits</option>
                {(schoolFacets.circuits || []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quintile">
              <select
                className={inputCls()}
                value={filterQuintile}
                onChange={(e) => setFilterQuintile(e.target.value)}
              >
                <option value="">All quintiles</option>
                {(schoolFacets.quintiles || ['1', '2', '3', '4', '5']).map(
                  (q) => (
                    <option key={q} value={q}>
                      Q{q}
                    </option>
                  )
                )}
              </select>
            </Field>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1 rounded-xl border border-sky-100 bg-white p-1">
            {schoolsLoading ? (
              <div className="py-8 flex justify-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : schools.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500">
                No approved schools match. Clear filters or widen your search.
              </p>
            ) : (
              schools.slice(0, 80).map((s) => {
                const selected = form.school_profile_id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickSchool(s)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${
                      selected
                        ? 'border-[#00b4d8] bg-sky-50 ring-1 ring-[#00b4d8]/30'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-1">
                      <span className="text-sm font-bold text-slate-900">
                        {s.school_name}
                      </span>
                      {selected ? (
                        <span className="text-[10px] font-bold uppercase text-emerald-700">
                          Selected · tap to unselect
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {[
                        s.emis_number || s.natemis
                          ? `EMIS ${s.emis_number || s.natemis}`
                          : null,
                        s.district,
                        s.circuit,
                        s.cmc ? `CMC ${s.cmc}` : null,
                        s.local_municipality,
                        s.quintile != null ? `Q${s.quintile}` : null,
                        s.phase || s.level_label,
                        s.nsnp_approved_learners != null
                          ? `${s.nsnp_approved_learners} NSNP learners`
                          : s.learners
                            ? `${s.learners} enrolled`
                            : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    {s.principal_name ? (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Principal: {s.principal_name}
                        {s.principal_phone || s.school_phone
                          ? ` · ${s.principal_phone || s.school_phone}`
                          : ''}
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
          <p className="text-[10px] text-slate-500">
            Showing {Math.min(schools.length, 80)} of {schools.length} approved
            school{schools.length === 1 ? '' : 's'}. Tap a row to populate the
            form below. Tap the selected school again to unselect.
          </p>
        </div>
      ) : null}

      {(selectedSchoolMeta || form.school_profile_id) && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-black text-emerald-950">
                {selectedSchoolMeta?.school_name || form.a1_school_name}
              </p>
              <p className="text-[11px] text-emerald-900/80 mt-0.5 leading-snug">
                {[
                  form.a2_emis ? `EMIS ${form.a2_emis}` : null,
                  form.a4_district,
                  form.a5_quintile ? `Q${form.a5_quintile}` : null,
                  form.a3_school_phone,
                  form.a12_nsnp_learners
                    ? `${form.a12_nsnp_learners} NSNP approved learners`
                    : null,
                  selectedSchoolMeta?.circuit,
                  selectedSchoolMeta?.cmc
                    ? `CMC ${selectedSchoolMeta.cmc}`
                    : null,
                  selectedSchoolMeta?.local_municipality,
                  selectedSchoolMeta?.phase || selectedSchoolMeta?.level_label,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="text-[10px] text-emerald-800/70 mt-1">
                Registry details loaded — complete A6–A14 and continue the form.
              </p>
            </div>
            {!readOnly ? (
              <button
                type="button"
                onClick={clearSchoolSelection}
                className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                title="Unselect this school and clear auto-filled fields"
              >
                <X className="w-3.5 h-3.5" />
                Unselect school
              </button>
            ) : null}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="A1 Name of school *">
          <input
            className={inputCls()}
            disabled={readOnly}
            value={form.a1_school_name}
            onChange={(e) => setF('a1_school_name', e.target.value)}
          />
        </Field>
        <Field label="A2 EMIS number">
          <input
            className={inputCls()}
            disabled={readOnly}
            value={form.a2_emis}
            onChange={(e) => setF('a2_emis', e.target.value)}
          />
        </Field>
        <Field label="A3 School telephone">
          <input
            className={inputCls()}
            disabled={readOnly}
            value={form.a3_school_phone}
            onChange={(e) => setF('a3_school_phone', e.target.value)}
          />
        </Field>
        <Field label="A4 District">
          <input
            className={inputCls()}
            disabled={readOnly}
            value={form.a4_district}
            onChange={(e) => setF('a4_district', e.target.value)}
          />
        </Field>
        <Field label="A5 Quintile ranking">
          <select
            className={inputCls()}
            disabled={readOnly}
            value={form.a5_quintile}
            onChange={(e) => setF('a5_quintile', e.target.value)}
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((q) => (
              <option key={q} value={String(q)}>
                Quintile {q}
              </option>
            ))}
          </select>
        </Field>
        <Field label="School type (for feeding times)">
          <select
            className={inputCls()}
            disabled={readOnly}
            value={form.school_phase_band}
            onChange={(e) =>
              setF(
                'school_phase_band',
                e.target.value as MonitoringFormData['school_phase_band']
              )
            }
          >
            <option value="primary_combined_intermediate_sec_q1">
              Primary / Combined / Intermediate / Secondary Q1
            </option>
            <option value="secondary_q2_5">
              Secondary Q2–5 (no NSNP funded breakfast)
            </option>
          </select>
        </Field>
        <Field label="A6 Name of official monitoring *">
          <input
            className={inputCls()}
            disabled={readOnly}
            value={form.a6_monitor_name}
            onChange={(e) => setF('a6_monitor_name', e.target.value)}
          />
        </Field>
        <Field label="A7 Date of visit">
          <input
            type="date"
            className={inputCls()}
            disabled={readOnly}
            value={form.a7_visit_date}
            onChange={(e) => setF('a7_visit_date', e.target.value)}
          />
        </Field>
        <Field label="A8 Time in">
          <input
            type="time"
            className={inputCls()}
            disabled={readOnly}
            value={form.a8_time_in}
            onChange={(e) => setF('a8_time_in', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-100 p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase text-slate-400">
            A9 Respondent 1
          </div>
          <Field label="Name">
            <input
              className={inputCls()}
              disabled={readOnly}
              value={form.a9_r1_name}
              onChange={(e) => setF('a9_r1_name', e.target.value)}
            />
          </Field>
          <Field label="Position">
            <input
              className={inputCls()}
              disabled={readOnly}
              value={form.a9_r1_position}
              onChange={(e) => setF('a9_r1_position', e.target.value)}
            />
          </Field>
          <Field label="Contact number">
            <input
              className={inputCls()}
              disabled={readOnly}
              value={form.a9_r1_contact}
              onChange={(e) => setF('a9_r1_contact', e.target.value)}
            />
          </Field>
        </div>
        <div className="rounded-2xl border border-slate-100 p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase text-slate-400">
            A9 Respondent 2
          </div>
          <Field label="Name">
            <input
              className={inputCls()}
              disabled={readOnly}
              value={form.a9_r2_name}
              onChange={(e) => setF('a9_r2_name', e.target.value)}
            />
          </Field>
          <Field label="Position">
            <input
              className={inputCls()}
              disabled={readOnly}
              value={form.a9_r2_position}
              onChange={(e) => setF('a9_r2_position', e.target.value)}
            />
          </Field>
          <Field label="Contact number">
            <input
              className={inputCls()}
              disabled={readOnly}
              value={form.a9_r2_contact}
              onChange={(e) => setF('a9_r2_contact', e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="A10 Service provider company name">
          <input
            className={inputCls()}
            disabled={readOnly}
            value={form.a10_sp_name}
            onChange={(e) => setF('a10_sp_name', e.target.value)}
          />
        </Field>
        <Field label="A10 SP contact number">
          <input
            className={inputCls()}
            disabled={readOnly}
            value={form.a10_sp_number}
            onChange={(e) => setF('a10_sp_number', e.target.value)}
          />
        </Field>
        <Field label="A11 Service provider delivered adequate food items?">
          <YesNoToggle
            value={form.a11_sp_adequate}
            disabled={readOnly}
            onChange={(v) => setF('a11_sp_adequate', v)}
          />
        </Field>
        <Field label="A12 No. of NSNP approved learners">
          <input
            inputMode="numeric"
            className={inputCls()}
            disabled={readOnly}
            value={form.a12_nsnp_learners}
            onChange={(e) => setF('a12_nsnp_learners', e.target.value)}
          />
        </Field>
        <Field label="A13 No. of learners eating today">
          <input
            inputMode="numeric"
            className={inputCls()}
            disabled={readOnly}
            value={form.a13_learners_eating}
            onChange={(e) => setF('a13_learners_eating', e.target.value)}
          />
        </Field>
        <Field label="A14 No. of Food Handlers engaged">
          <input
            inputMode="numeric"
            className={inputCls()}
            disabled={readOnly}
            value={form.a14_food_handlers}
            onChange={(e) => setF('a14_food_handlers', e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function SectionA2({
  form,
  setF,
  scores,
  readOnly,
}: {
  form: MonitoringFormData;
  setF: <K extends keyof MonitoringFormData>(
    k: K,
    v: MonitoringFormData[K]
  ) => void;
  scores: MonitoringScores;
  readOnly: boolean;
}) {
  const skipTimes = form.a15_feeding_today === 'no';
  const isSec = form.school_phase_band === 'secondary_q2_5';

  return (
    <div className="space-y-4">
      <SectionTitle
        code="Section A2"
        title="Feeding of main meal"
        sub="If feeding is not taking place, skip A16–A17 and continue to Section B. KPI becomes 0."
      />
      <Field label="A15 Is feeding of the main meal taking place today?">
        <YesNoToggle
          value={form.a15_feeding_today}
          disabled={readOnly}
          onChange={(v) => setF('a15_feeding_today', v)}
        />
      </Field>

      {skipTimes ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 flex gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          Feeding not taking place — school KPI is scored 0. Continue to Section
          B.
        </div>
      ) : null}

      {!skipTimes && form.a15_feeding_today === 'yes' && !isSec ? (
        <div className="space-y-2">
          <Field
            label="A16 By what time is main meal feeding completed? (Primary / Combined / Intermediate / Secondary Q1)"
            hint="By 11:30 = 20 · 11:31–12:00 = 15 · 12:01–12:30 = 10 · After 12:30 = 0"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  ['by_1130', 'By 11:30am', 20],
                  ['1131_1200', '11:31–12:00', 15],
                  ['1201_1230', '12:01–12:30', 10],
                  ['after_1230', 'After 12:30', 0],
                ] as const
              ).map(([v, lab, pts]) => (
                <button
                  key={v}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setF('a16_feed_time_primary', v)}
                  className={`rounded-2xl border px-3 py-3 text-left ${
                    form.a16_feed_time_primary === v
                      ? 'border-[#0077b6] bg-sky-50 ring-2 ring-[#00b4d8]/30'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="text-sm font-bold">{lab}</div>
                  <div className="text-[11px] text-slate-500">{pts} pts</div>
                </button>
              ))}
            </div>
          </Field>
        </div>
      ) : null}

      {!skipTimes && form.a15_feeding_today === 'yes' && isSec ? (
        <Field
          label="A17 By what time is main meal feeding completed? (Secondary Q2–5)"
          hint="By 10:00 = 20 · 10:01–10:30 = 15 · 10:31–11:00 = 10 · After 11:00 = 0"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                ['by_1000', 'By 10:00am', 20],
                ['1001_1030', '10:01–10:30', 15],
                ['1031_1100', '10:31–11:00', 10],
                ['after_1100', 'After 11:00', 0],
              ] as const
            ).map(([v, lab, pts]) => (
              <button
                key={v}
                type="button"
                disabled={readOnly}
                onClick={() => setF('a17_feed_time_secondary', v)}
                className={`rounded-2xl border px-3 py-3 text-left ${
                  form.a17_feed_time_secondary === v
                    ? 'border-[#0077b6] bg-sky-50 ring-2 ring-[#00b4d8]/30'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="text-sm font-bold">{lab}</div>
                <div className="text-[11px] text-slate-500">{pts} pts</div>
              </button>
            ))}
          </div>
        </Field>
      ) : null}

      <div className="text-sm font-semibold text-slate-700">
        Feeding time score: {scores.feeding_time_points}/20
      </div>
    </div>
  );
}

function SectionB({
  form,
  setF,
  scores,
  readOnly,
}: {
  form: MonitoringFormData;
  setF: <K extends keyof MonitoringFormData>(
    k: K,
    v: MonitoringFormData[K]
  ) => void;
  scores: MonitoringScores;
  readOnly: boolean;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle
        code="Section B"
        title="Record keeping & management practices"
        sub={`Centralised checklist · live score ${scores.rkmp}/20`}
      />
      <div className="space-y-3">
        {B_QUESTIONS.map((q) => {
          const key = q.key as keyof MonitoringFormData;
          const val = form[key] as YesNo;
          const pts = scores.b_detail[q.code.toLowerCase()] ?? 0;
          return (
            <div
              key={q.code}
              className="rounded-2xl border border-slate-100 p-3 sm:p-4 space-y-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-[#0077b6]">
                    {q.code} · {q.points} pts
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {q.label}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    {q.guidance}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tabular-nums text-slate-500">
                    {pts}/{q.points}
                  </span>
                  <YesNoToggle
                    value={val}
                    disabled={readOnly}
                    onChange={(v) => setF(key, v as never)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
        <div className="text-sm font-black">
          B9 · Products sampled for counting
        </div>
        <p className="text-[11px] text-slate-600">
          Randomly select at least 2 products (include high-risk). Award B9 only
          if all counted products match the stock register.
        </p>
        {form.b9_samples.map((sample, idx) => (
          <div
            key={idx}
            className="grid sm:grid-cols-4 gap-2 items-end bg-white rounded-xl p-3 border border-amber-100"
          >
            <Field label={`Product ${idx + 1}`}>
              <input
                className={inputCls()}
                disabled={readOnly}
                value={sample.product}
                onChange={(e) => {
                  const next = [...form.b9_samples];
                  next[idx] = { ...next[idx], product: e.target.value };
                  setF('b9_samples', next);
                }}
              />
            </Field>
            <Field label="Qty counted">
              <input
                className={inputCls()}
                disabled={readOnly}
                value={sample.qty_counted}
                onChange={(e) => {
                  const next = [...form.b9_samples];
                  next[idx] = { ...next[idx], qty_counted: e.target.value };
                  setF('b9_samples', next);
                }}
              />
            </Field>
            <Field label="Qty on register">
              <input
                className={inputCls()}
                disabled={readOnly}
                value={sample.qty_register}
                onChange={(e) => {
                  const next = [...form.b9_samples];
                  next[idx] = { ...next[idx], qty_register: e.target.value };
                  setF('b9_samples', next);
                }}
              />
            </Field>
            <Field label="Register up to date?">
              <YesNoToggle
                value={sample.match}
                disabled={readOnly}
                onChange={(v) => {
                  const next = [...form.b9_samples];
                  next[idx] = { ...next[idx], match: v };
                  setF('b9_samples', next);
                }}
              />
            </Field>
          </div>
        ))}
      </div>

      <div className="text-right text-sm font-black">
        Record keeping score: {scores.rkmp}/20
      </div>
    </div>
  );
}

function SectionC({
  form,
  setF,
  scores,
  readOnly,
}: {
  form: MonitoringFormData;
  setF: <K extends keyof MonitoringFormData>(
    k: K,
    v: MonitoringFormData[K]
  ) => void;
  scores: MonitoringScores;
  readOnly: boolean;
}) {
  const rows: Array<{
    key: 'c_starch' | 'c_protein' | 'c_fruit_veg';
    label: string;
    kpi: number;
  }> = [
    { key: 'c_starch', label: 'Starch', kpi: scores.starch_kpi },
    { key: 'c_protein', label: 'Protein', kpi: scores.protein_kpi },
    { key: 'c_fruit_veg', label: 'Fruit / Vegetable', kpi: scores.veg_kpi },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle
        code="Section C"
        title="Calculation page — food groups"
        sub="From kitchen observation vs School Specific Menu. % prepared drives KPI quantity bands."
      />
      {rows.map((r) => {
        const row = form[r.key];
        const pct = foodGroupPct(row);
        return (
          <div
            key={r.key}
            className="rounded-2xl border border-slate-100 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-black text-slate-900">{r.label}</div>
              <label className="inline-flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={row.served}
                  onChange={(e) =>
                    setF(r.key, { ...row, served: e.target.checked })
                  }
                />
                Served today
              </label>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <Field label="Product / quantity description" className="sm:col-span-2">
                <input
                  className={inputCls()}
                  disabled={readOnly}
                  placeholder="e.g. 2 × 5kg bags"
                  value={row.product_description}
                  onChange={(e) =>
                    setF(r.key, {
                      ...row,
                      product_description: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Qty prepared (observed)">
                <input
                  className={inputCls()}
                  disabled={readOnly}
                  value={row.qty_prepared}
                  onChange={(e) =>
                    setF(r.key, { ...row, qty_prepared: e.target.value })
                  }
                />
              </Field>
              <Field label="Qty should have prepared (menu)">
                <input
                  className={inputCls()}
                  disabled={readOnly}
                  value={row.qty_should}
                  onChange={(e) =>
                    setF(r.key, { ...row, qty_should: e.target.value })
                  }
                />
              </Field>
              <Field
                label="% prepared (auto or override)"
                hint="81–100→20 · 61–80→15 · 41–60→10 · 25–40→5 · 0–24→0"
              >
                <input
                  className={inputCls()}
                  disabled={readOnly}
                  value={row.pct_prepared || (pct != null ? String(pct) : '')}
                  onChange={(e) =>
                    setF(r.key, { ...row, pct_prepared: e.target.value })
                  }
                  placeholder="auto from prepared ÷ should"
                />
              </Field>
              <div className="flex items-end">
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-sm font-black">
                  KPI pts: {r.kpi}/20
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <Field label="No. learners attending during final exams (if applicable)">
        <input
          className={inputCls()}
          disabled={readOnly}
          value={form.c_exam_learners}
          onChange={(e) => setF('c_exam_learners', e.target.value)}
        />
      </Field>
      <div className="rounded-2xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm font-semibold">
        Food groups served: {scores.food_groups_served}/3 · Balance KPI:{' '}
        {scores.food_groups_kpi}/20
      </div>
    </div>
  );
}

function SectionD({
  form,
  setF,
  scores,
  readOnly,
}: {
  form: MonitoringFormData;
  setF: <K extends keyof MonitoringFormData>(
    k: K,
    v: MonitoringFormData[K]
  ) => void;
  scores: MonitoringScores;
  readOnly: boolean;
}) {
  let lastArea = '';
  return (
    <div className="space-y-4">
      <SectionTitle
        code="Section D"
        title="Nutrition education, health & safety"
        sub={`Live score ${scores.nehs}/20`}
      />
      <div className="space-y-3">
        {D_QUESTIONS.map((q) => {
          const showArea = q.area !== lastArea;
          lastArea = q.area;
          const key = q.key as keyof MonitoringFormData;
          const val = form[key] as YesNo;
          const pts = scores.d_detail[q.code.toLowerCase()] ?? 0;
          return (
            <div key={q.code}>
              {showArea ? (
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 mt-2">
                  {q.area}
                </div>
              ) : null}
              <div className="rounded-2xl border border-slate-100 p-3 sm:p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold text-[#0077b6]">
                      {q.code} · {q.points} pts
                    </div>
                    <div className="text-sm font-semibold">{q.label}</div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {q.guidance}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black tabular-nums text-slate-500">
                      {pts}/{q.points}
                    </span>
                    <YesNoToggle
                      value={val}
                      disabled={readOnly}
                      onChange={(v) => setF(key, v as never)}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Field label="D17 Are the key NSNP products correctly labelled?">
        <YesNoToggle
          value={form.d17}
          disabled={readOnly}
          onChange={(v) => setF('d17', v)}
        />
      </Field>

      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-4 py-2 text-sm font-black">
          Food safety & quality tracking sheet (D14–D17)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="border-b text-left text-[10px] uppercase text-slate-400">
                <th className="px-3 py-2">Product</th>
                <th className="px-2 py-2">D14 Spec</th>
                <th className="px-2 py-2">D15 Pack</th>
                <th className="px-2 py-2">D16 Expiry</th>
                <th className="px-2 py-2">Expiry date</th>
                <th className="px-2 py-2">D17 Label</th>
              </tr>
            </thead>
            <tbody>
              {FOOD_QUALITY_PRODUCTS.map((p) => {
                const row = form.quality[p.key];
                const setQ = (
                  field: keyof typeof row,
                  value: string | YesNo
                ) => {
                  setF('quality', {
                    ...form.quality,
                    [p.key]: { ...row, [field]: value },
                  });
                };
                return (
                  <tr key={p.key} className="border-b border-slate-50">
                    <td className="px-3 py-2">
                      <div className="font-bold">{p.label}</div>
                      <div className="text-[10px] text-slate-400 max-w-[12rem]">
                        {p.spec}
                      </div>
                    </td>
                    {(
                      [
                        'within_spec',
                        'original_packaging',
                        'within_expiry',
                      ] as const
                    ).map((f) => (
                      <td key={f} className="px-2 py-2">
                        <YesNoToggle
                          value={row[f]}
                          disabled={readOnly}
                          onChange={(v) => setQ(f, v)}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs w-32"
                        disabled={readOnly}
                        value={row.expiry_date}
                        onChange={(e) => setQ('expiry_date', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <YesNoToggle
                        value={row.correctly_labelled}
                        disabled={readOnly}
                        onChange={(v) => setQ('correctly_labelled', v)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-100 p-3 space-y-2">
          <div className="text-sm font-bold">S1 Sample containers</div>
          <p className="text-[11px] text-slate-500">
            Evidence school kept sample containers for max 24 hours?
          </p>
          <YesNoToggle
            value={form.s1_sample_containers}
            disabled={readOnly}
            onChange={(v) => setF('s1_sample_containers', v)}
          />
        </div>
        <div className="rounded-2xl border border-slate-100 p-3 space-y-2">
          <div className="text-sm font-bold">S2 Certificate of Acceptability</div>
          <p className="text-[11px] text-slate-500">
            Valid COA from local health authority in current Principal&apos;s
            name?
          </p>
          <YesNoToggle
            value={form.s2_coa_valid}
            disabled={readOnly}
            onChange={(v) => setF('s2_coa_valid', v)}
          />
        </div>
      </div>

      <div className="text-right text-sm font-black">
        Nutrition / health & safety: {scores.nehs}/20
      </div>
    </div>
  );
}

function SectionE({
  form,
  setF,
  scores,
  readOnly,
}: {
  form: MonitoringFormData;
  setF: <K extends keyof MonitoringFormData>(
    k: K,
    v: MonitoringFormData[K]
  ) => void;
  scores: MonitoringScores;
  readOnly: boolean;
}) {
  const skip = form.e1_has_garden === 'no';
  return (
    <div className="space-y-4">
      <SectionTitle
        code="Section E"
        title="School food gardens"
        sub={`Score ${scores.gardens}/10`}
      />
      <Field label="E1 Does the school have a vegetable garden and/or another food production initiative?">
        <YesNoToggle
          value={form.e1_has_garden}
          disabled={readOnly}
          onChange={(v) => setF('e1_has_garden', v)}
        />
      </Field>
      {skip ? (
        <Field label="If no, explain why not">
          <textarea
            className={inputCls() + ' min-h-[80px]'}
            disabled={readOnly}
            value={form.e1_why_not}
            onChange={(e) => setF('e1_why_not', e.target.value)}
          />
        </Field>
      ) : null}

      {!skip && form.e1_has_garden === 'yes' ? (
        <>
          <Field
            label="E2 Condition of the garden (observe only — do not ask)"
            hint="Good 4 · Average 2 · Neglected 0"
          >
            <div className="grid sm:grid-cols-3 gap-2">
              {(
                [
                  ['good', 'Good', 'Not dry, watered, no weeds, labelled', 4],
                  [
                    'average',
                    'Average',
                    'Not dry, watered, some weeds, produces',
                    2,
                  ],
                  ['neglected', 'Neglected', 'Dry and has weeds', 0],
                ] as const
              ).map(([v, lab, desc, pts]) => (
                <button
                  key={v}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setF('e2_condition', v)}
                  className={`rounded-2xl border p-3 text-left ${
                    form.e2_condition === v
                      ? 'border-[#0077b6] bg-sky-50'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="font-bold text-sm">
                    {lab} · {pts} pts
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">{desc}</div>
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="E3 Who is involved in the garden? (max 2 points)"
            hint="Learners/Educators 2 · Ground staff 1 · Community 1 — community alone using school premises does not score."
          >
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ['e3_learners_educators', 'Learners / Educators'],
                  ['e3_ground_staff', 'Ground staff'],
                  ['e3_community', 'Community'],
                ] as const
              ).map(([k, lab]) => (
                <label
                  key={k}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                >
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={form[k]}
                    onChange={(e) => setF(k, e.target.checked)}
                  />
                  {lab}
                </label>
              ))}
            </div>
          </Field>
          <Field label="E3 Explain how">
            <textarea
              className={inputCls() + ' min-h-[70px]'}
              disabled={readOnly}
              value={form.e3_explain}
              onChange={(e) => setF('e3_explain', e.target.value)}
            />
          </Field>

          <Field
            label="E4 What is done with the produce/harvest? (don't prompt)"
            hint="Supplement feeding = 2 · Other = 0"
          >
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['supplement_feeding', 'Supplement feeding', 2],
                  ['other', 'Other', 0],
                ] as const
              ).map(([v, lab, pts]) => (
                <button
                  key={v}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setF('e4_produce_use', v)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                    form.e4_produce_use === v
                      ? 'border-[#0077b6] bg-sky-50'
                      : 'border-slate-200'
                  }`}
                >
                  {lab} ({pts})
                </button>
              ))}
            </div>
          </Field>
        </>
      ) : null}

      <div className="text-right text-sm font-black">
        School food gardens: {scores.gardens}/10
      </div>
    </div>
  );
}

function SectionBreakfast({
  form,
  setF,
  readOnly,
}: {
  form: MonitoringFormData;
  setF: <K extends keyof MonitoringFormData>(
    k: K,
    v: MonitoringFormData[K]
  ) => void;
  readOnly: boolean;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle
        code="Breakfast form"
        title="NSNP breakfast — school monitoring"
        sub="Complete for schools that offer NSNP-funded breakfast."
      />
      <Field label="BF1 Was breakfast served this morning?">
        <YesNoToggle
          value={form.bf1_served}
          disabled={readOnly}
          onChange={(v) => setF('bf1_served', v)}
        />
      </Field>
      {form.bf1_served === 'yes' ? (
        <Field label="BF2 What time was serving of breakfast completed?">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['before_8', 'Before 8:00am'],
                ['after_8', 'After 8:00am'],
              ] as const
            ).map(([v, lab]) => (
              <button
                key={v}
                type="button"
                disabled={readOnly}
                onClick={() => setF('bf2_time', v)}
                className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                  form.bf2_time === v
                    ? 'border-[#0077b6] bg-sky-50'
                    : 'border-slate-200'
                }`}
              >
                {lab}
              </button>
            ))}
          </div>
        </Field>
      ) : null}
      {form.bf1_served === 'no' ? (
        <Field label="BF3 Reasons why breakfast was not served">
          <textarea
            className={inputCls() + ' min-h-[90px]'}
            disabled={readOnly}
            value={form.bf3_reason}
            onChange={(e) => setF('bf3_reason', e.target.value)}
          />
        </Field>
      ) : null}
      <Field label="Challenge identified requiring action">
        <textarea
          className={inputCls() + ' min-h-[70px]'}
          disabled={readOnly}
          value={form.bf_challenges}
          onChange={(e) => setF('bf_challenges', e.target.value)}
        />
      </Field>
      <Field label="Corrective / remedial action required">
        <textarea
          className={inputCls() + ' min-h-[70px]'}
          disabled={readOnly}
          value={form.bf_actions}
          onChange={(e) => setF('bf_actions', e.target.value)}
        />
      </Field>
      <Field label="Other comments">
        <textarea
          className={inputCls() + ' min-h-[70px]'}
          disabled={readOnly}
          value={form.bf_comments}
          onChange={(e) => setF('bf_comments', e.target.value)}
        />
      </Field>
    </div>
  );
}

function SectionSummary({
  form,
  setF,
  scores,
  readOnly,
}: {
  form: MonitoringFormData;
  setF: <K extends keyof MonitoringFormData>(
    k: K,
    v: MonitoringFormData[K]
  ) => void;
  scores: MonitoringScores;
  readOnly: boolean;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle
        code="Feedback form"
        title="School monitoring feedback & KPI"
        sub="Auto-calculated from your answers. Share with principal and NSNP coordinator."
      />

      <div
        className={`rounded-3xl border-2 p-5 ${
          scores.traffic_light === 'green'
            ? 'border-emerald-300 bg-emerald-50'
            : scores.traffic_light === 'yellow'
              ? 'border-amber-300 bg-amber-50'
              : 'border-rose-300 bg-rose-50'
        }`}
      >
        <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">
          School key performance indicator
        </div>
        <div className="text-4xl font-black tabular-nums mt-1">
          {scores.overall_kpi}
          <span className="text-lg font-bold opacity-60">/100</span>
        </div>
        <div className="text-sm font-bold uppercase mt-1">
          {scores.traffic_light === 'green'
            ? 'Green (81–100)'
            : scores.traffic_light === 'yellow'
              ? 'Yellow (50–80)'
              : 'Red (0–49)'}
        </div>
        <div className="mt-4 grid sm:grid-cols-2 gap-2 text-sm">
          <div>
            Feeding today:{' '}
            <strong>
              {form.a15_feeding_today === 'yes'
                ? 'Yes'
                : form.a15_feeding_today === 'no'
                  ? 'No → KPI 0'
                  : '—'}
            </strong>
          </div>
          <div>
            Feeding time pts:{' '}
            <strong>{scores.feeding_time_points}/20</strong>
          </div>
          <div>
            Food groups balance:{' '}
            <strong>
              {scores.food_groups_served}/3 → {scores.food_groups_kpi}/20
            </strong>
          </div>
          <div>
            Starch qty:{' '}
            <strong>{scores.starch_kpi}/20</strong>
          </div>
          <div>
            Protein qty: <strong>{scores.protein_kpi}/20</strong>
          </div>
          <div>
            Veg/Fruit qty: <strong>{scores.veg_kpi}/20</strong>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="text-[10px] font-bold uppercase text-slate-400">
            Record keeping
          </div>
          <div className="text-2xl font-black">{scores.rkmp}/20</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {scores.rkmp >= 16
              ? 'Green band'
              : scores.rkmp >= 0
                ? 'Needs attention'
                : ''}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="text-[10px] font-bold uppercase text-slate-400">
            Health & safety
          </div>
          <div className="text-2xl font-black">{scores.nehs}/20</div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="text-[10px] font-bold uppercase text-slate-400">
            Food gardens
          </div>
          <div className="text-2xl font-black">{scores.gardens}/10</div>
        </div>
      </div>

      <Field label="Observations / challenges identified">
        <textarea
          className={inputCls() + ' min-h-[100px]'}
          disabled={readOnly}
          value={form.observations}
          onChange={(e) => setF('observations', e.target.value)}
        />
      </Field>
      <Field label="Recommendations / action required">
        <textarea
          className={inputCls() + ' min-h-[100px]'}
          disabled={readOnly}
          value={form.recommendations}
          onChange={(e) => setF('recommendations', e.target.value)}
        />
      </Field>

      <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-3">
        <p className="text-sm text-slate-700">
          <strong>Acknowledgement:</strong> I have read and understood the
          report and the actions to be taken and will ensure these are addressed
          timeously.
        </p>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            disabled={readOnly}
            checked={form.principal_ack}
            onChange={(e) => setF('principal_ack', e.target.checked)}
          />
          Principal acknowledgement recorded
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            disabled={readOnly}
            checked={form.coordinator_ack}
            onChange={(e) => setF('coordinator_ack', e.target.checked)}
          />
          NSNP coordinator acknowledgement recorded
        </label>
      </div>

      <div className="flex flex-wrap gap-3 items-center text-[11px] text-slate-400">
        <span>Tool version matches paper form</span>
        <Link href="/dashboard/schools/visits" className="underline">
          PEU visit planner
        </Link>
      </div>
    </div>
  );
}
