'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import { sessionBookingCount } from '@/lib/fitness/fitgraph';

export default function BookingsPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
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
    toast.success('Booking saved (waitlist if full)');
  };

  const mark = async (id: string, status: string) => {
    const b = store?.bookings.find((x) => x.id === id);
    if (!b) return;
    await post({
      entity: 'bookings',
      action: 'upsert',
      record: { ...b, status },
    });
    toast.success(`Marked ${status}`);
  };

  return (
    <FitgraphWorkbench
      title="Bookings"
      titleAccent="classes"
      description="Book members into scheduled sessions. Capacity full → automatic waitlist."
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
            ]}
          />
          <FormCard tone="owner" title="Book client into session" onSubmit={() => void add()} saving={saving} submitLabel="Book">
            <select className={fc()} value={form.session_id} onChange={(e) => setForm((f) => ({ ...f, session_id: e.target.value }))}>
              <option value="">Session…</option>
              {[...store.sessions]
                .filter((s) => s.status === 'scheduled')
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((s) => {
                  const ct = store.class_types.find((c) => c.id === s.class_type_id);
                  const booked = sessionBookingCount(store, s.id);
                  return (
                    <option key={s.id} value={s.id}>
                      {s.date} {s.start_time} · {ct?.name} ({booked}/{s.capacity ?? '—'})
                    </option>
                  );
                })}
            </select>
            <select className={fc()} value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
              <option value="">Client…</option>
              {store.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
              ))}
            </select>
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
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs flex gap-2 items-center"
                  >
                    <span className="font-bold">{client?.name || 'Client'}</span>
                    <button
                      type="button"
                      className="text-emerald-700 font-bold"
                      onClick={() => void mark(b.id, 'attended')}
                    >
                      Attended
                    </button>
                    <button
                      type="button"
                      className="text-rose-600 font-bold"
                      onClick={() => void mark(b.id, 'no_show')}
                    >
                      No-show
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </FitgraphWorkbench>
  );
}
