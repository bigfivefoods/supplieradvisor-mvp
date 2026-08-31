'use client';

import { videoEmbedSrc, type FitHydratedProgramme } from '@/lib/fitness/movements';
import { MovementThumb } from '@/components/fitness/MovementThumb';
import { ProgrammeCalendarGrid } from '@/components/fitness/ProgrammeCalendarGrid';

export function ProgrammeView({
  programme,
  compact,
  dark,
}: {
  programme: FitHydratedProgramme;
  compact?: boolean;
  dark?: boolean;
}) {
  const card = dark
    ? 'rounded-xl border border-slate-700 bg-slate-950/50 p-3 space-y-2'
    : 'rounded-xl border border-slate-200 bg-white p-3 space-y-2 text-slate-900 dark:border-white/15 dark:bg-neutral-900 dark:text-white';
  const blocks = programme.blocks || [];
  const showCal = !compact && blocks.length > 1;
  return (
    <div className={card}>
      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          Programme
          {programme.weeks ? ` · ${programme.weeks} weeks` : ''}
        </p>
        <p className="font-bold text-sm">{programme.name}</p>
        {programme.description ? (
          <p className="text-[11px] text-slate-500 mt-0.5">
            {programme.description}
          </p>
        ) : null}
        {programme.follow_notes && !compact ? (
          <p className="text-[11px] text-slate-500 mt-0.5">
            {programme.follow_notes}
          </p>
        ) : null}
      </div>
      {showCal ? (
        <ProgrammeCalendarGrid
          weeks={programme.weeks || 1}
          blocks={blocks}
          movements={blocks.flatMap((b) =>
            b.items
              .map((it) => it.movement)
              .filter((m): m is NonNullable<typeof m> => Boolean(m))
          )}
          mode="view"
        />
      ) : null}
      <ol className="space-y-2">
        {programme.items.map((it, i) => {
          const mv = it.movement;
          const embed = !compact ? videoEmbedSrc(mv?.video_url) : null;
          return (
            <li
              key={it.id}
              className="flex gap-2 rounded-lg border border-slate-200/70 p-2 dark:border-slate-700"
            >
              <div className="h-12 w-12 rounded-md overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
                {mv ? (
                  <MovementThumb
                    name={mv.name}
                    category={mv.category}
                    code={mv.code || mv.id}
                    imageUrl={mv.image_url}
                    muscles={mv.muscles}
                    equipment={mv.equipment}
                    className="!h-12"
                  />
                ) : (
                  <div className="h-12 w-12 text-[11px] font-black flex items-center justify-center">
                    {i + 1}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">
                  {mv?.name || 'Movement removed'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {[
                    it.sets ? `${it.sets} sets` : null,
                    it.reps ? `${it.reps} reps` : null,
                    it.rest_sec != null ? `${it.rest_sec}s rest` : null,
                    it.tempo ? `tempo ${it.tempo}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'As prescribed'}
                </p>
                {it.notes ? (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {it.notes}
                  </p>
                ) : null}
                {!compact && (mv?.overview || mv?.description) ? (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {mv.overview || mv.description}
                  </p>
                ) : null}
                {!compact && mv?.video_description ? (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Video: {mv.video_description}
                  </p>
                ) : null}
                {embed ? (
                  embed.iframe ? (
                    <iframe
                      title={mv?.name || 'Video'}
                      src={embed.src}
                      className="mt-2 h-36 w-full rounded-lg"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={embed.src}
                      className="mt-2 h-36 w-full rounded-lg bg-black object-contain"
                      controls
                    />
                  )
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
