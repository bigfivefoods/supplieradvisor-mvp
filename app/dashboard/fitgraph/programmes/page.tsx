'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import { ProgrammeView } from '@/components/fitness/ProgrammeView';
import {
  hydrateProgramme,
  programmeKindLabel,
  type FitProgrammeItem,
  type FitProgrammeKind,
} from '@/lib/fitness/movements';
import { listedFitMovements } from '@/lib/fitness/movement-catalog';

const blank = () => ({
  name: '',
  description: '',
  coach_id: '',
  kind: 'class' as FitProgrammeKind,
  class_type_ids: [] as string[],
  session_ids: [] as string[],
  personal_for_coach: false,
  items: [] as FitProgrammeItem[],
  price_zar: '',
  public: false,
  billing: 'once' as 'once' | 'monthly' | 'pack',
  active: true,
});

export default function ProgrammesPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const formAnchorRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [addMovementId, setAddMovementId] = useState('');

  const movements = store ? listedFitMovements(store) : [];
  const programmes = store?.programmes || [];

  const startEdit = (id: string) => {
    const p = programmes.find((x) => x.id === id);
    if (!p) {
      toast.error('Programme not found');
      return;
    }
    setEditingId(p.id);
    setForm({
      name: p.name || '',
      description: p.description || '',
      coach_id: p.coach_id || '',
      kind: p.kind || 'class',
      class_type_ids: [...(p.class_type_ids || [])],
      session_ids: [...(p.session_ids || [])],
      personal_for_coach: p.personal_for_coach === true,
      items: [...(p.items || [])],
      price_zar: p.price_zar != null ? String(p.price_zar) : '',
      public: p.public === true,
      billing: p.billing || 'once',
      active: p.active !== false,
    });
    requestAnimationFrame(() =>
      formAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    );
  };

  const addItem = () => {
    if (!addMovementId) {
      toast.error('Pick a movement from the library');
      return;
    }
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          id: `itm_${Date.now().toString(36)}`,
          movement_id: addMovementId,
          sets: 3,
          reps: '8-10',
          rest_sec: 60,
          sort: f.items.length,
        },
      ],
    }));
    setAddMovementId('');
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    if (!form.items.length) {
      toast.error('Add at least one movement');
      return;
    }
    if (form.kind !== 'class' && !form.coach_id) {
      toast.error('Pick a coach for a personal training programme');
      return;
    }
    await post({
      entity: 'programmes',
      action: 'upsert',
      record: {
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        coach_id: form.coach_id || null,
        kind: form.kind,
        class_type_ids: form.class_type_ids,
        session_ids: form.session_ids,
        personal_for_coach:
          form.kind !== 'class' && form.personal_for_coach,
        items: form.items.map((it, i) => ({ ...it, sort: i })),
        price_zar: form.price_zar ? Number(form.price_zar) : null,
        public: form.public,
        billing: form.billing,
        active: form.active,
      },
    });
    toast.success(editingId ? 'Programme updated' : 'Programme saved');
    setEditingId(null);
    setForm(blank());
  };

  const preview = useMemo(
    () =>
      hydrateProgramme(
        {
          id: editingId || 'preview',
          name: form.name || 'Programme',
          description: form.description,
          coach_id: form.coach_id || null,
          kind: form.kind,
          class_type_ids: form.class_type_ids,
          session_ids: form.session_ids,
          personal_for_coach: form.personal_for_coach,
          items: form.items,
          created_at: '',
        },
        movements
      ),
    [form, editingId, movements]
  );

  const upcomingSessions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (store?.sessions || [])
      .filter((s) => s.status !== 'cancelled' && s.date >= today)
      .sort((a, b) =>
        a.date === b.date
          ? a.start_time.localeCompare(b.start_time)
          : a.date.localeCompare(b.date)
      )
      .slice(0, 40);
  }, [store]);

  return (
    <FitgraphWorkbench
      title="Programmes"
      titleAccent="class · PT"
      description="Build a session from the movement library, allocate it to a class or coach PT, and optionally sell it on the website (pay first via Paystack / Apple Pay)."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="owner"
            items={[
              {
                label: 'Programmes',
                value:
                  Number(summary?.programmeCount) || programmes.length,
              },
              {
                label: 'Movements in library',
                value: movements.filter((m) => m.active !== false).length,
              },
            ]}
          />
          {!movements.length ? (
            <p className="text-sm text-amber-800">
              Add movements first on{' '}
              <Link
                href="/dashboard/fitgraph/movements"
                className="font-bold underline"
              >
                Movement library
              </Link>
              .
            </p>
          ) : null}

          <div ref={formAnchorRef}>
            <FormCard
              tone="owner"
              title={editingId ? `Edit programme · ${form.name}` : 'New programme'}
              onSubmit={() => void save()}
              saving={saving}
              submitLabel={editingId ? 'Save programme' : 'Create programme'}
            >
              <input
                className={fc()}
                placeholder="Programme name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <select
                className={fc()}
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kind: e.target.value as FitProgrammeKind,
                  }))
                }
              >
                <option value="class">Allocate to class</option>
                <option value="personal_pt">Personal training only</option>
                <option value="both">Class and personal training</option>
              </select>
              <select
                className={fc()}
                value={form.coach_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, coach_id: e.target.value }))
                }
              >
                <option value="">Coach (optional for class)…</option>
                {store.coaches
                  .filter((c) => c.active !== false)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <textarea
                className={fc() + ' min-h-[3rem] resize-y sm:col-span-2'}
                placeholder="What this programme is for"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />

              <div className="sm:col-span-2 lg:col-span-3 space-y-2">
                <p className="text-[10px] font-black uppercase text-slate-500">
                  Movements in this programme
                </p>
                {form.items.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Pick a movement from the library and add it.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {form.items.map((it, idx) => {
                      const mv = movements.find((m) => m.id === it.movement_id);
                      return (
                        <li
                          key={it.id}
                          className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center rounded-xl border border-yellow-200 p-2 dark:border-yellow-800"
                        >
                          <div className="col-span-2 font-bold text-sm truncate">
                            {idx + 1}. {mv?.name || 'Removed'}
                          </div>
                          <input
                            className={fc()}
                            type="number"
                            min={1}
                            placeholder="Sets"
                            value={it.sets ?? ''}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                items: f.items.map((x) =>
                                  x.id === it.id
                                    ? {
                                        ...x,
                                        sets: e.target.value
                                          ? Number(e.target.value)
                                          : null,
                                      }
                                    : x
                                ),
                              }))
                            }
                          />
                          <input
                            className={fc()}
                            placeholder="Reps / time"
                            value={it.reps || ''}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                items: f.items.map((x) =>
                                  x.id === it.id
                                    ? { ...x, reps: e.target.value }
                                    : x
                                ),
                              }))
                            }
                          />
                          <input
                            className={fc()}
                            type="number"
                            min={0}
                            placeholder="Rest s"
                            value={it.rest_sec ?? ''}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                items: f.items.map((x) =>
                                  x.id === it.id
                                    ? {
                                        ...x,
                                        rest_sec: e.target.value
                                          ? Number(e.target.value)
                                          : null,
                                      }
                                    : x
                                ),
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="text-rose-600 text-xs font-bold inline-flex items-center gap-1"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                items: f.items.filter((x) => x.id !== it.id),
                              }))
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <select
                    className={fc() + ' flex-1 min-w-[12rem]'}
                    value={addMovementId}
                    onChange={(e) => setAddMovementId(e.target.value)}
                  >
                    <option value="">Add movement from library…</option>
                    {movements
                      .filter((m) => m.active !== false)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {m.category ? ` · ${m.category}` : ''}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-xl bg-yellow-400 px-3 py-2 text-xs font-black text-yellow-950 inline-flex items-center gap-1"
                    onClick={addItem}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>

              {form.kind !== 'personal_pt' ? (
                <div className="sm:col-span-2 lg:col-span-3 space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-500">
                    Allocate to class types
                  </p>
                  <div className="max-h-32 overflow-y-auto rounded-xl border border-yellow-200 divide-y dark:border-yellow-800">
                    {store.class_types
                      .filter((c) => c.active !== false)
                      .map((c) => {
                        const on = form.class_type_ids.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 px-2.5 py-1.5 text-sm cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                setForm((f) => ({
                                  ...f,
                                  class_type_ids: on
                                    ? f.class_type_ids.filter((x) => x !== c.id)
                                    : [...f.class_type_ids, c.id],
                                }))
                              }
                            />
                            {c.name}
                          </label>
                        );
                      })}
                  </div>
                </div>
              ) : null}

              <div className="sm:col-span-2 lg:col-span-3 space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-500">
                  Allocate to upcoming sessions (optional)
                </p>
                <div className="max-h-32 overflow-y-auto rounded-xl border border-yellow-200 divide-y dark:border-yellow-800">
                  {upcomingSessions.length === 0 ? (
                    <p className="text-xs text-slate-500 px-2 py-2">
                      No upcoming sessions yet.
                    </p>
                  ) : (
                    upcomingSessions.map((s) => {
                      const ct = store.class_types.find(
                        (c) => c.id === s.class_type_id
                      );
                      const on = form.session_ids.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 px-2.5 py-1.5 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              setForm((f) => ({
                                ...f,
                                session_ids: on
                                  ? f.session_ids.filter((x) => x !== s.id)
                                  : [...f.session_ids, s.id],
                              }))
                            }
                          />
                          {s.date} {s.start_time} · {ct?.name || 'Session'}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {form.kind !== 'class' ? (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.personal_for_coach}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        personal_for_coach: e.target.checked,
                      }))
                    }
                  />
                  This is the coach’s own personal training programme
                </label>
              ) : null}

              <input
                className={fc()}
                type="number"
                min={0}
                placeholder="Sell price ZAR (blank = not for sale)"
                value={form.price_zar}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price_zar: e.target.value }))
                }
              />
              <select
                className={fc()}
                value={form.billing}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    billing: e.target.value as 'once' | 'monthly' | 'pack',
                  }))
                }
              >
                <option value="once">Once-off</option>
                <option value="monthly">Monthly</option>
                <option value="pack">Pack</option>
              </select>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.public}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, public: e.target.checked }))
                  }
                />
                Sell on website (members pay first via Paystack / Apple Pay)
              </label>

              {form.items.length ? <ProgrammeView programme={preview} /> : null}

              {editingId ? (
                <button
                  type="button"
                  className="text-xs font-bold text-slate-500 underline"
                  onClick={() => {
                    setEditingId(null);
                    setForm(blank());
                  }}
                >
                  Cancel edit
                </button>
              ) : null}
            </FormCard>
          </div>

          <DataTable
            tone="owner"
            headers={['Programme', 'Kind', 'Coach', 'Moves', 'Price', 'Shop']}
            rows={programmes.map((p) => {
              const coach = store.coaches.find((c) => c.id === p.coach_id);
              return {
                id: p.id,
                cells: [
                  p.name,
                  programmeKindLabel(p.kind) +
                    (p.personal_for_coach ? ' · own PT' : ''),
                  coach?.name || '—',
                  (p.items || []).length,
                  p.price_zar != null ? `R${p.price_zar}` : '—',
                  p.public === true && Number(p.price_zar) > 0
                    ? 'Public'
                    : 'Hidden',
                ],
              };
            })}
            onEdit={(id) => startEdit(id)}
            onDelete={(id) =>
              void post({ entity: 'programmes', action: 'delete', id })
            }
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
