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
import { ProgrammeCalendarGrid } from '@/components/fitness/ProgrammeCalendarGrid';
import {
  hydrateProgramme,
  programmeBlocksOrLegacy,
  programmeKindLabel,
  programmeWeekCount,
  type FitProgrammeBlock,
  type FitProgrammeItem,
  type FitProgrammeKind,
  type FitProgrammeWeekday,
} from '@/lib/fitness/movements';
import { listedFitMovements } from '@/lib/fitness/movement-catalog';
import { FEEDBACK_FEELING_LABELS } from '@/lib/fitness/fitgraph';
import {
  buildProgrammeFollowRoster,
  fillWeeksFromWeek1,
  isoWeekdayMon1,
  mondayOfIso,
} from '@/lib/fitness/programme-follow';
import { addDaysIso } from '@/lib/schedule/recurrence';

const blank = () => ({
  name: '',
  description: '',
  follow_notes: '',
  coach_id: '',
  kind: 'both' as FitProgrammeKind,
  class_type_ids: [] as string[],
  session_ids: [] as string[],
  personal_for_coach: false,
  weeks: 4,
  blocks: [] as FitProgrammeBlock[],
  items: [] as FitProgrammeItem[],
  price_zar: '',
  public: false,
  billing: 'once' as 'once' | 'monthly' | 'pack',
  active: true,
});

function newBlockId() {
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
function newItemId() {
  return `itm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function nextMondayIso(from = new Date().toISOString().slice(0, 10)) {
  const wd = isoWeekdayMon1(from);
  return wd === 1 ? from : addDaysIso(from, 8 - wd);
}

export default function ProgrammesPage() {
  const { store, loading, saving, post, summary } = useFitgraph({
    library: true,
  });
  const formAnchorRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'build' | 'follow'>('build');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [addMovementId, setAddMovementId] = useState('');
  const [selected, setSelected] = useState<{
    week: number;
    weekday: FitProgrammeWeekday;
  } | null>({ week: 1, weekday: 1 });
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const [assignStart, setAssignStart] = useState(nextMondayIso());
  const [followProgrammeId, setFollowProgrammeId] = useState('');
  const [coachNote, setCoachNote] = useState('');
  const [followEnrollmentId, setFollowEnrollmentId] = useState<string | null>(
    null
  );

  const movements = store ? listedFitMovements(store) : [];
  const programmes = store?.programmes || [];

  const selectedBlock = useMemo(
    () =>
      selected
        ? form.blocks.find(
            (b) => b.week === selected.week && b.weekday === selected.weekday
          ) || null
        : null,
    [form.blocks, selected]
  );

  const startEdit = (id: string, nextTab: 'build' | 'follow' = 'build') => {
    const p = programmes.find((x) => x.id === id);
    if (!p) {
      toast.error('Programme not found');
      return;
    }
    setEditingId(p.id);
    setTab(nextTab);
    const blocks = programmeBlocksOrLegacy(p);
    setForm({
      name: p.name || '',
      description: p.description || '',
      follow_notes: p.follow_notes || '',
      coach_id: p.coach_id || '',
      kind: p.kind || 'class',
      class_type_ids: [...(p.class_type_ids || [])],
      session_ids: [...(p.session_ids || [])],
      personal_for_coach: p.personal_for_coach === true,
      weeks: programmeWeekCount(p),
      blocks,
      items: [...(p.items || [])],
      price_zar: p.price_zar != null ? String(p.price_zar) : '',
      public: p.public === true,
      billing: p.billing || 'once',
      active: p.active !== false,
    });
    setSelected(
      blocks[0]
        ? { week: blocks[0].week, weekday: blocks[0].weekday }
        : { week: 1, weekday: 1 }
    );
    setFollowProgrammeId(p.id);
    requestAnimationFrame(() =>
      formAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    );
  };

  const patchBlock = (
    week: number,
    weekday: FitProgrammeWeekday,
    patch: Partial<FitProgrammeBlock> | null
  ) => {
    setForm((f) => {
      const i = f.blocks.findIndex(
        (b) => b.week === week && b.weekday === weekday
      );
      if (patch === null) {
        return {
          ...f,
          blocks: f.blocks.filter(
            (b) => !(b.week === week && b.weekday === weekday)
          ),
        };
      }
      if (i < 0) {
        return {
          ...f,
          blocks: [
            ...f.blocks,
            {
              id: newBlockId(),
              week,
              weekday,
              title: patch.title,
              notes: patch.notes,
              items: patch.items || [],
            },
          ],
        };
      }
      const next = [...f.blocks];
      next[i] = { ...next[i], ...patch };
      return { ...f, blocks: next };
    });
  };

  const addItem = () => {
    if (!selected) {
      toast.error('Pick a day on the calendar');
      return;
    }
    if (!addMovementId) {
      toast.error('Pick a movement from the library');
      return;
    }
    const block =
      form.blocks.find(
        (b) => b.week === selected.week && b.weekday === selected.weekday
      ) || null;
    const items = [
      ...(block?.items || []),
      {
        id: newItemId(),
        movement_id: addMovementId,
        sets: 3,
        reps: '8-10',
        rest_sec: 60,
        sort: (block?.items || []).length,
      } as FitProgrammeItem,
    ];
    patchBlock(selected.week, selected.weekday, {
      title: block?.title,
      notes: block?.notes,
      items,
    });
    setAddMovementId('');
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    const hasMoves = form.blocks.some((b) => (b.items || []).length > 0);
    if (!hasMoves) {
      toast.error('Add at least one movement on the calendar');
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
        follow_notes: form.follow_notes.trim() || undefined,
        coach_id: form.coach_id || null,
        kind: form.kind,
        class_type_ids: form.class_type_ids,
        session_ids: form.session_ids,
        personal_for_coach: form.kind !== 'class' && form.personal_for_coach,
        weeks: form.weeks,
        blocks: form.blocks.map((b, i) => ({
          ...b,
          items: (b.items || []).map((it, j) => ({ ...it, sort: j })),
          id: b.id || `blk_${i}`,
        })),
        price_zar: form.price_zar ? Number(form.price_zar) : null,
        public: form.public,
        billing: form.billing,
        active: form.active,
      },
    });
    toast.success(editingId ? 'Programme updated' : 'Programme saved');
  };

  const preview = useMemo(
    () =>
      hydrateProgramme(
        {
          id: editingId || 'preview',
          name: form.name || 'Programme',
          description: form.description,
          follow_notes: form.follow_notes,
          coach_id: form.coach_id || null,
          kind: form.kind,
          class_type_ids: form.class_type_ids,
          session_ids: form.session_ids,
          personal_for_coach: form.personal_for_coach,
          weeks: form.weeks,
          blocks: form.blocks,
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

  const followId = followProgrammeId || editingId || programmes[0]?.id || '';
  const roster = useMemo(
    () =>
      store
        ? buildProgrammeFollowRoster({
            programmes: store.programmes || [],
            enrollments: store.programme_enrollments || [],
            logs: store.programme_logs || [],
            clients: store.clients || [],
            programmeId: followId || null,
          })
        : [],
    [store, followId]
  );
  const followRow = roster.find((r) => r.enrollment_id === followEnrollmentId);
  const followEnrollment = (store?.programme_enrollments || []).find(
    (e) => e.id === followEnrollmentId
  );
  const followProgramme = programmes.find((p) => p.id === followId);
  const followLogs = (store?.programme_logs || []).filter(
    (l) => l.enrollment_id === followEnrollmentId
  );

  const enroll = async () => {
    if (!followId) {
      toast.error('Save a programme first');
      return;
    }
    if (!assignIds.length) {
      toast.error('Pick at least one client');
      return;
    }
    await post({
      action: 'enroll_programme',
      programme_id: followId,
      client_ids: assignIds,
      start_date: assignStart,
      coach_id: form.coach_id || undefined,
    });
    toast.success('Clients enrolled — they can follow it in the member app');
    setAssignIds([]);
  };

  const saveCoachNote = async () => {
    if (!followEnrollment || !coachNote.trim()) return;
    const last = [...followLogs].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    )[0];
    if (!last) {
      toast.error('Client has not logged a session yet');
      return;
    }
    await post({
      action: 'log_programme',
      enrollment_id: followEnrollment.id,
      block_id: last.block_id,
      coach_comment: coachNote.trim(),
      by_role: 'desk',
    });
    toast.success('Coach note saved on their last session');
    setCoachNote('');
  };

  const moveCount = form.blocks.reduce(
    (n, b) => n + (b.items || []).length,
    0
  );

  return (
    <FitgraphWorkbench
      title="Programmes"
      titleAccent="build · sell · follow"
      description="Build a week-by-week calendar from the movement library, sell it to new customers, assign it to clients, and track how they follow it — with feeling and effort feedback after every session."
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
                value: Number(summary?.programmeCount) || programmes.length,
              },
              {
                label: 'Following now',
                value:
                  Number(summary?.programmeEnrollmentCount) ||
                  (store.programme_enrollments || []).filter(
                    (e) => e.status === 'active'
                  ).length,
              },
              {
                label: 'Session logs',
                value:
                  Number(summary?.programmeLogCount) ||
                  (store.programme_logs || []).length,
              },
              {
                label: 'On shop',
                value: programmes.filter(
                  (p) => p.public === true && Number(p.price_zar) > 0
                ).length,
              },
            ]}
          />

          <div className="flex flex-wrap gap-1">
            {(
              [
                ['build', 'Build & sell'],
                ['follow', 'Follow & feedback'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-black ${
                  tab === id
                    ? 'bg-yellow-400 text-yellow-950'
                    : 'border border-yellow-200 text-yellow-800 dark:border-yellow-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

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

          {tab === 'build' ? (
            <div className="space-y-6" ref={formAnchorRef}>
              {programmes.length ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {programmes.map((p) => {
                    const enrolled = (store.programme_enrollments || []).filter(
                      (e) => e.programme_id === p.id && e.status === 'active'
                    ).length;
                    const nBlocks = programmeBlocksOrLegacy(p).length;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => startEdit(p.id)}
                        className={`rounded-2xl border px-4 py-3 text-left ${
                          editingId === p.id
                            ? 'border-yellow-500 bg-yellow-100 dark:bg-yellow-900/40'
                            : 'border-yellow-200 bg-white dark:border-yellow-800 dark:bg-yellow-950/20'
                        }`}
                      >
                        <p className="font-black text-sm">{p.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {programmeWeekCount(p)} wk · {nBlocks} days ·{' '}
                          {programmeKindLabel(p.kind)}
                          {p.price_zar != null ? ` · R${p.price_zar}` : ''}
                          {p.public && Number(p.price_zar) > 0 ? ' · Shop' : ''}
                          {enrolled ? ` · ${enrolled} following` : ''}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <FormCard
                tone="owner"
                title={
                  editingId
                    ? `Edit programme · ${form.name}`
                    : 'New programme'
                }
                description="Name it, drop sessions on the calendar, add movements and coaching notes, then sell or assign it."
                onSubmit={() => void save()}
                saving={saving}
                submitLabel={editingId ? 'Save programme' : 'Create programme'}
              >
                <input
                  className={fc()}
                  placeholder="Programme name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
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
                  <option value="both">Class and personal training</option>
                  <option value="class">Allocate to class</option>
                  <option value="personal_pt">Personal training only</option>
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
                <select
                  className={fc()}
                  value={String(form.weeks)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      weeks: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                >
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      {w} week{w === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
                <textarea
                  className={fc() + ' min-h-[3rem] resize-y sm:col-span-2'}
                  placeholder="What this programme is for (shown to clients and on the shop)"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
                <textarea
                  className={fc() + ' min-h-[3rem] resize-y sm:col-span-2 lg:col-span-3'}
                  placeholder="How to follow it — pacing, equipment, rest days, who it is for"
                  value={form.follow_notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, follow_notes: e.target.value }))
                  }
                />

                <div className="sm:col-span-2 lg:col-span-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase text-slate-500">
                      Calendar · {moveCount} movements across {form.blocks.length}{' '}
                      days
                    </p>
                    <button
                      type="button"
                      className="text-[11px] font-bold text-yellow-800 underline"
                      onClick={() =>
                        setForm((f) => {
                          let n = 0;
                          return {
                            ...f,
                            blocks: fillWeeksFromWeek1(
                              f.blocks,
                              f.weeks,
                              (p) =>
                                `${p}_${Date.now().toString(36)}_${n++}`
                            ),
                          };
                        })
                      }
                    >
                      Copy week 1 onto later weeks
                    </button>
                  </div>
                  <ProgrammeCalendarGrid
                    weeks={form.weeks}
                    blocks={form.blocks}
                    movements={movements}
                    selected={selected}
                    onSelect={(week, weekday) =>
                      setSelected({
                        week,
                        weekday: weekday as FitProgrammeWeekday,
                      })
                    }
                    mode="build"
                  />
                </div>

                {selected ? (
                  <div className="sm:col-span-2 lg:col-span-3 space-y-2 rounded-2xl border border-yellow-200 bg-white p-3 dark:border-yellow-800 dark:bg-yellow-950/30">
                    <p className="text-[10px] font-black uppercase text-slate-500">
                      Week {selected.week} ·{' '}
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][
                        selected.weekday - 1
                      ]}
                    </p>
                    <input
                      className={fc()}
                      placeholder="Session title (e.g. Lower strength)"
                      value={selectedBlock?.title || ''}
                      onChange={(e) =>
                        patchBlock(selected.week, selected.weekday, {
                          title: e.target.value,
                          notes: selectedBlock?.notes,
                          items: selectedBlock?.items || [],
                        })
                      }
                    />
                    <textarea
                      className={fc() + ' min-h-[3rem] resize-y'}
                      placeholder="Coaching notes for this day — intent, tempo, scales"
                      value={selectedBlock?.notes || ''}
                      onChange={(e) =>
                        patchBlock(selected.week, selected.weekday, {
                          title: selectedBlock?.title,
                          notes: e.target.value,
                          items: selectedBlock?.items || [],
                        })
                      }
                    />
                    {(selectedBlock?.items || []).length ? (
                      <ul className="space-y-2">
                        {(selectedBlock?.items || []).map((it, idx) => {
                          const mv = movements.find(
                            (m) => m.id === it.movement_id
                          );
                          return (
                            <li
                              key={it.id}
                              className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center rounded-xl border border-yellow-200 p-2 dark:border-yellow-800"
                            >
                              <div className="col-span-2 font-bold text-sm truncate">
                                {idx + 1}. {mv?.name || 'Removed'}
                                {mv?.overview ? (
                                  <span className="block font-normal text-[11px] text-slate-500 truncate">
                                    {mv.overview}
                                  </span>
                                ) : null}
                              </div>
                              <input
                                className={fc()}
                                type="number"
                                min={1}
                                placeholder="Sets"
                                value={it.sets ?? ''}
                                onChange={(e) =>
                                  patchBlock(selected.week, selected.weekday, {
                                    items: (selectedBlock?.items || []).map(
                                      (x) =>
                                        x.id === it.id
                                          ? {
                                              ...x,
                                              sets: e.target.value
                                                ? Number(e.target.value)
                                                : null,
                                            }
                                          : x
                                    ),
                                  })
                                }
                              />
                              <input
                                className={fc()}
                                placeholder="Reps / time"
                                value={it.reps || ''}
                                onChange={(e) =>
                                  patchBlock(selected.week, selected.weekday, {
                                    items: (selectedBlock?.items || []).map(
                                      (x) =>
                                        x.id === it.id
                                          ? { ...x, reps: e.target.value }
                                          : x
                                    ),
                                  })
                                }
                              />
                              <input
                                className={fc()}
                                type="number"
                                min={0}
                                placeholder="Rest s"
                                value={it.rest_sec ?? ''}
                                onChange={(e) =>
                                  patchBlock(selected.week, selected.weekday, {
                                    items: (selectedBlock?.items || []).map(
                                      (x) =>
                                        x.id === it.id
                                          ? {
                                              ...x,
                                              rest_sec: e.target.value
                                                ? Number(e.target.value)
                                                : null,
                                            }
                                          : x
                                    ),
                                  })
                                }
                              />
                              <input
                                className={fc() + ' sm:col-span-2'}
                                placeholder="Tempo / load notes"
                                value={it.notes || it.tempo || ''}
                                onChange={(e) =>
                                  patchBlock(selected.week, selected.weekday, {
                                    items: (selectedBlock?.items || []).map(
                                      (x) =>
                                        x.id === it.id
                                          ? { ...x, notes: e.target.value }
                                          : x
                                    ),
                                  })
                                }
                              />
                              <button
                                type="button"
                                className="text-rose-600 text-xs font-bold inline-flex items-center gap-1"
                                onClick={() =>
                                  patchBlock(selected.week, selected.weekday, {
                                    items: (selectedBlock?.items || []).filter(
                                      (x) => x.id !== it.id
                                    ),
                                  })
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Rest day until you add a movement.
                      </p>
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
                      {selectedBlock ? (
                        <button
                          type="button"
                          className="text-xs font-bold text-rose-600"
                          onClick={() =>
                            patchBlock(
                              selected.week,
                              selected.weekday,
                              null
                            )
                          }
                        >
                          Clear day
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {form.kind !== 'personal_pt' ? (
                  <div className="sm:col-span-2 lg:col-span-3 space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-500">
                      Also allocate to class types
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
                  placeholder="Sell price ZAR (blank = assign only)"
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
                  Sell on website (new customers pay first via Paystack / Apple
                  Pay)
                </label>

                {form.blocks.length ? (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <ProgrammeView programme={preview} />
                  </div>
                ) : null}

                {editingId ? (
                  <button
                    type="button"
                    className="text-xs font-bold text-slate-500 underline"
                    onClick={() => {
                      setEditingId(null);
                      setForm(blank());
                      setSelected({ week: 1, weekday: 1 });
                    }}
                  >
                    New programme
                  </button>
                ) : null}
              </FormCard>

              <DataTable
                tone="owner"
                headers={[
                  'Programme',
                  'Weeks',
                  'Days',
                  'Coach',
                  'Price',
                  'Shop',
                ]}
                rows={programmes.map((p) => {
                  const coach = store.coaches.find((c) => c.id === p.coach_id);
                  return {
                    id: p.id,
                    cells: [
                      p.name,
                      programmeWeekCount(p),
                      programmeBlocksOrLegacy(p).length,
                      coach?.name || '—',
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
          ) : (
            <div className="space-y-6">
              <FormCard
                tone="owner"
                title="Assign to clients"
                description="Start date is the Monday of week 1. Clients see the calendar and log feeling + effort after each day. Buying on the shop also enrolls automatically."
                onSubmit={() => void enroll()}
                saving={saving}
                submitLabel="Enroll selected"
              >
                <select
                  className={fc()}
                  value={followId}
                  onChange={(e) => {
                    setFollowProgrammeId(e.target.value);
                    setFollowEnrollmentId(null);
                    const p = programmes.find((x) => x.id === e.target.value);
                    if (p) startEdit(p.id, 'follow');
                  }}
                >
                  <option value="">Programme…</option>
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  className={fc()}
                  type="date"
                  value={assignStart}
                  onChange={(e) =>
                    setAssignStart(
                      mondayOfIso(e.target.value || nextMondayIso())
                    )
                  }
                />
                <div className="sm:col-span-2 lg:col-span-3 max-h-40 overflow-y-auto rounded-xl border border-yellow-200 divide-y dark:border-yellow-800">
                  {store.clients
                    .filter((c) => c.active !== false)
                    .map((c) => {
                      const on = assignIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 px-2.5 py-1.5 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              setAssignIds((ids) =>
                                on
                                  ? ids.filter((x) => x !== c.id)
                                  : [...ids, c.id]
                              )
                            }
                          />
                          {c.name}
                          {c.membership_status
                            ? ` · ${c.membership_status}`
                            : ''}
                        </label>
                      );
                    })}
                </div>
              </FormCard>

              {followProgramme ? (
                <ProgrammeCalendarGrid
                  weeks={programmeWeekCount(followProgramme)}
                  blocks={programmeBlocksOrLegacy(followProgramme)}
                  movements={movements}
                  startDate={followEnrollment?.start_date}
                  today={new Date().toISOString().slice(0, 10)}
                  logs={followLogs}
                  mode={followEnrollment ? 'follow' : 'view'}
                />
              ) : null}

              <div className="rounded-3xl border border-yellow-200 bg-white overflow-hidden dark:border-yellow-800">
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="text-left text-[10px] font-black uppercase tracking-wider bg-yellow-50 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-200">
                    <tr>
                      <th className="px-3 py-2.5">Client</th>
                      <th className="px-3 py-2.5">Progress</th>
                      <th className="px-3 py-2.5">Feel / RPE</th>
                      <th className="px-3 py-2.5">Last feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-10 text-center text-slate-500"
                        >
                          Nobody is following this programme yet. Assign
                          clients or sell it on the shop.
                        </td>
                      </tr>
                    ) : (
                      roster.map((r) => (
                        <tr
                          key={r.enrollment_id}
                          className={`border-t border-slate-100 cursor-pointer ${
                            followEnrollmentId === r.enrollment_id
                              ? 'bg-yellow-50'
                              : ''
                          }`}
                          onClick={() =>
                            setFollowEnrollmentId(r.enrollment_id)
                          }
                        >
                          <td className="px-3 py-2.5 font-semibold">
                            {r.client_name}
                            <span className="block text-[11px] font-normal text-slate-500">
                              from {r.start_date} · {r.source}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {r.progress.pct}% · {r.progress.done}/
                            {r.progress.total}
                          </td>
                          <td className="px-3 py-2.5">
                            {r.progress.avg_feeling != null
                              ? `${r.progress.avg_feeling}/5 ${
                                  FEEDBACK_FEELING_LABELS[
                                    Math.round(r.progress.avg_feeling)
                                  ] || ''
                                }`
                              : '—'}
                            {r.progress.avg_rpe != null
                              ? ` · RPE ${r.progress.avg_rpe}`
                              : ''}
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            {r.last_log?.comment ||
                              r.last_log?.coach_comment ||
                              (r.last_log
                                ? `${r.last_log.date} · ${r.last_log.status}`
                                : '—')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {followRow ? (
                <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 space-y-2 dark:border-yellow-800">
                  <p className="text-sm font-black">
                    Feedback · {followRow.client_name}
                  </p>
                  {followRow.last_log ? (
                    <p className="text-xs text-slate-600">
                      Last {followRow.last_log.date}: {followRow.last_log.status}
                      {followRow.last_log.feeling
                        ? ` · feel ${followRow.last_log.feeling}/5`
                        : ''}
                      {followRow.last_log.rpe
                        ? ` · RPE ${followRow.last_log.rpe}`
                        : ''}
                      {followRow.last_log.comment
                        ? ` — “${followRow.last_log.comment}”`
                        : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No session logged yet.
                    </p>
                  )}
                  <textarea
                    className={fc() + ' min-h-[3rem] resize-y'}
                    placeholder="Coach note on their last logged day"
                    value={coachNote}
                    onChange={(e) => setCoachNote(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={saving}
                    className="rounded-xl bg-yellow-400 px-3 py-2 text-xs font-black text-yellow-950"
                    onClick={() => void saveCoachNote()}
                  >
                    Save coach note
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </FitgraphWorkbench>
  );
}
