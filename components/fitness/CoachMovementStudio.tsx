'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { MovementMediaFields } from '@/components/fitness/MovementMediaFields';
import { ProgrammeView } from '@/components/fitness/ProgrammeView';
import { MovementLibraryBrowse } from '@/components/fitness/MovementLibraryBrowse';
import { isSystemMovement } from '@/lib/fitness/movement-catalog';
import {
  MOVEMENT_CATEGORIES,
  hydrateProgramme,
  programmeKindLabel,
  type FitMovement,
  type FitProgramme,
  type FitProgrammeItem,
  type FitProgrammeKind,
} from '@/lib/fitness/movements';

type ClassType = { id: string; name: string; code?: string };
type SessionLite = {
  id: string;
  date: string;
  start_time: string;
  class_type_id?: string;
};

export function CoachMovementStudio({
  token,
  coachId,
  movements,
  programmes,
  classTypes,
  sessions,
  focusSessionId,
  onClose,
  onChanged,
}: {
  token: string;
  coachId: string;
  movements: FitMovement[];
  programmes: FitProgramme[];
  classTypes: ClassType[];
  sessions: SessionLite[];
  focusSessionId?: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<'movements' | 'programmes'>(
    focusSessionId ? 'programmes' : 'movements'
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [movForm, setMovForm] = useState({
    id: '' as string,
    name: '',
    category: 'Other',
    equipment: '',
    muscles: '',
    overview: '',
    details: '',
    video_description: '',
    image_url: '',
    video_url: '',
  });
  const [prgForm, setPrgForm] = useState({
    id: '' as string,
    name: '',
    description: '',
    kind: 'class' as FitProgrammeKind,
    class_type_ids: [] as string[],
    session_ids: (focusSessionId ? [focusSessionId] : []) as string[],
    personal_for_coach: false,
    items: [] as FitProgrammeItem[],
  });
  const [addMovementId, setAddMovementId] = useState('');

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/public/fitgraph/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onChanged();
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed';
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async (file: File) => {
    const fd = new FormData();
    fd.set('token', token);
    fd.set('action', 'upload_movement_media');
    fd.set('file', file);
    const res = await fetch('/api/public/fitgraph/coach', {
      method: 'POST',
      body: fd,
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'Upload failed');
    }
    return String(data.url);
  };

  const saveMovement = async () => {
    if (!movForm.name.trim()) {
      setError('Name required');
      return;
    }
    await post({
      action: 'upsert_movement',
      record: {
        ...(movForm.id ? { id: movForm.id } : {}),
        name: movForm.name.trim(),
        category: movForm.category,
        equipment: movForm.equipment.trim() || undefined,
        muscles: movForm.muscles.trim() || undefined,
        overview: movForm.overview.trim() || undefined,
        details: movForm.details.trim() || undefined,
        description: movForm.details.trim() || movForm.overview.trim() || undefined,
        video_description: movForm.video_description.trim() || undefined,
        image_url: movForm.image_url || null,
        video_url: movForm.video_url || null,
        coach_id: coachId,
      },
    });
    setMovForm({
      id: '',
      name: '',
      category: 'Other',
      equipment: '',
      muscles: '',
      overview: '',
      details: '',
      video_description: '',
      image_url: '',
      video_url: '',
    });
    setShowAdd(false);
  };

  const saveProgramme = async () => {
    if (!prgForm.name.trim()) {
      setError('Programme name required');
      return;
    }
    if (!prgForm.items.length) {
      setError('Add at least one movement');
      return;
    }
    await post({
      action: 'upsert_programme',
      record: {
        ...(prgForm.id ? { id: prgForm.id } : {}),
        name: prgForm.name.trim(),
        description: prgForm.description.trim() || undefined,
        kind: prgForm.kind,
        class_type_ids: prgForm.class_type_ids,
        session_ids: prgForm.session_ids,
        personal_for_coach:
          prgForm.kind !== 'class' && prgForm.personal_for_coach,
        items: prgForm.items.map((it, i) => ({ ...it, sort: i })),
        coach_id: coachId,
      },
    });
    setPrgForm({
      id: '',
      name: '',
      description: '',
      kind: 'class',
      class_type_ids: [],
      session_ids: [],
      personal_for_coach: false,
      items: [],
    });
  };

  const preview = useMemo(
    () =>
      hydrateProgramme(
        {
          id: prgForm.id || 'preview',
          name: prgForm.name || 'Programme',
          description: prgForm.description,
          coach_id: coachId,
          kind: prgForm.kind,
          class_type_ids: prgForm.class_type_ids,
          session_ids: prgForm.session_ids,
          personal_for_coach: prgForm.personal_for_coach,
          items: prgForm.items,
          created_at: '',
        },
        movements
      ),
    [prgForm, coachId, movements]
  );

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-2xl max-h-[94dvh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 space-y-4">
        <div className="flex justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">
              Coach library
            </p>
            <h3 className="text-lg font-black">Movements & programmes</h3>
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-950 p-1">
          {(['movements', 'programmes'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`flex-1 rounded-lg py-1.5 text-xs font-black ${
                tab === t ? 'bg-amber-500 text-amber-950' : 'text-slate-400'
              }`}
              onClick={() => setTab(t)}
            >
              {t === 'movements' ? 'Movements' : 'Programmes'}
            </button>
          ))}
        </div>
        {error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : null}

        {tab === 'movements' ? (
          <div className="space-y-3">
            <MovementLibraryBrowse
              dark
              movements={movements}
              uploadFile={uploadFile}
              onSaveImage={async (m, url) => {
                await post({
                  action: 'update_movement_media',
                  id: m.id,
                  image_url: url,
                });
              }}
              onUse={(m) => {
                setTab('programmes');
                setPrgForm((f) => ({
                  ...f,
                  items: [
                    ...f.items,
                    {
                      id: `itm_${Date.now().toString(36)}`,
                      movement_id: m.id,
                      sets: 3,
                      reps: '8-10',
                      rest_sec: 60,
                      sort: f.items.length,
                    },
                  ],
                }));
              }}
              onEdit={(m) => {
                if (isSystemMovement(m)) return;
                setShowAdd(true);
                setMovForm({
                  id: m.id,
                  name: m.name,
                  category: m.category || 'Other',
                  equipment: m.equipment || '',
                  muscles: m.muscles || '',
                  overview: m.overview || '',
                  details: m.details || m.description || '',
                  video_description: m.video_description || '',
                  image_url: m.image_url || '',
                  video_url: m.video_url || '',
                });
              }}
              onDelete={(m) => {
                if (isSystemMovement(m)) return;
                void post({ action: 'delete_movement', id: m.id });
              }}
            />
            {!showAdd ? (
              <button
                type="button"
                className="w-full rounded-xl border border-amber-500/50 py-2 text-xs font-black text-amber-200"
                onClick={() => {
                  setMovForm({
                    id: '',
                    name: '',
                    category: 'Other',
                    equipment: '',
                    muscles: '',
                    overview: '',
                    details: '',
                    video_description: '',
                    image_url: '',
                    video_url: '',
                  });
                  setShowAdd(true);
                }}
              >
                + Add your own movement
              </button>
            ) : (
              <div className="space-y-2 rounded-2xl border border-slate-700 p-3">
                <p className="text-[10px] font-black uppercase text-amber-400">
                  {movForm.id ? 'Edit your movement' : 'Your movement'}
                </p>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Movement name"
                  value={movForm.name}
                  onChange={(e) =>
                    setMovForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={movForm.category}
                    onChange={(e) =>
                      setMovForm((f) => ({ ...f, category: e.target.value }))
                    }
                  >
                    {MOVEMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    placeholder="Equipment"
                    value={movForm.equipment}
                    onChange={(e) =>
                      setMovForm((f) => ({ ...f, equipment: e.target.value }))
                    }
                  />
                </div>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Primary muscles"
                  value={movForm.muscles}
                  onChange={(e) =>
                    setMovForm((f) => ({ ...f, muscles: e.target.value }))
                  }
                />
                <textarea
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[2.5rem] resize-y"
                  placeholder="Overview — one or two sentences"
                  value={movForm.overview}
                  onChange={(e) =>
                    setMovForm((f) => ({ ...f, overview: e.target.value }))
                  }
                />
                <textarea
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[4rem] resize-y"
                  placeholder="Details — setup, cues, faults, how to scale"
                  value={movForm.details}
                  onChange={(e) =>
                    setMovForm((f) => ({ ...f, details: e.target.value }))
                  }
                />
                <MovementMediaFields
                  dark
                  uploadFile={uploadFile}
                  imageUrl={movForm.image_url}
                  videoUrl={movForm.video_url}
                  videoDescription={movForm.video_description}
                  onChange={(patch) =>
                    setMovForm((f) => ({
                      ...f,
                      image_url: patch.image_url ?? f.image_url,
                      video_url: patch.video_url ?? f.video_url,
                      video_description:
                        patch.video_description ?? f.video_description,
                    }))
                  }
                />
                <button
                  type="button"
                  disabled={busy}
                  className="w-full rounded-xl bg-amber-500 text-amber-950 py-2.5 text-sm font-black"
                  onClick={() => void saveMovement()}
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin inline" />
                  ) : null}{' '}
                  {movForm.id ? 'Save movement' : 'Add to my library'}
                </button>
                <button
                  type="button"
                  className="text-[11px] font-bold text-slate-400"
                  onClick={() => setShowAdd(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Programme name"
              value={prgForm.name}
              onChange={(e) =>
                setPrgForm((f) => ({ ...f, name: e.target.value }))
              }
            />
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={prgForm.kind}
              onChange={(e) =>
                setPrgForm((f) => ({
                  ...f,
                  kind: e.target.value as FitProgrammeKind,
                }))
              }
            >
              <option value="class">Class programme</option>
              <option value="personal_pt">My personal training</option>
              <option value="both">Class + personal</option>
            </select>
            <textarea
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[3rem] resize-y"
              placeholder="What this programme is for"
              value={prgForm.description}
              onChange={(e) =>
                setPrgForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <ul className="space-y-2">
              {prgForm.items.map((it, idx) => {
                const mv = movements.find((m) => m.id === it.movement_id);
                return (
                  <li
                    key={it.id}
                    className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700 p-2"
                  >
                    <p className="col-span-2 text-sm font-bold">
                      {idx + 1}. {mv?.name || 'Removed'}
                    </p>
                    <input
                      className="rounded-xl border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                      type="number"
                      placeholder="Sets"
                      value={it.sets ?? ''}
                      onChange={(e) =>
                        setPrgForm((f) => ({
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
                      className="rounded-xl border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                      placeholder="Reps"
                      value={it.reps || ''}
                      onChange={(e) =>
                        setPrgForm((f) => ({
                          ...f,
                          items: f.items.map((x) =>
                            x.id === it.id
                              ? { ...x, reps: e.target.value }
                              : x
                          ),
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="col-span-2 text-left text-[11px] font-bold text-rose-300"
                      onClick={() =>
                        setPrgForm((f) => ({
                          ...f,
                          items: f.items.filter((x) => x.id !== it.id),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2">
              <select
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={addMovementId}
                onChange={(e) => setAddMovementId(e.target.value)}
              >
                <option value="">Add movement…</option>
                {movements.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-xl bg-amber-500 text-amber-950 px-3 py-2 text-xs font-black inline-flex items-center gap-1"
                onClick={() => {
                  if (!addMovementId) return;
                  setPrgForm((f) => ({
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
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {prgForm.kind !== 'personal_pt' ? (
              <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-700 divide-y divide-slate-800">
                {classTypes.map((c) => {
                  const on = prgForm.class_type_ids.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setPrgForm((f) => ({
                            ...f,
                            class_type_ids: on
                              ? f.class_type_ids.filter((x) => x !== c.id)
                              : [...f.class_type_ids, c.id],
                          }))
                        }
                      />
                      Class type: {c.name}
                    </label>
                  );
                })}
              </div>
            ) : null}
            <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-700 divide-y divide-slate-800">
              {sessions.slice(0, 20).map((s) => {
                const on = prgForm.session_ids.includes(s.id);
                const ct = classTypes.find((c) => c.id === s.class_type_id);
                return (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setPrgForm((f) => ({
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
              })}
            </div>
            {prgForm.kind !== 'class' ? (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={prgForm.personal_for_coach}
                  onChange={(e) =>
                    setPrgForm((f) => ({
                      ...f,
                      personal_for_coach: e.target.checked,
                    }))
                  }
                />
                Use as my own personal training programme
              </label>
            ) : null}
            {prgForm.items.length ? (
              <ProgrammeView programme={preview} dark compact />
            ) : null}
            <button
              type="button"
              disabled={busy}
              className="w-full rounded-xl bg-amber-500 text-amber-950 py-2.5 text-sm font-black"
              onClick={() => void saveProgramme()}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : null}{' '}
              {prgForm.id ? 'Save programme' : 'Save programme'}
            </button>
            <ul className="space-y-1.5">
              {programmes.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-700 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-bold">{p.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {programmeKindLabel(p.kind)} · {(p.items || []).length}{' '}
                      moves
                      {p.personal_for_coach ? ' · own PT' : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="text-[11px] font-bold text-amber-300"
                      onClick={() =>
                        setPrgForm({
                          id: p.id,
                          name: p.name,
                          description: p.description || '',
                          kind: p.kind,
                          class_type_ids: [...(p.class_type_ids || [])],
                          session_ids: [...(p.session_ids || [])],
                          personal_for_coach: p.personal_for_coach === true,
                          items: [...(p.items || [])],
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-rose-300"
                      onClick={() =>
                        void post({
                          action: 'delete_programme',
                          id: p.id,
                        })
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
