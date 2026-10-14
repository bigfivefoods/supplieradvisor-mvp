'use client';

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { groupPhotos, phaseLabel, projectFeed, projectHome, repliesFor, type FeedItem } from '@/lib/trades/project';
import { useTradeBook } from '@/components/trades/TradeBook';
import { voRegister, type CustomerPack, type FeedReply, type JobPhoto } from '@/lib/trades/desk';
import { formatZar } from '@/lib/trades/tradegraph';
import type { ReactNode } from 'react';

const GanttChart = dynamic(() => import('@/components/trades/GanttChart').then((mod) => mod.GanttChart));

function prettyDay(iso: string): string {
  const stamp = Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(stamp)) return iso.slice(0, 10);
  return new Date(stamp).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function ProjectHomeView({
  pack,
  jobId,
  onJob,
  balance,
}: {
  pack: CustomerPack;
  jobId: string;
  onJob: (id: string) => void;
  balance?: ReactNode;
}) {
  const { book } = useTradeBook();
  const job = pack.jobs.find((row) => row.id === jobId) || pack.jobs[0];
  if (!job) {
    return <p className="rounded-3xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-600">No project yet. Ask for a visit from More.</p>;
  }
  const home = projectHome(book, job);
  return (
    <div className="space-y-4" data-testid="client-project">
      {pack.jobs.length > 1 ? (
        <label className="block text-xs font-bold text-slate-600">
          Project
          <select className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold" value={job.id} onChange={(event) => onJob(event.target.value)}>
            {pack.jobs.map((row) => (
              <option key={row.id} value={row.id}>{row.number} · {row.title}</option>
            ))}
          </select>
        </label>
      ) : null}
      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-4 p-4">
          <ProgressRing pct={home.progress_pct} />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">{job.number}</p>
            <h2 className="text-xl font-black leading-tight">{job.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{job.address}</p>
          </div>
        </div>
        <div className={`px-4 py-3 text-sm font-bold ${home.status === 'behind' ? 'bg-amber-50 text-amber-950' : 'bg-emerald-50 text-emerald-950'}`} data-testid="plan-status">
          {home.status === 'behind' ? `${home.variance_days} day${home.variance_days === 1 ? '' : 's'} behind` : 'On track'}
          <span className="mt-1 block font-medium">{home.reason}</span>
          {balance ? <div className="mt-1 text-xs font-medium">Balance {balance}</div> : null}
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <article className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Current phase</p>
          <p className="mt-1 text-base font-black">{home.current_phase || 'Not started'}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Next milestone</p>
          <p className="mt-1 text-base font-black">{home.next_milestone || 'None scheduled'}</p>
          {home.next_milestone_on ? <p className="text-sm text-slate-600">{prettyDay(home.next_milestone_on)}</p> : null}
        </article>
      </div>
      {home.latest ? (
        <article className="rounded-3xl border border-slate-200 bg-white p-4" data-testid="latest-update">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#00b4d8]">Latest update</p>
          <p className="mt-1 font-black">{home.latest.title}</p>
          <p className="text-sm text-slate-700">{home.latest.body}</p>
          <p className="mt-1 text-xs text-slate-500">{prettyDay(home.latest.at)}</p>
        </article>
      ) : null}
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="relative h-28 w-28 shrink-0" aria-label={`${pct} percent complete`}>
      <svg viewBox="0 0 120 120" className="h-full w-full">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#00b4d8"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <p className="absolute inset-0 flex items-center justify-center text-2xl font-black text-slate-900">{pct}%</p>
    </div>
  );
}

export function ProjectPlanView({ pack, jobId }: { pack: CustomerPack; jobId: string }) {
  const { book } = useTradeBook();
  const job = pack.jobs.find((row) => row.id === jobId) || pack.jobs[0];
  const programme = job ? pack.programmes.find((row) => row.job_id === job.id) : null;
  if (!job || !programme?.tasks.length) {
    return <p className="text-sm text-slate-600">The plan appears after a quote is accepted.</p>;
  }
  const register = voRegister(book, job.id, pack.brand.vat_rate);
  return (
    <div className="space-y-3" data-testid="client-gantt">
      <h2 className="text-lg font-black">{job.title}</h2>
      <p className="text-sm text-slate-600">Grey is the locked plan. Cyan is the forecast. Amber means that bar is late.</p>
      <GanttChart tasks={programme.tasks} readOnly />
      <p className="text-sm font-semibold">Revised value {formatZar(register.revised_incl_cents)} incl VAT</p>
    </div>
  );
}

export function ProjectPhotosView({ pack, jobId }: { pack: CustomerPack; jobId: string }) {
  const programme = pack.programmes.find((row) => row.job_id === jobId) || pack.programmes[0];
  const photos = programme?.photos || [];
  const groups = useMemo(() => groupPhotos(photos), [photos]);
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) {
    return <p className="rounded-3xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-600" data-testid="client-photos">Photos appear as the team works.</p>;
  }
  return (
    <div className="space-y-5" data-testid="client-photos">
      {groups.map((group) => (
        <section key={group.day}>
          <h2 className="text-sm font-black">{prettyDay(group.day)}</h2>
          {group.phases.map((phase) => (
            <div key={phase.phase} className="mt-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#00b4d8]">{phaseLabel(phase.phase)}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {phase.photos.map((photo) => {
                  const index = photos.findIndex((row) => row.id === photo.id);
                  return (
                    <button key={photo.id} type="button" className="text-left" onClick={() => setOpen(index)}>
                      <figure>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.thumb_url || photo.url} alt={photo.caption} width={320} height={180} loading="lazy" decoding="async" className="h-28 w-full rounded-2xl object-cover" />
                        <figcaption className="mt-1 line-clamp-2 text-xs text-slate-600">{photo.caption}</figcaption>
                      </figure>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
      {open !== null ? <PhotoViewer photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: JobPhoto[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const photo = photos[index];
  const [scale, setScale] = useState(1);
  const start = useRef<{ x: number; dist: number; scale: number } | null>(null);
  if (!photo) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-white" data-testid="photo-viewer" role="dialog" aria-modal="true" aria-label={photo.caption}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="text-sm font-bold">{phaseLabel(photo.phase)} · {index + 1} / {photos.length}</p>
        <div className="flex gap-2">
          <a className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#0f172a]" href={photo.url} download>
            Download
          </a>
          <button type="button" className="rounded-full border border-white/30 px-3 py-2 text-xs font-bold" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3"
        onTouchStart={(event) => {
          if (event.touches.length === 2) {
            const dist = Math.hypot(
              event.touches[0].clientX - event.touches[1].clientX,
              event.touches[0].clientY - event.touches[1].clientY
            );
            start.current = { x: 0, dist, scale };
          } else {
            start.current = { x: event.touches[0].clientX, dist: 0, scale };
          }
        }}
        onTouchMove={(event) => {
          if (!start.current || event.touches.length < 2) return;
          const dist = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY
          );
          const next = Math.min(4, Math.max(1, start.current.scale * (dist / (start.current.dist || dist))));
          setScale(next);
        }}
        onTouchEnd={(event) => {
          if (!start.current || start.current.dist) {
            start.current = null;
            return;
          }
          const x = event.changedTouches[0]?.clientX ?? start.current.x;
          const delta = x - start.current.x;
          if (delta > 48 && index > 0) onIndex(index - 1);
          if (delta < -48 && index < photos.length - 1) onIndex(index + 1);
          setScale(1);
          start.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption} className="max-h-full max-w-full object-contain transition-transform" style={{ transform: `scale(${scale})` }} />
      </div>
      <div className="space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-sm">{photo.caption}</p>
        <div className="flex justify-between gap-2">
          <button type="button" className="min-h-11 rounded-full border border-white/30 px-4 text-sm font-bold disabled:opacity-40" disabled={index === 0} onClick={() => { setScale(1); onIndex(index - 1); }}>
            Previous
          </button>
          <button type="button" className="min-h-11 rounded-full bg-[#00b4d8] px-4 text-sm font-bold text-[#0f172a] disabled:opacity-40" disabled={index === photos.length - 1} onClick={() => { setScale(1); onIndex(index + 1); }}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectFeedView({ pack, jobId }: { pack: CustomerPack; jobId: string }) {
  const { book, dispatch } = useTradeBook();
  const items = projectFeed(book, jobId, 'client');
  const [comment, setComment] = useState<Record<string, string>>({});
  return (
    <div className="space-y-3" data-testid="client-feed">
      {items.map((item) => (
        <FeedCard
          key={item.id}
          item={item}
          replies={repliesFor(pack.feed_replies, item.id)}
          comment={comment[item.id] || ''}
          onComment={(value) => setComment((current) => ({ ...current, [item.id]: value }))}
          onReact={(reaction) =>
            dispatch({
              type: 'feed_reply',
              job_id: jobId,
              target_id: item.id,
              from: 'customer',
              author: pack.customer.name,
              reaction,
            })
          }
          onSend={() => {
            const text = (comment[item.id] || '').trim();
            if (!text) return;
            dispatch({
              type: 'feed_reply',
              job_id: jobId,
              target_id: item.id,
              from: 'customer',
              author: pack.customer.name,
              comment: text,
            });
            setComment((current) => ({ ...current, [item.id]: '' }));
          }}
        />
      ))}
      {!items.length ? <p className="text-sm text-slate-600">Updates from the team land here.</p> : null}
    </div>
  );
}

function FeedCard({
  item,
  replies,
  comment,
  onComment,
  onReact,
  onSend,
}: {
  item: FeedItem;
  replies: FeedReply[];
  comment: string;
  onComment: (value: string) => void;
  onReact: (reaction: string) => void;
  onSend: () => void;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-[#00b4d8]">{item.title}</p>
      <p className="mt-1 text-sm text-slate-800">{item.body}</p>
      {item.thumb_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumb_url} alt="" width={320} height={160} loading="lazy" className="mt-2 h-36 w-full rounded-2xl object-cover" />
      ) : null}
      <p className="mt-2 text-xs text-slate-500">{prettyDay(item.at)}</p>
      {replies.length ? (
        <ul className="mt-2 space-y-1 text-sm">
          {replies.map((reply) => (
            <li key={reply.id} className="rounded-2xl bg-slate-50 px-3 py-2">
              <span className="font-bold">{reply.author}</span> {reply.reaction} {reply.comment}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex gap-2">
        {['👍', '👀', '🙏'].map((mark) => (
          <button key={mark} type="button" className="min-h-11 min-w-11 rounded-full border border-slate-200 text-lg" onClick={() => onReact(mark)} aria-label={`React ${mark}`}>
            {mark}
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <input className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm" value={comment} onChange={(event) => onComment(event.target.value)} placeholder="Comment" />
        <button className="min-h-11 rounded-full bg-[#00b4d8] px-4 text-sm font-bold text-[#0f172a]" type="submit">
          Send
        </button>
      </form>
    </article>
  );
}
