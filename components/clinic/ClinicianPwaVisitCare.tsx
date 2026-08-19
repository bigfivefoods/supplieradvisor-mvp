'use client';

import { useMemo, useState } from 'react';
import { Activity, FileText, Loader2, StickyNote } from 'lucide-react';
import type { VisitNote } from '@/lib/services/advisor-clinical';
import type { PatientMedicalRecord } from '@/lib/clinic/patient-medical';
import {
  listedClinicMovements,
  type ClinicMovement,
  type PatientClientNote,
  type PatientMovementShare,
} from '@/lib/clinic/clinic-movements';

type PatientLite = {
  id: string;
  name: string;
  medical?: PatientMedicalRecord | null;
  client_notes?: PatientClientNote[];
  shared_movements?: PatientMovementShare[];
};

type RosterLite = {
  booking_id: string;
  patient_id: string;
  name: string;
};

export function ClinicianPwaVisitCare({
  module,
  appointmentId,
  clinicianName,
  roster,
  patients,
  visitNotes,
  movements,
  busy,
  post,
}: {
  module: string;
  appointmentId: string;
  clinicianName: string;
  roster: RosterLite[];
  patients: PatientLite[];
  visitNotes?: VisitNote[];
  movements?: ClinicMovement[];
  busy?: boolean;
  post: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const isPhysio = module === 'physiograph';
  const scriptNoun = isPhysio ? 'Rehab' : 'Script';
  const [tab, setTab] = useState<'notes' | 'script' | 'client' | 'movements'>(
    'notes'
  );
  const [patientId, setPatientId] = useState(roster[0]?.patient_id || '');
  const row = roster.find((r) => r.patient_id === patientId) || roster[0];
  const patient =
    patients.find((p) => p.id === (row?.patient_id || patientId)) || null;

  const notes = (visitNotes || []).filter(
    (n) =>
      n.person_id === patient?.id &&
      (n.appointment_id === appointmentId ||
        n.booking_id === row?.booking_id)
  );
  const scripts = (patient?.medical?.scripts || []).filter(
    (s) =>
      s.appointment_id === appointmentId || s.booking_id === row?.booking_id
  );
  const clientNotes = (patient?.client_notes || []).filter(
    (n) =>
      !n.appointment_id ||
      n.appointment_id === appointmentId ||
      n.booking_id === row?.booking_id
  );
  const shared = (patient?.shared_movements || []).filter(
    (m) => m.status !== 'stopped'
  );
  const catalog = useMemo(
    () => listedClinicMovements({ movements }),
    [movements]
  );
  const [noteBody, setNoteBody] = useState('');
  const [clientBody, setClientBody] = useState('');
  const [rxName, setRxName] = useState('');
  const [rxHow, setRxHow] = useState('');
  const [moveId, setMoveId] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');

  if (!roster.length) {
    return (
      <p className="text-[11px] text-slate-500">
        Book a patient onto this appointment to write notes, {scriptNoun.toLowerCase()}
        {isPhysio ? ', and share movements' : ''} — saved on their profile.
      </p>
    );
  }

  const inp =
    'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm';

  return (
    <div className="space-y-2 border-t border-slate-800 pt-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-sky-400">
        Care for this visit · saved on the client profile
      </p>
      {roster.length > 1 ? (
        <select
          className={inp}
          value={row?.patient_id || ''}
          onChange={(e) => setPatientId(e.target.value)}
        >
          {roster.map((r) => (
            <option key={r.booking_id} value={r.patient_id}>
              {r.name}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-xs font-bold text-slate-200">{row?.name}</p>
      )}
      <div className="flex flex-wrap gap-1">
        {(
          [
            ['notes', 'Notes', FileText],
            ['script', scriptNoun, Activity],
            ['client', 'Client', StickyNote],
            ...(isPhysio ? ([['movements', 'Movements', Activity]] as const) : []),
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${
              tab === id
                ? 'bg-sky-500 text-sky-950'
                : 'border border-slate-600 text-slate-300'
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'notes' ? (
        <div className="space-y-2">
          <textarea
            className={`${inp} min-h-[4.5rem]`}
            placeholder="Practice note (private to the chart)"
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !noteBody.trim()}
            className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-black text-sky-950 disabled:opacity-50"
            onClick={() =>
              void post({
                action: 'upsert_visit_note',
                patient_id: row.patient_id,
                booking_id: row.booking_id,
                appointment_id: appointmentId,
                body: noteBody,
                author_name: clinicianName,
              }).then(() => setNoteBody(''))
            }
          >
            {busy ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : null}{' '}
            Save practice note
          </button>
          {notes.slice(0, 3).map((n) => (
            <p key={n.id} className="text-[11px] text-slate-400">
              {n.body}
            </p>
          ))}
        </div>
      ) : null}

      {tab === 'script' ? (
        <div className="space-y-2">
          <input
            className={inp}
            placeholder={isPhysio ? 'Rehab name' : 'Medication'}
            value={rxName}
            onChange={(e) => setRxName(e.target.value)}
          />
          <textarea
            className={`${inp} min-h-[3.5rem]`}
            placeholder={
              isPhysio ? 'How to do it · dose · frequency' : 'Dose, frequency, instructions'
            }
            value={rxHow}
            onChange={(e) => setRxHow(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !rxName.trim()}
            className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-black text-sky-950 disabled:opacity-50"
            onClick={() =>
              void post({
                action: 'medical_script_upsert',
                patient_id: row.patient_id,
                appointment_id: appointmentId,
                booking_id: row.booking_id,
                script: {
                  kind: isPhysio ? 'rehab' : 'prescription',
                  medication: rxName.trim(),
                  instructions: rxHow.trim() || undefined,
                  prescribed_by: clinicianName,
                },
              }).then(() => {
                setRxName('');
                setRxHow('');
              })
            }
          >
            Save {scriptNoun.toLowerCase()} to profile
          </button>
          {scripts.slice(0, 3).map((s) => (
            <p key={s.id} className="text-[11px] text-slate-400">
              {s.medication}
              {s.instructions ? ` — ${s.instructions}` : ''}
            </p>
          ))}
        </div>
      ) : null}

      {tab === 'client' ? (
        <div className="space-y-2">
          <textarea
            className={`${inp} min-h-[4rem]`}
            placeholder="Note the client will see on their PWA"
            value={clientBody}
            onChange={(e) => setClientBody(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !clientBody.trim()}
            className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-black text-sky-950 disabled:opacity-50"
            onClick={() =>
              void post({
                action: 'upsert_client_note',
                patient_id: row.patient_id,
                booking_id: row.booking_id,
                appointment_id: appointmentId,
                body: clientBody,
                author_name: clinicianName,
              }).then(() => setClientBody(''))
            }
          >
            Save client note
          </button>
          {clientNotes.slice(0, 3).map((n) => (
            <p key={n.id} className="text-[11px] text-slate-400">
              {n.body}
            </p>
          ))}
        </div>
      ) : null}

      {tab === 'movements' && isPhysio ? (
        <div className="space-y-2">
          <select
            className={inp}
            value={moveId}
            onChange={(e) => setMoveId(e.target.value)}
          >
            <option value="">Movement…</option>
            {catalog.slice(0, 80).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.category ? ` · ${m.category}` : ''}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inp}
              placeholder="Sets"
              value={sets}
              onChange={(e) => setSets(e.target.value)}
            />
            <input
              className={inp}
              placeholder="Reps"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={busy || !moveId}
            className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-black text-sky-950 disabled:opacity-50"
            onClick={() =>
              void post({
                action: 'share_movement',
                patient_id: row.patient_id,
                booking_id: row.booking_id,
                appointment_id: appointmentId,
                movement_id: moveId,
                sets,
                reps,
              })
            }
          >
            Share movement to client
          </button>
          {shared.slice(0, 4).map((m) => (
            <p key={m.id} className="text-[11px] text-slate-400">
              {m.movement_name}
              {m.sets ? ` · ${m.sets}×${m.reps || ''}` : ''}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
