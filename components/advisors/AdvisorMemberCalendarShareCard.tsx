'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';

export function AdvisorMemberCalendarShareCard({
  shareMemberCalendar,
  generateMemberSlots,
  requireAcceptJoin,
  memberSlotMinutes,
  saving,
  onSave,
}: {
  shareMemberCalendar: boolean;
  generateMemberSlots: boolean;
  requireAcceptJoin: boolean;
  memberSlotMinutes?: number | null;
  saving?: boolean;
  onSave: (patch: {
    share_member_calendar: boolean;
    generate_member_slots: boolean;
    require_accept_join: boolean;
    member_slot_minutes: number | null;
  }) => Promise<void>;
}) {
  const [share, setShare] = useState(shareMemberCalendar);
  const [generate, setGenerate] = useState(generateMemberSlots);
  const [accept, setAccept] = useState(requireAcceptJoin);
  const [mins, setMins] = useState(
    memberSlotMinutes != null ? String(memberSlotMinutes) : ''
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const n = Number(mins);
      await onSave({
        share_member_calendar: share,
        generate_member_slots: generate,
        require_accept_join: accept,
        member_slot_minutes: Number.isFinite(n) && n >= 15 ? n : null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-indigo-100 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-black text-slate-900">
        <CalendarDays className="h-4 w-4 text-indigo-600" />
        Share diary with SA Member
      </p>
      <p className="mt-1 text-[12px] text-slate-500">
        Patients on the PWA see your working hours (minus personal time and
        existing appointments) and book. You get a join notice when they link.
      </p>
      <div className="mt-3 space-y-2 text-sm font-medium">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={share}
            onChange={(e) => setShare(e.target.checked)}
          />
          Share bookable diary with SA Member patients
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={generate}
            onChange={(e) => setGenerate(e.target.checked)}
            disabled={!share}
          />
          Open slots from working hours (not only hand-created public slots)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
          />
          Accept new members before they can book
        </label>
        <label className="block text-xs font-bold">
          Slot length (minutes)
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={mins}
            onChange={(e) => setMins(e.target.value)}
            placeholder="Uses the first consult service"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={busy || saving}
        onClick={() => void save()}
        className="mt-3 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
      >
        {busy || saving ? 'Saving…' : 'Save diary share'}
      </button>
    </div>
  );
}
