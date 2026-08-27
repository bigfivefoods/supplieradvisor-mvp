'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { StatRow } from '@/components/fitness/FitForm';
import {
  GYM_BOARD_AGE_BANDS,
  GYM_BOARD_UNITS,
  buildGymBoardRows,
  parseGymBoardActivities,
  type GymBoardAgeBandId,
  type GymBoardSex,
  type GymBoardWin,
} from '@/lib/fitness/gym-leaderboard';

const card =
  'rounded-3xl border border-yellow-300 bg-yellow-50 p-4 space-y-3 dark:border-yellow-400 dark:bg-yellow-950';
const input =
  'rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white w-full dark:border-neutral-700 dark:bg-neutral-950';

const blankMarks = () => {
  const out: Record<string, string> = {};
  for (const band of GYM_BOARD_AGE_BANDS) {
    out[`male:${band.id}`] = '';
    out[`female:${band.id}`] = '';
  }
  return out;
};

export default function GymLeaderboardPage() {
  const { store, loading, saving, post } = useFitgraph();
  const activities = store
    ? parseGymBoardActivities(store.leaderboard_activities)
    : [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [win, setWin] = useState<GymBoardWin>('higher');
  const [notes, setNotes] = useState('');
  const [marks, setMarks] = useState(blankMarks);
  const [previewSex, setPreviewSex] = useState<GymBoardSex>('male');
  const [previewBand, setPreviewBand] = useState<GymBoardAgeBandId>('25_34');
  const [classPins, setClassPins] = useState<string[]>([]);

  const editing = useMemo(
    () => activities.find((a) => a.id === editingId) || null,
    [activities, editingId]
  );

  const startNew = () => {
    setEditingId(null);
    setName('');
    setUnit('kg');
    setWin('higher');
    setNotes('');
    setMarks(blankMarks());
    setClassPins([]);
  };

  const startEdit = (id: string) => {
    const a = activities.find((x) => x.id === id);
    if (!a) return;
    setEditingId(a.id);
    setName(a.name);
    setUnit(a.unit);
    setWin(a.win);
    setNotes(a.notes || '');
    const next = blankMarks();
    for (const b of a.benchmarks) {
      next[`${b.sex}:${b.band_id}`] = String(b.value);
    }
    setMarks(next);
    setClassPins(
      (store?.leaderboard_assignments || [])
        .filter((x) => x.activity_id === a.id && !x.session_id)
        .map((x) => x.class_type_id)
    );
  };

  const save = async () => {
    const benchmarks = Object.entries(marks)
      .map(([key, raw]) => {
        if (!String(raw).trim()) return null;
        const [sex, band_id] = key.split(':') as [GymBoardSex, GymBoardAgeBandId];
        return { sex, band_id, value: raw };
      })
      .filter(Boolean);
    const data = await post({
      action: 'upsert_leaderboard_activity',
      id: editingId,
      name,
      unit,
      win,
      notes,
      benchmarks,
    });
    const activityId = String(data?.activity?.id || editingId || '');
    if (activityId) setEditingId(activityId);
    if (activityId && store) {
      const current = (store.leaderboard_assignments || []).filter(
        (x) => x.activity_id === activityId && !x.session_id
      );
      for (const row of current) {
        if (!classPins.includes(row.class_type_id)) {
          await post({
            action: 'unassign_leaderboard_activity',
            id: row.id,
          });
        }
      }
      for (const classId of classPins) {
        if (!current.some((x) => x.class_type_id === classId)) {
          await post({
            action: 'assign_leaderboard_activity',
            activity_id: activityId,
            class_type_id: classId,
          });
        }
      }
    }
    toast.success('Activity saved');
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this activity from the gym board?')) return;
    await post({ action: 'delete', entity: 'leaderboard_activities', id });
    if (editingId === id) startNew();
    toast.success('Activity removed');
  };

  const previewActivity = editing;
  const previewRows =
    store && previewActivity
      ? buildGymBoardRows(store, previewActivity, {
          sex: previewSex,
          age: null,
          band_id: previewBand,
          band_label:
            GYM_BOARD_AGE_BANDS.find((b) => b.id === previewBand)?.label ||
            null,
          need_profile: false,
        })
      : [];

  return (
    <FitgraphWorkbench
      title="Leadership"
      titleAccent="board"
      description="Set the gym’s official activities and benchmark scores for men and women in each age group. Coaches pin these on classes; members log scores in the PWA and see rank in their own category."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="owner"
            items={[
              { label: 'Activities', value: activities.length },
              {
                label: 'On classes',
                value: (store.leaderboard_assignments || []).length,
              },
              {
                label: 'Scores logged',
                value: (store.leaderboard_scores || []).length,
              },
            ]}
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
            <div className="space-y-2">
              <button
                type="button"
                className="btn-primary !py-2 !px-3 text-xs w-full"
                onClick={startNew}
              >
                New activity
              </button>
              {activities.length ? (
                <ul className="space-y-1">
                  {activities.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => startEdit(a.id)}
                        className={`w-full rounded-2xl border px-3 py-2.5 text-left text-sm ${
                          editingId === a.id
                            ? 'border-yellow-400 bg-yellow-50'
                            : 'border-slate-200 bg-white hover:border-yellow-300'
                        }`}
                      >
                        <span className="font-black text-slate-900">{a.name}</span>
                        <span className="block text-[11px] text-slate-500">
                          {a.win === 'faster' ? 'Fastest wins' : 'Highest wins'} ·{' '}
                          {a.unit} · {a.benchmarks.length} benchmarks
                          {a.source === 'coach' ? ' · coach extra' : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-sm text-slate-500 text-center">
                  No activities yet. Add squat, run, Hyrox stations — then fill
                  men and women scores per age group.
                </p>
              )}
            </div>

            <div className={card}>
              <h3 className="text-sm font-black text-slate-900">
                {editingId ? 'Edit activity' : 'New activity'}
              </h3>
              <p className="text-[11px] text-slate-600">
                Benchmarks are the gym standard for that age and sex. Leave a
                cell blank if you do not set one yet.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Activity name
                  <input
                    className={`${input} mt-1 normal-case font-medium tracking-normal`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Back squat 5RM"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Unit
                    <select
                      className={`${input} mt-1`}
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    >
                      {GYM_BOARD_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Win
                    <select
                      className={`${input} mt-1`}
                      value={win}
                      onChange={(e) =>
                        setWin(e.target.value === 'faster' ? 'faster' : 'higher')
                      }
                    >
                      <option value="higher">Highest</option>
                      <option value="faster">Fastest</option>
                    </select>
                  </label>
                </div>
              </div>
              {(store.class_types || []).filter((c) => c.active !== false)
                .length ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Pin to classes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(store.class_types || [])
                      .filter((c) => c.active !== false)
                      .map((c) => {
                        const on = classPins.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() =>
                              setClassPins((ids) =>
                                on
                                  ? ids.filter((x) => x !== c.id)
                                  : [...ids, c.id]
                              )
                            }
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                              on
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ) : null}
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Notes
                <input
                  className={`${input} mt-1 normal-case font-medium tracking-normal`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Rx, no belt, etc."
                />
              </label>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="bg-yellow-50 text-[10px] font-black uppercase tracking-wider text-yellow-900">
                    <tr>
                      <th className="px-3 py-2 text-left">Age group</th>
                      <th className="px-3 py-2 text-left">Men</th>
                      <th className="px-3 py-2 text-left">Women</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {GYM_BOARD_AGE_BANDS.map((band) => (
                      <tr key={band.id}>
                        <td className="px-3 py-2 font-semibold text-slate-800">
                          {band.label}
                        </td>
                        {(['male', 'female'] as const).map((sex) => (
                          <td key={sex} className="px-3 py-1.5">
                            <input
                              className="input !py-1.5 !px-2 !text-sm w-full"
                              placeholder={win === 'faster' ? '2:30' : '140'}
                              value={marks[`${sex}:${band.id}`] || ''}
                              onChange={(e) =>
                                setMarks((m) => ({
                                  ...m,
                                  [`${sex}:${band.id}`]: e.target.value,
                                }))
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {editingId ? (
                  <button
                    type="button"
                    className="btn-secondary !py-2 !px-3 text-xs text-rose-700"
                    onClick={() => void remove(editingId)}
                  >
                    Remove
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={saving || !name.trim()}
                  className="btn-primary !py-2 !px-4 text-xs"
                  onClick={() => void save()}
                >
                  {saving ? 'Saving…' : 'Save activity'}
                </button>
              </div>
            </div>
          </div>

          {previewActivity ? (
            <div className={card}>
              <h3 className="text-sm font-black text-slate-900">
                Live board · {previewActivity.name}
              </h3>
              <p className="text-[11px] text-slate-600">
                Members are ranked in their own age group and sex. The PWA
                picks that automatically from birthday and passport.
              </p>
              <div className="flex flex-wrap gap-2">
                {(['male', 'female'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPreviewSex(s)}
                    className={`rounded-full px-3 py-1 text-xs font-black ${
                      previewSex === s
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {s === 'male' ? 'Men' : 'Women'}
                  </button>
                ))}
                <select
                  className="input !py-1 !px-2 !text-xs"
                  value={previewBand}
                  onChange={(e) =>
                    setPreviewBand(e.target.value as GymBoardAgeBandId)
                  }
                >
                  {GYM_BOARD_AGE_BANDS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              {previewRows.length ? (
                <ol className="mt-3 space-y-1">
                  {previewRows.map((r) => (
                    <li
                      key={r.client_id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm"
                    >
                      <span className="font-semibold">
                        <span className="tabular-nums text-slate-400 mr-2">
                          {r.rank}
                        </span>
                        {r.name}
                      </span>
                      <span className="font-black tabular-nums">
                        {r.display}
                        {r.pct != null ? (
                          <span className="ml-2 text-[11px] font-semibold text-slate-500">
                            {r.pct}% of bench
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No scores in this category yet. Coaches add the activity to a
                  class; members log from the PWA.
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </FitgraphWorkbench>
  );
}
