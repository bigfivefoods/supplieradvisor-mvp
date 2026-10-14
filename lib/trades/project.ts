/**
 * Client project home: progress, plan versus actual, and the shared feed.
 * Internal notes and photos stay off the customer pack before this runs.
 */
import {
  programmeFor,
  readGantt,
  varianceDays,
  type Book,
  type FeedReply,
  type JobPhoto,
  type PhotoPhase,
} from './desk';
import type { TradeJob } from './tradegraph';

export type FeedKind = 'update' | 'photo' | 'milestone' | 'variation' | 'invoice';

export type FeedItem = {
  id: string;
  kind: FeedKind;
  at: string;
  title: string;
  body: string;
  photo_url: string | null;
  thumb_url: string | null;
  phase: PhotoPhase | null;
  internal: boolean;
};

export type ProjectHome = {
  job: TradeJob;
  progress_pct: number;
  current_phase: string | null;
  next_milestone: string | null;
  next_milestone_on: string | null;
  status: 'on_track' | 'behind';
  variance_days: number;
  reason: string;
  latest: FeedItem | null;
};

export function projectProgress(book: Book, job: TradeJob): number {
  const programme = programmeFor(book.desk, job.id);
  if (!programme?.tasks.length) return Math.max(0, Math.min(100, Math.round(job.progress_pct)));
  const sum = programme.tasks.reduce((total, task) => total + task.progress_pct, 0);
  return Math.round(sum / programme.tasks.length);
}

export function projectHome(book: Book, job: TradeJob, today?: string): ProjectHome {
  const programme = programmeFor(book.desk, job.id);
  const gantt = programme ? readGantt(programme.tasks, today) : null;
  const next = gantt?.upcoming[0] || programme?.tasks.find((task) => task.kind === 'milestone' && task.progress_pct < 100) || null;
  const variance = gantt?.variance_days || 0;
  const worst = programme
    ? [...programme.tasks].sort((a, b) => varianceDays(b) - varianceDays(a))[0]
    : null;
  const late = worst && varianceDays(worst) > 0 ? worst : null;
  const vo = book.desk.variations.find((row) => row.job_id === job.id && row.status === 'approved');
  let reason = 'The forecast still finishes on the locked plan.';
  if (variance > 0 || late) {
    const days = late ? varianceDays(late) : variance;
    const slip = late ? `${late.name} is ${days} day${days === 1 ? '' : 's'} past the locked plan` : `The finish has moved ${variance} days`;
    reason = vo ? `${slip}. Approved ${vo.number} (${vo.title}) added time.` : `${slip}.`;
  }
  const feed = projectFeed(book, job.id, 'client');
  return {
    job,
    progress_pct: projectProgress(book, job),
    current_phase: gantt?.current?.name || null,
    next_milestone: next?.name || null,
    next_milestone_on: next ? (next.plan_end || next.end) : null,
    status: variance > 0 ? 'behind' : 'on_track',
    variance_days: variance,
    reason,
    latest: feed[0] || null,
  };
}

export function projectFeed(book: Book, jobId: string, audience: 'client' | 'desk'): FeedItem[] {
  const job = book.store.jobs.find((row) => row.id === jobId);
  const programme = programmeFor(book.desk, jobId);
  const items: FeedItem[] = [];
  if (job) {
    for (const update of job.updates) {
      if (audience === 'client' && !update.shared) continue;
      items.push({
        id: update.id,
        kind: 'update',
        at: update.at,
        title: 'Update',
        body: update.note,
        photo_url: update.photo_url,
        thumb_url: null,
        phase: null,
        internal: !update.shared,
      });
    }
  }
  for (const photo of programme?.photos || []) {
    if (audience === 'client' && photo.shared === false) continue;
    items.push({
      id: photo.id,
      kind: 'photo',
      at: photo.at,
      title: phaseLabel(photo.phase),
      body: photo.caption,
      photo_url: photo.url,
      thumb_url: photo.thumb_url || photo.url,
      phase: photo.phase,
      internal: photo.shared === false,
    });
  }
  for (const task of programme?.tasks || []) {
    if (task.kind !== 'milestone') continue;
    if (task.progress_pct < 100 && !task.actual_end) continue;
    items.push({
      id: task.id,
      kind: 'milestone',
      at: `${(task.actual_end || task.end).slice(0, 10)}T16:00:00.000Z`,
      title: 'Milestone',
      body: task.name,
      photo_url: null,
      thumb_url: null,
      phase: null,
      internal: false,
    });
  }
  for (const vo of book.desk.variations.filter((row) => row.job_id === jobId && row.status !== 'draft')) {
    items.push({
      id: vo.id,
      kind: 'variation',
      at: vo.created_at,
      title: vo.number,
      body: `${vo.title} · ${vo.status}`,
      photo_url: vo.photo_urls[0] || null,
      thumb_url: null,
      phase: null,
      internal: false,
    });
  }
  if (job) {
    for (const invoice of book.store.invoices.filter((row) => row.job_id === jobId && row.status !== 'void')) {
      items.push({
        id: invoice.id,
        kind: 'invoice',
        at: invoice.issued_at,
        title: invoice.number,
        body: invoice.status.replace(/_/g, ' '),
        photo_url: null,
        thumb_url: null,
        phase: null,
        internal: false,
      });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export function repliesFor(replies: FeedReply[], targetId: string): FeedReply[] {
  return replies.filter((row) => row.target_id === targetId).sort((a, b) => a.at.localeCompare(b.at));
}

export type PhotoDay = { day: string; phases: Array<{ phase: PhotoPhase; photos: JobPhoto[] }> };

const PHASES: PhotoPhase[] = ['before', 'during', 'after'];

export function groupPhotos(photos: JobPhoto[]): PhotoDay[] {
  const days = new Map<string, JobPhoto[]>();
  for (const photo of [...photos].sort((a, b) => a.at.localeCompare(b.at))) {
    const day = photo.at.slice(0, 10);
    const list = days.get(day) || [];
    list.push(photo);
    days.set(day, list);
  }
  return [...days.entries()].reverse().map(([day, rows]) => ({
    day,
    phases: PHASES.map((phase) => ({ phase, photos: rows.filter((row) => row.phase === phase) })).filter(
      (group) => group.photos.length
    ),
  }));
}

export function phaseLabel(phase: PhotoPhase): string {
  if (phase === 'before') return 'Before';
  if (phase === 'during') return 'During';
  return 'After';
}
