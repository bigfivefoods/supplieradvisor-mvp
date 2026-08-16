'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  MOVEMENT_CATEGORY_META,
  isSystemMovement,
} from '@/lib/fitness/movement-catalog';
import type { FitMovement } from '@/lib/fitness/movements';
import { videoEmbedSrc } from '@/lib/fitness/movements';
import { movementDisplayDescription } from '@/lib/fitness/movement-art';
import { MovementThumb } from '@/components/fitness/MovementThumb';
import { MovementImageReplace } from '@/components/fitness/MovementImageReplace';

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
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements
      .filter((m) => m.active !== false)
      .filter((m) => (category === 'All' ? true : m.category === category))
      .filter((m) => {
        if (!q) return true;
        const blob = [
          m.name,
          m.category,
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
  }, [movements, query, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, FitMovement[]>();
    for (const m of filtered) {
      const key = m.category || 'Other';
      const list = map.get(key) || [];
      list.push(m);
      map.set(key, list);
    }
    const order = MOVEMENT_CATEGORY_META.map((c) => c.id);
    return order
      .filter((id) => map.has(id))
      .map((id) => ({
        id,
        hint: MOVEMENT_CATEGORY_META.find((c) => c.id === id)?.hint || '',
        items: map.get(id) || [],
      }));
  }, [filtered]);

  const open = movements.find((m) => m.id === openId) || null;
  const embed = videoEmbedSrc(open?.video_url);

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
    : 'rounded-2xl border border-yellow-200 bg-white text-left hover:border-yellow-400 dark:border-yellow-800 dark:bg-yellow-950/40';

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className={
            dark
              ? 'w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm'
              : 'w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm dark:border-yellow-700 dark:bg-yellow-950'
          }
          placeholder="Search movements, muscles, equipment…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={chip(category === 'All')}
          onClick={() => setCategory('All')}
        >
          All ({movements.filter((m) => m.active !== false).length})
        </button>
        {MOVEMENT_CATEGORY_META.map((c) => {
          const n = movements.filter(
            (m) => m.active !== false && m.category === c.id
          ).length;
          if (!n && c.id === 'Other') return null;
          return (
            <button
              key={c.id}
              type="button"
              className={chip(category === c.id)}
              onClick={() => setCategory(c.id)}
              title={c.hint}
            >
              {c.id} ({n})
            </button>
          );
        })}
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
                  onClick={() => setOpenId(m.id)}
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
                      <p className="font-bold text-sm">{m.name}</p>
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
                : 'w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl border border-yellow-200 bg-white p-5 space-y-3 dark:border-yellow-700 dark:bg-yellow-950'
            }
          >
            <div className="flex justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  {open.category}
                  {open.level
                    ? ` · ${LEVEL_LABEL[open.level] || open.level}`
                    : ''}
                  {isSystemMovement(open) ? ' · Catalog' : ' · Custom'}
                </p>
                <h3 className="text-lg font-black">{open.name}</h3>
              </div>
              <button type="button" onClick={() => setOpenId(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
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
                        Equipment
                      </dt>
                      <dd>{open.equipment || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase text-slate-500">
                        Muscles
                      </dt>
                      <dd>{open.muscles || '—'}</dd>
                    </div>
                  </dl>
                  <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-700">
                    <MovementThumb
                      large
                      name={open.name}
                      category={open.category}
                      code={open.code || open.id}
                      imageUrl={open.image_url}
                      muscles={open.muscles}
                      equipment={open.equipment}
                    />
                  </div>
                  {onSaveImage ? (
                    <MovementImageReplace
                      dark={dark}
                      companyId={companyId}
                      uploadFile={uploadFile}
                      hasCustomImage={Boolean(open.image_url)}
                      onReplace={async (url) => {
                        await onSaveImage?.(open, url);
                      }}
                    />
                  ) : null}
                </>
              );
            })()}
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
                  className="h-48 w-full rounded-xl bg-black object-contain"
                  controls
                />
              )
            ) : null}
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
