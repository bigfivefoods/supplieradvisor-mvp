'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { Copy, Share2 } from 'lucide-react';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import { sessionBookingCount } from '@/lib/fitness/fitgraph';
import { buildPublicFeedbackPath } from '@/lib/services/booking-feedback';

export default function BookingsPage() {
  const { companyId, store, loading, saving, post, summary } = useFitgraph();
  const [form, setForm] = useState({
    session_id: '',
    client_id: '',
    status: 'booked',
  });

  const add = async () => {
    if (!form.session_id || !form.client_id) {
      toast.error('Session and client required');
      return;
    }
    await post({
      entity: 'bookings',
      action: 'upsert',
      record: form,
    });
    toast.success('Member added to class (waitlist if full)');
  };

  const copyInvite = async (sessionId: string) => {
    const data = await post({
      action: 'issue_class_invite',
      session_id: sessionId,
    });
    const inv = data.invite as { path?: string; text?: string } | undefined;
    if (!inv?.path || typeof window === 'undefined') {
      toast.error('Could not create join link');
      return;
    }
    const url = `${window.location.origin}${inv.path}`;
    await navigator.clipboard.writeText(`${inv.text || 'Join class'}\n${url}`);
    toast.success('B2C join link copied');
  };

  const mark = async (id: string, status: string) => {
    const data = await post({
      action: 'mark_attendance',
      booking_id: id,
      status,
    });
    if (status === 'attended') {
      const tok = data?.feedback_prompt?.token as string | undefined;
      const packLeft = data?.pack_remaining;
      if (tok) {
        const path = buildPublicFeedbackPath('fitgraph', companyId, tok);
        const url = `${window.location.origin}${path}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success(
            packLeft != null
              ? `Attended — pack left ${packLeft}; feedback link copied`
              : 'Attended — feedback link copied for the member'
          );
        } catch {
          toast.success(data?.message || 'Attended');
        }
        return;
      }
      if (packLeft != null) {
        toast.success(`Attended — pack sessions left: ${packLeft}`);
        return;
      }
    }
    toast.success(data?.message || `Marked ${status}`);
  };



  const copyFeedback = async (token: string) => {
    const path = buildPublicFeedbackPath('fitgraph', companyId, token);
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    toast.success('Feedback link copied');
  };

  return (
    <FitgraphWorkbench
      title="Bookings"
      titleAccent="classes"
      description="Add members to classes, or copy a join link. When you mark attended, a feedback link is issued so the member can rate the class."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="owner"
            items={[
              {
                label: 'Open bookings',
                value: Number(summary?.bookingsOpen) || 0,
              },
              {
                label: 'Feedback pending',
                value: Number(summary?.pendingFeedback) || 0,
              },
            ]}
          />
          <FormCard
            tone="owner"
            title="Add member to class"
            onSubmit={() => void add()}
            saving={saving}
            submitLabel="Add to class"
          >
            <select
              className={fc()}
              value={form.session_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, session_id: e.target.value }))
              }
            >
              <option value="">Class…</option>
              {[...store.sessions]
                .filter((s) => s.status === 'scheduled')
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((s) => {
                  const ct = store.class_types.find(
                    (c) => c.id === s.class_type_id
                  );
                  const coach = store.coaches.find((c) => c.id === s.coach_id);
                  const booked = sessionBookingCount(store, s.id);
                  return (
                    <option key={s.id} value={s.id}>
                      {s.date} {s.start_time} · {ct?.name}
                      {coach ? ` · ${coach.name}` : ''} ({booked}/
                      {s.capacity ?? '—'})
                    </option>
                  );
                })}
            </select>
            <select
              className={fc()}
              value={form.client_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, client_id: e.target.value }))
              }
            >
              <option value="">Member…</option>
              {store.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
            {form.session_id ? (
              <button
                type="button"
                className="sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-bold text-yellow-700"
                onClick={() => void copyInvite(form.session_id)}
              >
                <Share2 className="w-3.5 h-3.5" /> Copy B2C join link for this
                class
              </button>
            ) : null}
          </FormCard>
          <DataTable tone="owner"
            headers={['Session', 'Client', 'Status', 'Booked at', 'Actions']}
            rows={store.bookings.map((b) => {
              const s = store.sessions.find((x) => x.id === b.session_id);
              const ct = store.class_types.find((c) => c.id === s?.class_type_id);
              const client = store.clients.find((c) => c.id === b.client_id);
              return {
                id: b.id,
                cells: [
                  s
                    ? `${s.date} ${s.start_time} ${ct?.name || ''}`
                    : b.session_id,
                  client?.name || b.client_id,
                  b.status,
                  b.booked_at.slice(0, 16).replace('T', ' '),
                  b.status === 'booked' ? '→ attend / no-show' : '—',
                ],
              };
            })}
            onDelete={(id) => void post({ entity: 'bookings', action: 'delete', id })}
          />
          <div className="flex flex-wrap gap-2">
            {store.bookings
              .filter((b) => b.status === 'booked')
              .slice(0, 12)
              .map((b) => {
                const client = store.clients.find((c) => c.id === b.client_id);
                return (
                  <div
                    key={b.id}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs flex gap-2 items-center dark:border-neutral-700 dark:bg-neutral-950"
                  >
                    <span className="font-bold">{client?.name || 'Client'}</span>
                    <button
                      type="button"
                      className="text-emerald-700 font-bold dark:text-emerald-300"
                      onClick={() => void mark(b.id, 'attended')}
                    >
                      Attended
                    </button>
                    <button
                      type="button"
                      className="text-rose-600 font-bold dark:text-rose-300"
                      onClick={() => void mark(b.id, 'no_show')}
                    >
                      No-show
                    </button>
                  </div>
                );
              })}
          </div>

          {/* Pending post-class feedback links */}
          {store.bookings.some(
            (b) =>
              b.status === 'attended' &&
              b.feedback_token &&
              !b.feedback_submitted_at
          ) ? (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50/60 p-4 dark:border-yellow-700/40 dark:bg-yellow-950/30">
              <h3 className="text-sm font-black text-yellow-950 dark:text-yellow-100">
                Feedback requested
              </h3>
              <p className="text-[11px] text-yellow-900/80 dark:text-yellow-200/80 mt-0.5 mb-3">
                Share these links with members after class (WhatsApp / SMS /
                email).
              </p>
              <ul className="space-y-1.5">
                {store.bookings
                  .filter(
                    (b) =>
                      b.status === 'attended' &&
                      b.feedback_token &&
                      !b.feedback_submitted_at
                  )
                  .map((b) => {
                    const client = store.clients.find(
                      (c) => c.id === b.client_id
                    );
                    return (
                      <li
                        key={b.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-yellow-100 bg-white px-3 py-2 text-xs dark:border-yellow-800 dark:bg-yellow-950"
                      >
                        <span className="font-bold">
                          {client?.name || b.guest_name || 'Member'}
                        </span>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-bold text-yellow-700 dark:text-yellow-300"
                          onClick={() =>
                            void copyFeedback(b.feedback_token!)
                          }
                        >
                          <Copy className="w-3 h-3" /> Copy feedback link
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </FitgraphWorkbench>
  );
}
