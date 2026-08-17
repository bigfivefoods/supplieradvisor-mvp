'use client';

import {
  APPOINTMENT_KIND_OPTIONS,
  PERSONAL_REASON_OPTIONS,
  type ClinicAppointmentKind,
  type ClinicPersonalReason,
} from '@/lib/clinic/appointment-kind';

export function ClinicDiaryKindFields({
  kind,
  reason,
  notes,
  endTime,
  onKind,
  onReason,
  onNotes,
  onEndTime,
  inputClass,
  peopleWord = 'clinician',
}: {
  kind: ClinicAppointmentKind;
  reason: ClinicPersonalReason | string;
  notes: string;
  endTime: string;
  onKind: (kind: ClinicAppointmentKind) => void;
  onReason: (reason: ClinicPersonalReason) => void;
  onNotes: (notes: string) => void;
  onEndTime: (end: string) => void;
  inputClass: string;
  peopleWord?: string;
}) {
  return (
    <>
      <select
        className={inputClass}
        value={kind}
        onChange={(e) => onKind(e.target.value as ClinicAppointmentKind)}
      >
        {APPOINTMENT_KIND_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {kind === 'personal' ? (
        <>
          <select
            className={inputClass}
            value={reason || 'personal'}
            onChange={(e) =>
              onReason(e.target.value as ClinicPersonalReason)
            }
          >
            {PERSONAL_REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            type="time"
            value={endTime}
            onChange={(e) => onEndTime(e.target.value)}
            title="End time"
          />
          <input
            className={inputClass}
            placeholder="Note (optional)"
            value={notes}
            onChange={(e) => onNotes(e.target.value)}
          />
          <p className="sm:col-span-2 lg:col-span-3 text-[11px] text-slate-500">
            Blocks this {peopleWord} so nobody can double-book them. Leave
            across several days: set Repeat to daily until the last day off.
          </p>
        </>
      ) : null}
    </>
  );
}
