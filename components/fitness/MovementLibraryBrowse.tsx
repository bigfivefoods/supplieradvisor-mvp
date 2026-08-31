'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  MOVEMENT_CATEGORY_META,
  isSystemMovement,
  resolveFitMovementMedia,
} from '@/lib/fitness/movement-catalog';
import type { FitMovement } from '@/lib/fitness/movements';
import { videoEmbedSrc } from '@/lib/fitness/movements';
import { movementDisplayDescription } from '@/lib/fitness/movement-art';
import { MovementThumb } from '@/components/fitness/MovementThumb';
import { MovementMediaFields } from '@/components/fitness/MovementMediaFields';
import { GymPwaSheet } from '@/components/fitness/GymPwaSheet';
import { gymPwaFieldClass } from '@/lib/fitness/gym-pwa-theme';
import {
  EXERCISE_MODALITIES,
  EXERCISE_MUSCLE_GROUPS,
  EXERCISE_PATTERNS,
  EXERCISE_SCORING,
} from '@/lib/movements/exercise-catalog';

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export function MovementLibraryBrowse({
  movements,
  dark,
  onUse,
  onEdit,
  onDelete,
  allowSystemEdit,
  companyId,
  uploadFile,
  onSaveImage,
  onSaveVideo,
  onMovementDrillIn,
  onMovementBack,
}: {
  movements: FitMovement[];
  dark?: boolean;
  onUse?: (m: FitMovement) => void;
  onEdit?: (m: FitMovement) => void;
  onDelete?: (m: FitMovement) => void;
  /** Desk can attach media / notes to catalog items */
  allowSystemEdit?: boolean;
  companyId?: number;
  uploadFile?: (file: File) => Promise<string>;
  onSaveImage?: (m: FitMovement, url: string | null) => Promise<void> | void;
  onSaveVideo?: (m: FitMovement, url: string | null) => Promise<void> | void;
  onMovementDrillIn?: () => void;
  onMovementBack?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [modality, setModality] = useState('All');
  const [muscle, setMuscle] = useState('All');
  const [pattern, setPattern] = useState('All');
  const [scoring, setScoring] = useState('All');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements
      .filter((m) => m.active !== false)
      .filter((m) => (category === 'All' ? true : m.category === category))
      .filter((m) =>
        modality === 'All' ? true : m.modality === modality
      )
      .filter((m) =>
        muscle === 'All'
          ? true
          : m.muscle_group === muscle || m.muscles === muscle
      )
      .filter((m) =>
        pattern === 'All' ? true : m.movement_pattern === pattern
      )
      .filter((m) => (scoring === 'All' ? true : m.scoring === scoring))
      .filter((m) => {
        if (!q) return true;
        const blob = [
          m.name,
          m.category,
          m.modality,
          m.muscle_group,
          m.movement_pattern,
          m.scoring,
          m.equipment,
          m.muscles,
          m.overview,
          m.details,
          m.description,
        ]
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [movements, query, category, modality, muscle, pattern, scoring]);

  const narrowed =
    category !== 'All' ||
    modality !== 'All' ||
    muscle !== 'All' ||
    pattern !== 'All' ||
    scoring !== 'All' ||
    query.trim().length > 0;
  const visibleCap = narrowed ? 800 : 200;

  const categoryChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of movements) {
      if (m.active === false) continue;
      const key = String(m.category || 'Other');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const preferred = MOVEMENT_CATEGORY_META.map((c) => c.id);
    const rest = [...counts.keys()]
      .filter((k) => !preferred.includes(k) && k !== 'Other')
      .sort((a, b) => a.localeCompare(b));
    return [...preferred, ...rest, 'Other']
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .filter((id) => (counts.get(id) || 0) > 0)
      .map((id) => ({
        id,
        n: counts.get(id) || 0,
        hint: MOVEMENT_CATEGORY_META.find((c) => c.id === id)?.hint,
      }));
  }, [movements]);

  const grouped = useMemo(() => {
    const visible = filtered.slice(0, visibleCap);
    const map = new Map<string, FitMovement[]>();
    for (const m of visible) {
      const key = m.muscle_group || m.category || 'Other';
      const list = map.get(key) || [];
      list.push(m);
      map.set(key, list);
    }
    const order = [
      ...EXERCISE_MUSCLE_GROUPS,
      ...MOVEMENT_CATEGORY_META.map((c) => c.id),
      'Other',
    ];
    const keys = [
      ...order.filter((id) => map.has(id)),
      ...[...map.keys()]
        .filter((k) => !order.includes(k as (typeof order)[number]))
        .sort((a, b) => a.localeCompare(b)),
    ];
    return keys.map((id) => ({
      id,
      hint: `${(map.get(id) || []).length} shown`,
      items: map.get(id) || [],
    }));
  }, [filtered, visibleCap]);

  const open = movements.find((m) => m.id === openId) || null;
  const openMedia = open
    ? resolveFitMovementMedia({
        name: open.name,
        category: open.category,
        movement_pattern: open.movement_pattern,
        image_url: open.image_url,
        video_url: open.video_url,
      })
    : null;
  const embed = videoEmbedSrc(openMedia?.video_url || open?.video_url);

  const chip = (active: boolean) =>
    dark
      ? `rounded-full px-2.5 py-1 text-[11px] font-bold border ${
          active
            ? 'bg-amber-500 text-amber-950 border-amber-500'
            : 'border-slate-600 text-slate-300'
        }`
      : `rounded-full px-2.5 py-1 text-[11px] font-bold border ${
          active
            ? 'bg-yellow-400 text-yellow-950 border-yellow-400'
            : 'border-slate-200 text-slate-600 dark:border-yellow-800 dark:text-yellow-200'
        }`;

  const card = dark
    ? 'rounded-2xl border border-slate-700 bg-slate-950/60 text-left hover:border-amber-500/60'
    : 'rounded-2xl border border-slate-200 bg-white text-left hover:border-slate-300 dark:border-white/15 dark:bg-neutral-900';

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className={
            dark
              ? 'w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm'
              : `${gymPwaFieldClass} pl-9 pr-3`
          }
          placeholder="Search movements, muscles, equipment…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <select
          className={
            dark
              ? 'rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-xs'
              : `${gymPwaFieldClass} px-2 text-xs`
          }
          value={modality}
          onChange={(e) => setModality(e.target.value)}
        >
          <option value="All">Modality · all</option>
          {EXERCISE_MODALITIES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          className={
            dark
              ? 'rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-xs'
              : `${gymPwaFieldClass} px-2 text-xs`
          }
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="All">Muscle group · all</option>
          {EXERCISE_MUSCLE_GROUPS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          className={
            dark
              ? 'rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-xs'
              : `${gymPwaFieldClass} px-2 text-xs`
          }
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
        >
          <option value="All">Pattern · all</option>
          {EXERCISE_PATTERNS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          className={
            dark
              ? 'rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-xs'
              : `${gymPwaFieldClass} px-2 text-xs`
          }
          value={scoring}
          onChange={(e) => setScoring(e.target.value)}
        >
          <option value="All">Category · all</option>
          {EXERCISE_SCORING.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {filtered.length > visibleCap ? (
        <p className="text-[11px] text-slate-500">
          Showing {visibleCap} of {filtered.length}. Search or pick a category
          to see the rest.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={chip(category === 'All')}
          onClick={() => setCategory('All')}
        >
          All ({movements.filter((m) => m.active !== false).length})
        </button>
        {categoryChips.map((c) => (
          <button
            key={c.id}
            type="button"
            className={chip(category === c.id)}
            onClick={() => setCategory(c.id)}
            title={c.hint}
          >
            {c.id} ({c.n})
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          No movements match that search.
        </p>
      ) : (
        grouped.map((g) => (
          <section key={g.id} className="space-y-2">
            <div>
              <h3
                className={
                  dark
                    ? 'text-sm font-black text-amber-200'
                    : 'text-sm font-black text-slate-800 dark:text-yellow-100'
                }
              >
                {g.id}
              </h3>
              <p className="text-[11px] text-slate-500">{g.hint}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={card + ' overflow-hidden p-0'}
                  onClick={() => {
                    setOpenId(m.id);
                    onMovementDrillIn?.();
                  }}
                >
                  <MovementThumb
                    name={m.name}
                    category={m.category}
                    code={m.code || m.id}
                    imageUrl={m.image_url}
                    muscles={m.muscles}
                    equipment={m.equipment}
                  />
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{m.name}</p>
                      <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">
                        {LEVEL_LABEL[String(m.level || '')] || m.level || ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-3">
                      {movementDisplayDescription(m).overview}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      {m.equipment || 'No equipment'}
                      {isSystemMovement(m) ? ' · Catalog' : ' · Custom'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {open ? (
        <div
          className="fixed inset-0 z-[95] bg-black/60 flex items-end sm:items-center justify-center p-3"
          role="dialog"
          aria-modal="true"
        >
          <div
            className={
              dark
                ? 'w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 space-y-3'
                : 'w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 space-y-3 dark:border-white/15 dark:bg-neutral-900'
            }
          >
            <GymPwaSheet
              title={open.name}
              onBack={() => {
                setOpenId(null);
                onMovementBack?.();
              }}
              onClose={() => {
                setOpenId(null);
                onMovementBack?.();
              }}
            />
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              {open.category}
              {open.level ? ` · ${LEVEL_LABEL[open.level] || open.level}` : ''}
              {isSystemMovement(open) ? ' · Catalog' : ' · Custom'}
            </p>
            {(() => {
              const copy = movementDisplayDescription(open);
              return (
                <>
                  {copy.overview ? (
                    <p className="text-sm font-medium">{copy.overview}</p>
                  ) : null}
                  <dl className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <dt className="font-black uppercase text-slate-500">
                        Modality
                      </dt>
                      <dd>{open.modality || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase text-slate-500">
                        Muscle group
                      </dt>
                      <dd>{open.muscle_group || open.muscles || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase text-slate-500">
                        Pattern
                      </dt>
                      <dd>{open.movement_pattern || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase text-slate-500">
                        Category
                      </dt>
                      <dd>{open.scoring || open.category || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase text-slate-500">
                        Equipment
                      </dt>
                      <dd>{open.equipment || '—'}</dd>
                    </div>
                  </dl>
                  <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-700">
                    <MovementThumb
                      large
                      name={open.name}
                      category={open.category}
                      code={open.code || open.id}
                      imageUrl={openMedia?.image_url || open.image_url}
                      muscles={open.muscles}
                      equipment={open.equipment}
                    />
                  </div>
                  {embed ? (
                    embed.iframe ? (
                      <iframe
                        title={open.name}
                        src={embed.src}
                        className="h-48 w-full rounded-xl"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={embed.src}
                        className="h-48 w-full rounded-xl bg-black object-cover"
                        controls
                        muted
                        loop
                        playsInline
                      />
                    )
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      5-second clip will appear here once generated. You can
                      upload your own now.
                    </p>
                  )}
                  {onSaveImage || onSaveVideo ? (
                    <MovementMediaFields
                      companyId={companyId}
                      uploadFile={uploadFile}
                      imageUrl={open.image_url || ''}
                      videoUrl={open.video_url || ''}
                      videoDescription={open.video_description || ''}
                      onChange={(patch) => {
                        if (patch.image_url !== undefined) {
                          void onSaveImage?.(open, patch.image_url || null);
                        }
                        if (patch.video_url !== undefined) {
                          void onSaveVideo?.(open, patch.video_url || null);
                        }
                      }}
                      dark={dark}
                    />
                  ) : null}
                </>
              );
            })()}
            {open.video_description ? (
              <p className="text-[12px] text-slate-500">
                Video: {open.video_description}
              </p>
            ) : null}
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 mb-1">
                Details
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {movementDisplayDescription(open).details ||
                  'No extra notes yet.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {onUse ? (
                <button
                  type="button"
                  className={
                    dark
                      ? 'rounded-xl bg-amber-500 text-amber-950 px-3 py-2 text-xs font-black'
                      : 'rounded-xl bg-yellow-400 text-yellow-950 px-3 py-2 text-xs font-black'
                  }
                  onClick={() => {
                    onUse(open);
                    setOpenId(null);
                  }}
                >
                  Add to programme
                </button>
              ) : null}
              {onEdit && !isSystemMovement(open) ? (
                <button
                  type="button"
                  className="rounded-xl border px-3 py-2 text-xs font-bold"
                  onClick={() => {
                    onEdit(open);
                    setOpenId(null);
                  }}
                >
                  Edit
                </button>
              ) : null}
              {onEdit && allowSystemEdit && isSystemMovement(open) ? (
                <button
                  type="button"
                  className="rounded-xl border px-3 py-2 text-xs font-bold"
                  onClick={() => {
                    onEdit(open);
                    setOpenId(null);
                  }}
                >
                  Customise media
                </button>
              ) : null}
              {onDelete && !isSystemMovement(open) ? (
                <button
                  type="button"
                  className="rounded-xl border border-rose-300 text-rose-700 px-3 py-2 text-xs font-bold"
                  onClick={() => {
                    onDelete(open);
                    setOpenId(null);
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
