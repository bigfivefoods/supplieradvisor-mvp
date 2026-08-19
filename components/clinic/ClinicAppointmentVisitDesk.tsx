'use client';

/**
 * Calendar visit desk — practice notes (private), script/rehab (client),
 * client notes, movements (physio), invoice, claim, follow-up.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Bell,
  CalendarPlus,
  FileText,
  Loader2,
  Package,
  Pill,
  Receipt,
  Send,
  StickyNote,
  Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  claimStatusLabel,
  medicalAidSummary,
  SCRIPT_ROUTES,
  type PatientMedicalRecord,
} from '@/lib/clinic/patient-medical';
import type { VisitNote } from '@/lib/services/advisor-clinical';
import type { ClinicClaimsModule } from '@/lib/clinic/medical-aid-claims';
import {
  notesForVisit,
  type AppointmentVisitPatient,
} from '@/lib/clinic/appointment-visit';
import type { AdvisorAccountModule } from '@/lib/b2c/member-account-types';
import { formatZar } from '@/lib/b2c/member-account-types';
import { AppointmentMaterialsPanel } from '@/components/dental/AppointmentMaterialsPanel';
import {
  billableTotal,
  type DentalMaterialUsage,
} from '@/lib/dental/dental-appointment-inventory';
import { AdvisorVisitInvoiceCard } from '@/components/advisors/AdvisorVisitInvoiceCard';
import {
  CLINIC_MOVEMENT_CATEGORIES,
  activeSharedMovements,
  type ClinicMovement,
} from '@/lib/clinic/clinic-movements';

type Tab =
  | 'notes'
  | 'script'
  | 'client'
  | 'movements'
  | 'invoice'
  | 'claim'
  | 'materials'
  | 'followup';

const ACCENT: Record<
  string,
  { border: string; soft: string; btn: string; tab: string }
> = {
  teal: {
    border: 'border-teal-200 dark:border-teal-800',
    soft: 'bg-teal-50/60 dark:bg-teal-950/30',
    btn: 'bg-teal-700 hover:bg-teal-800',
    tab: 'data-[on=true]:bg-teal-700 data-[on=true]:text-white',
  },
  sky: {
    border: 'border-sky-200 dark:border-sky-800',
    soft: 'bg-sky-50/60 dark:bg-sky-950/30',
    btn: 'bg-sky-700 hover:bg-sky-800',
    tab: 'data-[on=true]:bg-sky-700 data-[on=true]:text-white',
  },
  emerald: {
    border: 'border-emerald-200 dark:border-emerald-800',
    soft: 'bg-emerald-50/60 dark:bg-emerald-950/30',
    btn: 'bg-emerald-700 hover:bg-emerald-800',
    tab: 'data-[on=true]:bg-emerald-700 data-[on=true]:text-white',
  },
  violet: {
    border: 'border-violet-200 dark:border-violet-800',
    soft: 'bg-violet-50/60 dark:bg-violet-950/30',
    btn: 'bg-violet-700 hover:bg-violet-800',
    tab: 'data-[on=true]:bg-violet-700 data-[on=true]:text-white',
  },
};

const PATIENT_PATH: Record<ClinicClaimsModule, string> = {
  physiograph: '/dashboard/physiograph/patients',
  dentalgraph: '/dashboard/dentalgraph/patients',
  medicalgraph: '/dashboard/medicalgraph/patients',
  psychiatrygraph: '/dashboard/psychiatrygraph/patients',
};

export function ClinicAppointmentVisitDesk({
  module,
  companyId,
  appointmentId,
  date,
  startTime,
  serviceName,
  serviceId,
  servicePriceZar,
  treatingName,
  treatingId,
  patients,
  visitNotes,
  materials,
  movements,
  serviceCode,
  post,
  saving,
  accent = 'teal',
  onRefresh,
}: {
  module: ClinicClaimsModule & AdvisorAccountModule;
  companyId: number;
  appointmentId: string;
  date: string;
  startTime: string;
  serviceName?: string;
  serviceId?: string | null;
  servicePriceZar?: number | null;
  treatingName?: string;
  treatingId?: string | null;
  patients: AppointmentVisitPatient[];
  visitNotes?: VisitNote[];
  materials?: DentalMaterialUsage[];
  movements?: ClinicMovement[];
  serviceCode?: string | null;
  post: (body: Record<string, unknown>) => Promise<unknown>;
  saving?: boolean;
  accent?: 'teal' | 'sky' | 'emerald' | 'violet';
  onRefresh?: () => void;
}) {
  const skin = ACCENT[accent] || ACCENT.teal;
  const isPhysio = module === 'physiograph';
  const scriptNoun = isPhysio ? 'Rehab' : 'Script';
  const [tab, setTab] = useState<Tab>(
    module === 'dentalgraph' && patients.length === 0 ? 'materials' : 'notes'
  );
  const [patientId, setPatientId] = useState(patients[0]?.patientId || '');
  const [busy, setBusy] = useState(false);
  const [clientBody, setClientBody] = useState('');
  const [moveQuery, setMoveQuery] = useState('');
  const [moveCategory, setMoveCategory] = useState('');
  const [moveId, setMoveId] = useState('');
  const [moveDose, setMoveDose] = useState({
    sets: '3',
    reps: '10',
    hold: '',
    frequency: 'daily',
    notes: '',
  });

  useEffect(() => {
    if (!patients.some((p) => p.patientId === patientId)) {
      setPatientId(patients[0]?.patientId || '');
    }
  }, [patients, patientId]);

  const row = patients.find((p) => p.patientId === patientId) || null;
  const medical: PatientMedicalRecord | null = row?.medical || null;
  const notes = notesForVisit(visitNotes, {
    patientId,
    appointmentId,
    bookingId: row?.bookingId,
  });
  const scripts = (medical?.scripts || []).filter(
    (s) =>
      s.appointment_id === appointmentId ||
      (row?.bookingId && s.booking_id === row.bookingId)
  );
  const clientNotes = (row?.clientNotes || []).filter(
    (n) =>
      !n.appointment_id ||
      n.appointment_id === appointmentId ||
      (row?.bookingId && n.booking_id === row.bookingId)
  );
  const sharedMoves = activeSharedMovements(row?.sharedMovements);
  const catalog = (movements || []).filter((m) => m.active !== false);
  const moveCategoryOptions = useMemo(() => {
    const seen = new Set<string>(CLINIC_MOVEMENT_CATEGORIES);
    const extra: string[] = [];
    for (const m of catalog) {
      const cat = String(m.category || '').trim();
      if (!cat || seen.has(cat)) continue;
      seen.add(cat);
      extra.push(cat);
    }
    extra.sort((a, b) => a.localeCompare(b));
    return [...CLINIC_MOVEMENT_CATEGORIES, ...extra];
  }, [catalog]);
  const filteredMoves = useMemo(() => {
    const q = moveQuery.trim().toLowerCase();
    return catalog.filter((m) => {
      if (moveCategory && m.category !== moveCategory) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        String(m.category || '')
          .toLowerCase()
          .includes(q) ||
        String(m.overview || '')
          .toLowerCase()
          .includes(q) ||
        String(m.muscles || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [catalog, moveQuery, moveCategory]);
  const pickedMove = catalog.find((m) => m.id === moveId) || null;
  const claims = (medical?.claims || []).filter(
    (c) =>
      c.appointment_id === appointmentId ||
      (row?.bookingId && c.booking_id === row.bookingId)
  );
  const aid = medicalAidSummary(medical);

  const [noteBody, setNoteBody] = useState('');
  const [pain, setPain] = useState('');
  const [fn, setFn] = useState('');
  const [soapOn, setSoapOn] = useState(false);
  const [soap, setSoap] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });

  const [rx, setRx] = useState({
    medication: '',
    strength: '',
    dose: '',
    frequency: '',
    route: isPhysio ? 'home' : 'oral',
    duration: '',
    quantity: '',
    repeats: '0',
    instructions: '',
    diagnosis: '',
  });

  const [draftMaterials, setDraftMaterials] = useState<DentalMaterialUsage[]>(
    () => materials || []
  );
  useEffect(() => {
    setDraftMaterials(materials || []);
  }, [appointmentId, materials]);

  const materialsBillable = billableTotal(draftMaterials);
  const defaultAmount =
    (Number(servicePriceZar) || 0) + materialsBillable > 0
      ? String((Number(servicePriceZar) || 0) + materialsBillable)
      : '';
  const [claim, setClaim] = useState({
    amount_zar: defaultAmount,
    tariff_code: '',
    diagnosis_code: '',
    patient_portion: '',
    auth_number: medical?.medical_aid?.auth_number || '',
    notes: serviceName || '',
    email: '',
  });

  const addDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const [followUp, setFollowUp] = useState({
    title: 'Check-in after your visit',
    advice: 'Please check in with the practice — how are you feeling after this visit?',
    message: '',
    remind_on: addDays(7),
  });
  const visitFollowUps = (row?.followUps || []).filter(
    (f) =>
      !f.appointment_id ||
      f.appointment_id === appointmentId ||
      f.next_appointment_id
  );

  useEffect(() => {
    setNoteBody('');
    setPain('');
    setFn('');
    setSoap({ subjective: '', objective: '', assessment: '', plan: '' });
    setRx((r) => ({ ...r, medication: '', instructions: '' }));
    setClaim((c) => ({
      ...c,
      amount_zar: defaultAmount || c.amount_zar,
      notes: serviceName || c.notes,
      auth_number: medical?.medical_aid?.auth_number || c.auth_number,
    }));
    // Reset when the booked patient or slot changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, appointmentId]);

  const chartHref = row
    ? `${PATIENT_PATH[module]}/${encodeURIComponent(row.patientId)}?appointment=${encodeURIComponent(appointmentId)}&booking=${encodeURIComponent(row.bookingId)}${treatingId ? `&practitioner=${encodeURIComponent(treatingId)}` : ''}`
    : PATIENT_PATH[module];

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const saveNote = () =>
    run(async () => {
      if (!row) return;
      const body = noteBody.trim();
      if (!body) {
        toast.error('Write a visit note first');
        return;
      }
      await post({
        action: 'upsert_visit_note',
        person_id: row.patientId,
        patient_id: row.patientId,
        body,
        booking_id: row.bookingId,
        appointment_id: appointmentId,
        author_name: treatingName || undefined,
        private: true,
        pain_score: pain === '' ? null : Number(pain),
        function_score: fn === '' ? null : Number(fn),
        soap: soapOn
          ? {
              subjective: soap.subjective || undefined,
              objective: soap.objective || undefined,
              assessment: soap.assessment || undefined,
              plan: soap.plan || undefined,
            }
          : undefined,
      });
      toast.success('Practice note saved (not shown to the client)');
      setNoteBody('');
      onRefresh?.();
    });

  const saveScript = () =>
    run(async () => {
      if (!row) return;
      if (!rx.medication.trim()) {
        toast.error(
          isPhysio ? 'Rehab name is required' : 'Medication name is required'
        );
        return;
      }
      await post({
        action: 'medical_script_upsert',
        patient_id: row.patientId,
        script: {
          kind: isPhysio ? 'rehab' : 'prescription',
          medication: rx.medication.trim(),
          strength: rx.strength || undefined,
          dose: rx.dose || undefined,
          frequency: rx.frequency || undefined,
          route: rx.route || undefined,
          duration: rx.duration || undefined,
          quantity: rx.quantity || undefined,
          repeats: rx.repeats === '' ? 0 : Number(rx.repeats),
          instructions: rx.instructions || undefined,
          diagnosis: rx.diagnosis || undefined,
          prescribed_by: treatingName || undefined,
          practitioner_id: treatingId || null,
          appointment_id: appointmentId,
          booking_id: row.bookingId,
          prescribed_at: date || new Date().toISOString().slice(0, 10),
          status: 'active',
        },
      });
      toast.success(
        isPhysio
          ? 'Rehab saved to the client profile'
          : 'Script added to the patient record'
      );
      setRx((r) => ({ ...r, medication: '', instructions: '', dose: '' }));
      onRefresh?.();
    });

  const saveClientNote = () =>
    run(async () => {
      if (!row) return;
      if (!clientBody.trim()) {
        toast.error('Write a note for the client first');
        return;
      }
      await post({
        action: 'upsert_client_note',
        patient_id: row.patientId,
        body: clientBody.trim(),
        appointment_id: appointmentId,
        booking_id: row.bookingId,
        author_name: treatingName || undefined,
      });
      toast.success('Client note saved to their profile');
      setClientBody('');
      onRefresh?.();
    });

  const shareMovement = () =>
    run(async () => {
      if (!row) return;
      if (!moveId) {
        toast.error('Pick a movement to share');
        return;
      }
      await post({
        action: 'share_movement',
        patient_id: row.patientId,
        movement_id: moveId,
        sets: moveDose.sets || undefined,
        reps: moveDose.reps || undefined,
        hold: moveDose.hold || undefined,
        frequency: moveDose.frequency || undefined,
        notes: moveDose.notes || undefined,
        appointment_id: appointmentId,
        booking_id: row.bookingId,
        shared_by: treatingName || undefined,
      });
      toast.success('Movement shared to the client profile');
      setMoveDose((d) => ({ ...d, notes: '' }));
      onRefresh?.();
    });

  const allocateMaterials = () =>
    run(async () => {
      const data = (await post({
        action: 'allocate_materials',
        appointment_id: appointmentId,
        materials: draftMaterials,
      })) as {
        issue?: Array<{
          product_id: number;
          quantity: number;
          name: string;
          lot_number?: string | null;
        }>;
        message?: string;
      };
      const issue = data.issue || [];
      let issued = 0;
      for (const line of issue) {
        const res = await fetch('/api/inventory/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            productId: line.product_id,
            quantity: line.quantity,
            movement_type: 'issue',
            reference_type: 'dental_appointment',
            reference_id: appointmentId,
            notes: `Dental visit ${date} · ${line.name}`,
            lot_number: line.lot_number || undefined,
          }),
        });
        if (res.ok) issued += 1;
      }
      toast.success(
        issued > 0
          ? `${data.message || 'Materials allocated'} · ${issued} stock issue${issued === 1 ? '' : 's'}`
          : data.message || 'Materials allocated to this appointment'
      );
      onRefresh?.();
    });

  const saveClaim = (submit: boolean) =>
    run(async () => {
      if (!row) return;
      const amount = Number(claim.amount_zar);
      const claimId = `mclm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await post({
        action: 'medical_claim_upsert',
        patient_id: row.patientId,
        claim: {
          id: claimId,
          status: submit ? 'ready' : 'draft',
          service_date: date,
          amount_zar: Number.isFinite(amount) && amount > 0 ? amount : null,
          tariff_code: claim.tariff_code || undefined,
          diagnosis_code: claim.diagnosis_code || undefined,
          diagnosis_codes: claim.diagnosis_code
            ? claim.diagnosis_code.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
            : undefined,
          patient_portion: claim.patient_portion
            ? Number(claim.patient_portion)
            : undefined,
          auth_number: claim.auth_number || undefined,
          treating_name: treatingName || undefined,
          booking_id: row.bookingId,
          appointment_id: appointmentId,
          notes: claim.notes || serviceName || undefined,
        },
      });
      if (!submit) {
        toast.success('Medical-aid claim saved as draft');
        onRefresh?.();
        return;
      }
      const res = await fetch('/api/clinic/medical-aid-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          module,
          action: 'submit',
          patient_id: row.patientId,
          claim_id: claimId,
          email: claim.email || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      toast.success(data.message || 'Claim submitted to medical aid');
      onRefresh?.();
    });

  const saveFollowUp = (mode: 'schedule' | 'now' | 'book') =>
    run(async () => {
      if (!row) return;
      const data = (await post({
        action: mode === 'book' ? 'book_follow_up' : 'upsert_follow_up',
        patient_id: row.patientId,
        send_now: mode === 'now',
        book_next: mode === 'book',
        notify_parties: true,
        author_name: treatingName || undefined,
        follow_up: {
          title: followUp.title.trim() || 'Check-in after your visit',
          advice:
            followUp.advice.trim() ||
            'Please check in with the practice after this visit.',
          message: followUp.message.trim() || undefined,
          remind_on: followUp.remind_on,
          appointment_id: appointmentId,
          service_id: serviceId || undefined,
        },
      })) as { message?: string; appointment_id?: string };
      toast.success(
        data.message ||
          (mode === 'book'
            ? 'Follow-up appointment booked'
            : 'Check-in saved')
      );
      onRefresh?.();
    });

  const tabs: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
    { id: 'notes', label: 'Notes', icon: Stethoscope },
    { id: 'script', label: scriptNoun, icon: isPhysio ? Activity : Pill },
    { id: 'client', label: 'Client note', icon: StickyNote },
    ...(isPhysio
      ? [{ id: 'movements' as const, label: 'Movements', icon: Activity }]
      : []),
    ...(module === 'dentalgraph'
      ? [{ id: 'materials' as const, label: 'Inventory', icon: Package }]
      : []),
    { id: 'invoice', label: 'Invoice', icon: Receipt },
    { id: 'claim', label: 'Claim', icon: Send },
    { id: 'followup', label: 'Follow-up', icon: Bell },
  ];

  const inp =
    'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';

  if (patients.length === 0 && module !== 'dentalgraph') {
    return (
      <div
        className={`mt-4 rounded-2xl border ${skin.border} ${skin.soft} px-4 py-3 text-[12px] text-slate-600 dark:text-slate-300`}
      >
        Book a patient onto this appointment to complete practice notes, write
        a {scriptNoun.toLowerCase()}, add a client note
        {isPhysio ? ', share movements' : ''}, send an invoice, submit a
        medical-aid claim, or schedule a follow-up.
      </div>
    );
  }

  return (
    <section
      className={`mt-4 rounded-2xl border ${skin.border} bg-white dark:bg-neutral-950`}
    >
      <div className={`flex flex-wrap items-start justify-between gap-2 border-b ${skin.border} px-4 py-3 ${skin.soft}`}>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Visit desk
          </p>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {row?.familyMemberName
              ? `${row.familyMemberName} · ${row.name}`
              : row?.name ||
                (module === 'dentalgraph' ? 'This visit' : 'Patient')}
          </p>
          <p className="text-[11px] text-slate-500">
            {date} {String(startTime || '').slice(0, 5)}
            {serviceName ? ` · ${serviceName}` : ''}
            {treatingName ? ` · ${treatingName}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {patients.length > 1 ? (
            <select
              className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-900"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              {patients.map((p) => (
                <option key={p.bookingId} value={p.patientId}>
                  {p.familyMemberName || p.name}
                </option>
              ))}
            </select>
          ) : null}
          <Link
            href={chartHref}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold dark:border-slate-700"
          >
            Full chart
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 px-3 pt-3">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              data-on={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-black dark:border-slate-700 ${skin.tab}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 p-4">
        {tab === 'notes' ? (
          <>
            {!row ? (
              <p className="text-[12px] text-slate-500">
                Book a patient onto this slot to save a visit note.
              </p>
            ) : null}
            {notes.length > 0 ? (
              <ul className="space-y-1.5">
                {notes.slice(0, 4).map((n) => (
                  <li
                    key={n.id}
                    className="rounded-xl border border-slate-100 px-3 py-2 text-[12px] dark:border-slate-800"
                  >
                    <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {String(n.created_at).slice(0, 16).replace('T', ' ')}
                      {n.pain_score != null ? ` · pain ${n.pain_score}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-slate-500">
                No practice notes on this visit yet.
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              Practice only — these notes stay with the clinician and are not
              shown on the client PWA.
            </p>
            <textarea
              className={inp + ' min-h-[88px]'}
              placeholder="Clinical / visit note for this appointment (not shared with the client)…"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400">
                Pain 0–10
                <input
                  className={inp + ' mt-0.5'}
                  type="number"
                  min={0}
                  max={10}
                  value={pain}
                  onChange={(e) => setPain(e.target.value)}
                />
              </label>
              <label className="text-[10px] font-black uppercase text-slate-400">
                Function 0–10
                <input
                  className={inp + ' mt-0.5'}
                  type="number"
                  min={0}
                  max={10}
                  value={fn}
                  onChange={(e) => setFn(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="text-[11px] font-bold text-slate-500 underline"
              onClick={() => setSoapOn((v) => !v)}
            >
              {soapOn ? 'Hide SOAP' : 'Add SOAP headings'}
            </button>
            {soapOn ? (
              <div className="grid sm:grid-cols-2 gap-2">
                {(
                  [
                    ['subjective', 'Subjective'],
                    ['objective', 'Objective'],
                    ['assessment', 'Assessment'],
                    ['plan', 'Plan'],
                  ] as const
                ).map(([k, label]) => (
                  <textarea
                    key={k}
                    className={inp + ' min-h-[56px]'}
                    placeholder={label}
                    value={soap[k]}
                    onChange={(e) =>
                      setSoap((s) => ({ ...s, [k]: e.target.value }))
                    }
                  />
                ))}
              </div>
            ) : null}
            <DeskBtn
              busy={busy || saving}
              className={skin.btn}
              onClick={() => void saveNote()}
              icon={FileText}
              label="Save practice note"
            />
          </>
        ) : null}

        {tab === 'script' ? (
          <>
            <p className="text-[11px] text-slate-500">
              Shared with the client on their PWA profile.
            </p>
            {scripts.length > 0 ? (
              <ul className="space-y-1 text-[12px]">
                {scripts.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800"
                  >
                    <strong>{s.medication}</strong>
                    {s.strength ? ` ${s.strength}` : ''}
                    {s.dose ? ` · ${s.dose}` : ''}
                    {s.frequency ? ` · ${s.frequency}` : ''}
                    {s.instructions ? (
                      <p className="text-slate-500">{s.instructions}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-slate-500">
                No {scriptNoun.toLowerCase()} on this visit yet.
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                className={inp + ' sm:col-span-2'}
                placeholder={
                  isPhysio ? 'Rehab programme / exercise *' : 'Medication *'
                }
                value={rx.medication}
                onChange={(e) =>
                  setRx((r) => ({ ...r, medication: e.target.value }))
                }
              />
              <input
                className={inp}
                placeholder={
                  isPhysio ? 'Sets / hold (e.g. 3×10 or 30s)' : 'Strength (e.g. 500 mg)'
                }
                value={rx.strength}
                onChange={(e) =>
                  setRx((r) => ({ ...r, strength: e.target.value }))
                }
              />
              <input
                className={inp}
                placeholder={isPhysio ? 'Reps or load' : 'Dose'}
                value={rx.dose}
                onChange={(e) => setRx((r) => ({ ...r, dose: e.target.value }))}
              />
              <input
                className={inp}
                placeholder={
                  isPhysio ? 'Frequency (e.g. 2× daily)' : 'Frequency (e.g. 8 hourly)'
                }
                value={rx.frequency}
                onChange={(e) =>
                  setRx((r) => ({ ...r, frequency: e.target.value }))
                }
              />
              {isPhysio ? (
                <select
                  className={inp}
                  value={rx.route}
                  onChange={(e) =>
                    setRx((r) => ({ ...r, route: e.target.value }))
                  }
                >
                  <option value="home">Where · home</option>
                  <option value="clinic">Where · clinic</option>
                  <option value="both">Where · home and clinic</option>
                  <option value="other">Where · other</option>
                </select>
              ) : (
                <select
                  className={inp}
                  value={rx.route}
                  onChange={(e) =>
                    setRx((r) => ({ ...r, route: e.target.value }))
                  }
                >
                  {SCRIPT_ROUTES.map((r) => (
                    <option key={r} value={r}>
                      Route: {r}
                    </option>
                  ))}
                </select>
              )}
              <input
                className={inp}
                placeholder={isPhysio ? 'Duration (e.g. 4 weeks)' : 'Duration'}
                value={rx.duration}
                onChange={(e) =>
                  setRx((r) => ({ ...r, duration: e.target.value }))
                }
              />
              {!isPhysio ? (
                <>
                  <input
                    className={inp}
                    placeholder="Quantity"
                    value={rx.quantity}
                    onChange={(e) =>
                      setRx((r) => ({ ...r, quantity: e.target.value }))
                    }
                  />
                  <input
                    className={inp}
                    type="number"
                    min={0}
                    placeholder="Repeats"
                    value={rx.repeats}
                    onChange={(e) =>
                      setRx((r) => ({ ...r, repeats: e.target.value }))
                    }
                  />
                </>
              ) : null}
              <input
                className={inp + ' sm:col-span-2'}
                placeholder={
                  isPhysio
                    ? 'Instructions for the client (they will see this)'
                    : 'Directions for the patient'
                }
                value={rx.instructions}
                onChange={(e) =>
                  setRx((r) => ({ ...r, instructions: e.target.value }))
                }
              />
              <input
                className={inp + ' sm:col-span-2'}
                placeholder={
                  isPhysio
                    ? 'Region / diagnosis (optional)'
                    : 'Diagnosis (optional)'
                }
                value={rx.diagnosis}
                onChange={(e) =>
                  setRx((r) => ({ ...r, diagnosis: e.target.value }))
                }
              />
            </div>
            <DeskBtn
              busy={busy || saving}
              className={skin.btn}
              onClick={() => void saveScript()}
              icon={isPhysio ? Activity : Pill}
              label={isPhysio ? 'Save rehab for client' : 'Add script'}
            />
          </>
        ) : null}

        {tab === 'client' ? (
          <>
            <p className="text-[11px] text-slate-500">
              Saved to the client’s profile and shown on their PWA.
            </p>
            {clientNotes.length > 0 ? (
              <ul className="space-y-1.5">
                {clientNotes.slice(0, 6).map((n) => (
                  <li
                    key={n.id}
                    className="rounded-xl border border-slate-100 px-3 py-2 text-[12px] dark:border-slate-800"
                  >
                    <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {String(n.created_at).slice(0, 16).replace('T', ' ')}
                      {n.author_name ? ` · ${n.author_name}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-slate-500">
                No client notes on this visit yet.
              </p>
            )}
            <textarea
              className={inp + ' min-h-[88px]'}
              placeholder="Note for the client — home advice, what to watch, when to rest…"
              value={clientBody}
              onChange={(e) => setClientBody(e.target.value)}
            />
            <DeskBtn
              busy={busy || saving}
              className={skin.btn}
              onClick={() => void saveClientNote()}
              icon={StickyNote}
              label="Save to client profile"
            />
          </>
        ) : null}

        {tab === 'movements' ? (
          <>
            <p className="text-[11px] text-slate-500">
              Pick from the Floor movement library and send it to this client’s
              profile. They see it on the PWA.
            </p>
            {sharedMoves.length > 0 ? (
              <ul className="space-y-1 text-[12px]">
                {sharedMoves.slice(0, 8).map((m) => (
                  <li
                    key={m.id}
                    className="rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800"
                  >
                    <strong>{m.movement_name}</strong>
                    {[m.sets && `${m.sets} sets`, m.reps && `${m.reps} reps`, m.hold, m.frequency]
                      .filter(Boolean)
                      .length ? (
                      <span className="text-slate-500">
                        {' · '}
                        {[
                          m.sets && `${m.sets} sets`,
                          m.reps && `${m.reps} reps`,
                          m.hold,
                          m.frequency,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    ) : null}
                    {m.notes ? (
                      <p className="text-slate-500">{m.notes}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-slate-500">
                No movements shared with this client yet.
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                className={inp}
                placeholder="Search movements…"
                value={moveQuery}
                onChange={(e) => setMoveQuery(e.target.value)}
              />
              <select
                className={inp}
                value={moveCategory}
                onChange={(e) => setMoveCategory(e.target.value)}
              >
                <option value="">All regions / patterns</option>
                {moveCategoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className={inp + ' sm:col-span-2'}
                value={moveId}
                onChange={(e) => setMoveId(e.target.value)}
              >
                <option value="">
                  {filteredMoves.length
                    ? `Select a movement (${filteredMoves.length})`
                    : 'Select a movement'}
                </option>
                {filteredMoves
                  .slice(0, moveQuery.trim() || moveCategory ? 500 : 160)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.category} · {m.name}
                    </option>
                  ))}
              </select>
            </div>
            {pickedMove ? (
              <p className="text-[12px] text-slate-600 dark:text-slate-300">
                {pickedMove.overview || pickedMove.details}
              </p>
            ) : null}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input
                className={inp}
                placeholder="Sets"
                value={moveDose.sets}
                onChange={(e) =>
                  setMoveDose((d) => ({ ...d, sets: e.target.value }))
                }
              />
              <input
                className={inp}
                placeholder="Reps"
                value={moveDose.reps}
                onChange={(e) =>
                  setMoveDose((d) => ({ ...d, reps: e.target.value }))
                }
              />
              <input
                className={inp}
                placeholder="Hold"
                value={moveDose.hold}
                onChange={(e) =>
                  setMoveDose((d) => ({ ...d, hold: e.target.value }))
                }
              />
              <input
                className={inp}
                placeholder="Frequency"
                value={moveDose.frequency}
                onChange={(e) =>
                  setMoveDose((d) => ({ ...d, frequency: e.target.value }))
                }
              />
            </div>
            <input
              className={inp}
              placeholder="Note for this movement (optional)"
              value={moveDose.notes}
              onChange={(e) =>
                setMoveDose((d) => ({ ...d, notes: e.target.value }))
              }
            />
            <div className="flex flex-wrap gap-2">
              <DeskBtn
                busy={busy || saving}
                className={skin.btn}
                onClick={() => void shareMovement()}
                icon={Send}
                label="Share with client"
              />
              <Link
                href="/dashboard/physiograph/movements"
                className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-bold dark:border-slate-700"
              >
                Open movement library
              </Link>
            </div>
          </>
        ) : null}

        {tab === 'materials' ? (
          <>
            <p className="text-[12px] text-slate-500">
              After the visit, allocate what you used from inventory. Billable
              lines add to the invoice on the next tab.
            </p>
            <AppointmentMaterialsPanel
              value={draftMaterials}
              onChange={setDraftMaterials}
              serviceName={serviceName}
              serviceCode={serviceCode}
              autoDefaults={false}
              compact
            />
            <DeskBtn
              busy={busy || saving}
              className={skin.btn}
              onClick={() => void allocateMaterials()}
              icon={Package}
              label="Allocate to appointment"
            />
          </>
        ) : null}

        {tab === 'invoice' ? (
          row ? (
            <AdvisorVisitInvoiceCard
              companyId={companyId}
              module={module}
              refId={row.patientId}
              memberName={row.familyMemberName || row.name}
              memberEmail={row.email}
              description={`${serviceName || 'Visit'} · ${date}${
                materialsBillable > 0
                  ? ` · materials ${formatZar(materialsBillable)}`
                  : ''
              }`}
              amountZar={
                (Number(servicePriceZar) || 0) + materialsBillable
              }
              dueDate={date}
              sourceId={`visit:${row.bookingId}`}
              accountsHref={`/dashboard/${module}/accounts`}
              btnClass={skin.btn}
            />
          ) : (
            <p className="text-[12px] text-slate-500">
              Book a patient onto this slot to send an invoice.
            </p>
          )
        ) : null}

        {tab === 'claim' ? (
          <>
            <p className="text-[12px] text-slate-600">
              {aid}
              {medical?.medical_aid?.membership_number
                ? ''
                : ' — add scheme details on the patient chart if needed.'}
            </p>
            {claims.length > 0 ? (
              <ul className="space-y-1 text-[12px]">
                {claims.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800"
                  >
                    <span>
                      {c.claim_number || c.id.slice(0, 8)} ·{' '}
                      {claimStatusLabel(c.status)}
                      {c.amount_zar != null
                        ? ` · ${formatZar(c.amount_zar)}`
                        : ''}
                    </span>
                    <a
                      href={`/api/clinic/medical-aid-claims/pack?companyId=${companyId}&module=${module}&patientId=${encodeURIComponent(patientId)}&claimId=${encodeURIComponent(c.id)}`}
                      className="font-bold underline"
                    >
                      Pack
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400">
                Amount (ZAR)
                <input
                  className={inp + ' mt-0.5'}
                  type="number"
                  min={0}
                  step="0.01"
                  value={claim.amount_zar}
                  onChange={(e) =>
                    setClaim((c) => ({ ...c, amount_zar: e.target.value }))
                  }
                />
              </label>
              <input
                className={inp}
                placeholder="Tariff / NHRPL code"
                value={claim.tariff_code}
                onChange={(e) =>
                  setClaim((c) => ({ ...c, tariff_code: e.target.value }))
                }
              />
              <input
                className={inp}
                placeholder="ICD-10 (e.g. J06.9)"
                value={claim.diagnosis_code}
                onChange={(e) =>
                  setClaim((c) => ({ ...c, diagnosis_code: e.target.value }))
                }
              />
              <input
                className={inp}
                placeholder="Patient co-pay (ZAR)"
                type="number"
                min={0}
                step="0.01"
                value={claim.patient_portion}
                onChange={(e) =>
                  setClaim((c) => ({ ...c, patient_portion: e.target.value }))
                }
              />
              <input
                className={inp}
                placeholder="Auth number"
                value={claim.auth_number}
                onChange={(e) =>
                  setClaim((c) => ({ ...c, auth_number: e.target.value }))
                }
              />
              <input
                className={inp + ' sm:col-span-2'}
                placeholder="Claim notes / service"
                value={claim.notes}
                onChange={(e) =>
                  setClaim((c) => ({ ...c, notes: e.target.value }))
                }
              />
              <input
                className={inp + ' sm:col-span-2'}
                placeholder="Email pack to scheme (optional)"
                value={claim.email}
                onChange={(e) =>
                  setClaim((c) => ({ ...c, email: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <DeskBtn
                busy={busy || saving}
                className="bg-slate-800 hover:bg-slate-900"
                onClick={() => void saveClaim(false)}
                icon={FileText}
                label="Save draft"
              />
              <DeskBtn
                busy={busy || saving}
                className={skin.btn}
                onClick={() => void saveClaim(true)}
                icon={Send}
                label="Submit to medical aid"
              />
            </div>
          </>
        ) : null}

        {tab === 'followup' ? (
          <>
            {!row ? (
              <p className="text-[12px] text-slate-500">
                Book a patient onto this slot to schedule a check-in.
              </p>
            ) : null}
            <p className="text-[12px] text-slate-600">
              Reminds the practice desk and the member PWA to check in. Book the
              next open diary slot, or send a notification now.
            </p>
            {visitFollowUps.length > 0 ? (
              <ul className="space-y-1.5">
                {visitFollowUps.slice(0, 5).map((f) => (
                  <li
                    key={f.id}
                    className="rounded-xl border border-slate-100 px-3 py-2 text-[12px] dark:border-slate-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {f.title || 'Check-in'} · {f.remind_on}
                      </span>
                      <span className="text-[10px] font-black uppercase text-slate-400">
                        {f.status}
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-slate-600">
                      {f.advice}
                    </p>
                    {f.next_appointment_id ? (
                      <p className="mt-0.5 text-[10px] font-bold text-emerald-700">
                        Follow-up slot booked
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-slate-500">
                No follow-up on this visit yet.
              </p>
            )}
            <input
              className={inp}
              placeholder="Title (e.g. Wound check / how are you feeling)"
              value={followUp.title}
              onChange={(e) =>
                setFollowUp((f) => ({ ...f, title: e.target.value }))
              }
            />
            <textarea
              className={inp + ' min-h-[72px]'}
              placeholder="What both of you should check at the follow-up…"
              value={followUp.advice}
              onChange={(e) =>
                setFollowUp((f) => ({ ...f, advice: e.target.value }))
              }
            />
            <textarea
              className={inp + ' min-h-[52px]'}
              placeholder="Optional extra message on the member PWA"
              value={followUp.message}
              onChange={(e) =>
                setFollowUp((f) => ({ ...f, message: e.target.value }))
              }
            />
            <label className="block text-[10px] font-black uppercase text-slate-400">
              Remind / book from
              <input
                className={inp + ' mt-0.5'}
                type="date"
                value={followUp.remind_on}
                onChange={(e) =>
                  setFollowUp((f) => ({ ...f, remind_on: e.target.value }))
                }
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                [3, '3 days'],
                [7, '1 week'],
                [14, '2 weeks'],
                [28, '1 month'],
              ].map(([n, label]) => (
                <button
                  key={String(n)}
                  type="button"
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold dark:border-slate-700"
                  onClick={() =>
                    setFollowUp((f) => ({ ...f, remind_on: addDays(Number(n)) }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <DeskBtn
                busy={busy || saving}
                className="bg-slate-800 hover:bg-slate-900"
                onClick={() => void saveFollowUp('schedule')}
                icon={Bell}
                label="Schedule check-in"
              />
              <DeskBtn
                busy={busy || saving}
                className={skin.btn}
                onClick={() => void saveFollowUp('now')}
                icon={Send}
                label="Notify both now"
              />
              <DeskBtn
                busy={busy || saving}
                className="bg-emerald-700 hover:bg-emerald-800"
                onClick={() => void saveFollowUp('book')}
                icon={CalendarPlus}
                label="Book next open slot"
              />
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function DeskBtn({
  busy,
  className,
  onClick,
  icon: Icon,
  label,
}: {
  busy?: boolean;
  className: string;
  onClick: () => void;
  icon: typeof FileText;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-white disabled:opacity-50 ${className}`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}
