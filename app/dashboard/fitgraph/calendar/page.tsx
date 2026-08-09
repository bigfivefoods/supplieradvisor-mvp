'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import { sessionBookingCount } from '@/lib/fitness/fitgraph';

export default function CalendarPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({
    class_type_id: '',
    coach_id: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '06:00',
    location: 'Studio A',
    capacity: '',
    public: true,
    public_notes: '',
  });

  const daySessions = useMemo(() => {
    if (!store) return [];
    return store.sessions
      .filter((s) => s.date === day && s.status !== 'cancelled')
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [store, day]);

  const add = async () => {
    if (!form.class_type_id) {
      toast.error('Select a class type');
      return;
    }
    if (!form.coach_id) {
      toast.error('Assign a coach');
      return;
    }
    await post({
      entity: 'sessions',
      action: 'upsert',
      record: {
        ...form,
        coach_id: form.coach_id || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        public: form.public,
        public_notes: form.public_notes || undefined,
      },
    });
    toast.success(
      form.public
        ? 'Session scheduled and published to website'
        : 'Session scheduled (private)'
    );
  };

  const togglePublic = async (id: string, next: boolean) => {
    const s = store?.sessions.find((x) => x.id === id);
    if (!s) return;
    await post({
      entity: 'sessions',
      action: 'upsert',
      record: {
        ...s,
        public: next,
      },
    });
    toast.success(next ? 'Shared on website' : 'Hidden from website');
  };

  const reassignCoach = async (id: string, coachId: string) => {
    const s = store?.sessions.find((x) => x.id === id);
    if (!s) return;
    await post({
      entity: 'sessions',
      action: 'upsert',
      record: {
        ...s,
        coach_id: coachId || null,
      },
    });
    toast.success('Coach updated');
  };

  return (
    <FitgraphWorkbench
      title="Calendar"
      titleAccent="sessions"
      description="Owner schedules classes and assigns coaches. Mark sessions public so they appear on your website embed; coaches can also share from their portal."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-sm">
              <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                Day
              </span>
              <input
                className={fc()}
                type="date"
                value={day}
                onChange={(e) => {
                  setDay(e.target.value);
                  setForm((f) => ({ ...f, date: e.target.value }));
                }}
              />
            </label>
          </div>
          <StatRow
            items={[
              { label: 'On this day', value: daySessions.length },
              {
                label: 'Today (hub)',
                value: Number(summary?.sessionsToday) || 0,
              },
              {
                label: 'Public upcoming',
                value: Number(summary?.publicSessionsUpcoming) || 0,
              },
              {
                label: 'Website',
                value: store.settings?.enabled ? 'Live' : 'Off',
              },
            ]}
          />
          <FormCard
            title="Schedule session (assign coach)"
            onSubmit={() => void add()}
            saving={saving}
            submitLabel="Schedule"
          >
            <select
              className={fc()}
              value={form.class_type_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, class_type_id: e.target.value }))
              }
            >
              <option value="">Class type…</option>
              {store.class_types.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className={fc()}
              value={form.coach_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, coach_id: e.target.value }))
              }
            >
              <option value="">Coach (required)…</option>
              {store.coaches
                .filter((c) => c.active !== false)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <input
              className={fc()}
              type="date"
              value={form.date}
              onChange={(e) =>
                setForm((f) => ({ ...f, date: e.target.value }))
              }
            />
            <input
              className={fc()}
              type="time"
              value={form.start_time}
              onChange={(e) =>
                setForm((f) => ({ ...f, start_time: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Location / room"
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
            />
            <input
              className={fc()}
              type="number"
              placeholder="Capacity override"
              value={form.capacity}
              onChange={(e) =>
                setForm((f) => ({ ...f, capacity: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Public notes (for website)"
              value={form.public_notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, public_notes: e.target.value }))
              }
            />
            <label className="flex items-center gap-2 text-sm font-medium px-1">
              <input
                type="checkbox"
                checked={form.public}
                onChange={(e) =>
                  setForm((f) => ({ ...f, public: e.target.checked }))
                }
              />
              Publish on website calendar
            </label>
          </FormCard>

          <div className="space-y-2">
            {daySessions.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-2xl">
                No sessions on {day}. Schedule one above and assign a coach.
              </p>
            ) : (
              daySessions.map((s) => {
                const ct = store.class_types.find(
                  (c) => c.id === s.class_type_id
                );
                const coach = store.coaches.find((c) => c.id === s.coach_id);
                const booked = sessionBookingCount(store, s.id);
                const cap = s.capacity ?? ct?.capacity ?? 0;
                return (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-violet-100 bg-white px-4 py-3 space-y-2"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm">
                          {s.start_time} · {ct?.name || 'Class'}
                          {s.public ? (
                            <span className="ml-2 text-[10px] font-black uppercase text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                              Public
                            </span>
                          ) : (
                            <span className="ml-2 text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                              Private
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {coach?.name || 'No coach'} · {s.location || '—'} ·{' '}
                          {booked}/{cap} booked
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          type="button"
                          className="text-violet-700 text-xs font-bold"
                          onClick={() => void togglePublic(s.id, !s.public)}
                        >
                          {s.public ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          className="text-rose-600 text-xs font-bold"
                          onClick={() =>
                            void post({
                              entity: 'sessions',
                              action: 'delete',
                              id: s.id,
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400">
                        Coach
                      </span>
                      <select
                        className="rounded-lg border border-slate-200 text-xs px-2 py-1"
                        value={s.coach_id || ''}
                        onChange={(e) =>
                          void reassignCoach(s.id, e.target.value)
                        }
                      >
                        <option value="">Unassigned</option>
                        {store.coaches.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DataTable
            headers={[
              'Date',
              'Time',
              'Class',
              'Coach',
              'Room',
              'Cap',
              'Booked',
              'Web',
              'Status',
            ]}
            rows={[...store.sessions]
              .sort((a, b) =>
                a.date === b.date
                  ? a.start_time.localeCompare(b.start_time)
                  : a.date.localeCompare(b.date)
              )
              .slice(0, 50)
              .map((s) => {
                const ct = store.class_types.find(
                  (c) => c.id === s.class_type_id
                );
                const coach = store.coaches.find((c) => c.id === s.coach_id);
                return {
                  id: s.id,
                  cells: [
                    s.date,
                    s.start_time,
                    ct?.name || '—',
                    coach?.name || '—',
                    s.location || '—',
                    s.capacity ?? '—',
                    sessionBookingCount(store, s.id),
                    s.public ? 'Public' : 'Private',
                    s.status,
                  ],
                };
              })}
            onDelete={(id) =>
              void post({ entity: 'sessions', action: 'delete', id })
            }
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
