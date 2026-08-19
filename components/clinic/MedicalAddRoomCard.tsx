'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { fc } from '@/components/clinic/MedicalForm';
import { clinicRoomNames } from '@/lib/clinic/clinic-rooms';

type Props = {
  rooms?: unknown;
  saving?: boolean;
  onAdd: (name: string) => Promise<void>;
};

export function MedicalAddRoomCard({ rooms, saving, onAdd }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const listed = clinicRoomNames(rooms);

  const submit = async () => {
    const n = name.trim();
    if (!n) {
      toast.error('Room name required');
      return;
    }
    setBusy(true);
    try {
      await onAdd(n);
      setName('');
      toast.success(`Room “${n}” added`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not add room');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-emerald-50">
            Clinic rooms
          </p>
          <p className="text-[12px] text-slate-600 dark:text-emerald-100/80">
            Add consult rooms and surgeries. The diary uses these names when you
            schedule.
          </p>
        </div>
        <Link
          href="/dashboard/medicalgraph/rooms"
          className="text-[11px] font-bold text-emerald-800 underline dark:text-emerald-300"
        >
          Open Rooms desk
        </Link>
      </div>
      {listed.length ? (
        <p className="text-[12px] text-slate-600 dark:text-emerald-100/80 mb-2">
          {listed.join(' · ')}
        </p>
      ) : (
        <p className="text-[12px] text-slate-500 mb-2">
          No rooms yet — add Surgery 1 or Consult 2.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          className={fc() + ' flex-1 min-w-[160px]'}
          placeholder="New room name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <button
          type="button"
          disabled={busy || saving}
          onClick={() => void submit()}
          className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add room
        </button>
      </div>
    </div>
  );
}
