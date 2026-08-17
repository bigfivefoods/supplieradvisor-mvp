'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, UserPlus, X } from 'lucide-react';
import type { DeskMemberNotice } from '@/lib/services/advisor-member-calendar';

export function AdvisorMemberJoinInbox({
  companyId,
  module,
  patientsHref,
}: {
  companyId: number | null;
  module: string;
  patientsHref: string;
}) {
  const [notices, setNotices] = useState<DeskMemberNotice[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    const res = await fetch(
      `/api/advisor/member-inbox?companyId=${companyId}&module=${encodeURIComponent(module)}`,
      { cache: 'no-store' }
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setNotices(Array.isArray(data.open) ? data.open : []);
    }
  }, [companyId, module]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: 'accepted' | 'dismissed' | 'seen') => {
    if (!companyId) return;
    setBusyId(id);
    try {
      const res = await fetch('/api/advisor/member-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, module, id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setNotices(Array.isArray(data.open) ? data.open : []);
    } finally {
      setBusyId(null);
    }
  };

  if (!notices.length) return null;

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-black text-amber-950">
          SA Member · {notices.length} to review
        </p>
        <Link
          href={patientsHref}
          className="text-[11px] font-bold text-amber-900 underline"
        >
          Patients
        </Link>
      </div>
      <ul className="space-y-2">
        {notices.slice(0, 6).map((n) => (
          <li
            key={n.id}
            className="rounded-2xl border border-amber-100 bg-white px-3 py-2.5"
          >
            <p className="flex items-center gap-2 text-sm font-black text-slate-900">
              <UserPlus className="h-4 w-4 text-amber-700" />
              {n.person_name}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {n.kind === 'member_joined'
                ? n.note || 'Wants to join this practice'
                : n.kind === 'booking_request'
                  ? `Asked to join a full slot · ${n.date || ''} ${n.start_time || ''}`
                  : `Booked ${n.date || ''} ${n.start_time || ''}`}
              {n.email ? ` · ${n.email}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {n.kind === 'member_joined' ? (
                <button
                  type="button"
                  disabled={busyId === n.id}
                  onClick={() => void act(n.id, 'accepted')}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> Accept
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busyId === n.id}
                  onClick={() => void act(n.id, 'seen')}
                  className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black text-white disabled:opacity-50"
                >
                  Mark seen
                </button>
              )}
              <button
                type="button"
                disabled={busyId === n.id}
                onClick={() => void act(n.id, 'dismissed')}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600 disabled:opacity-50"
              >
                <X className="h-3 w-3" /> Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
