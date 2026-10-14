/**
 * On-device queue for TradeAdvisor® photo uploads.
 * The service worker does not cache app JavaScript. While a job is open,
 * photos wait here and flush when the network returns.
 */

export type QueuedPhoto = {
  id: string;
  job_id: string;
  phase: 'before' | 'after';
  url: string;
  caption: string;
  at: string;
};

export type JobCache = {
  saved_at: string;
  jobs: Array<{ id: string; number: string; title: string; address: string; status: string }>;
};

const QUEUE_KEY = 'sa_trade_photo_queue_v1';
const CACHE_KEY = 'sa_trade_job_cache_v1';

export function enqueuePhoto(queue: QueuedPhoto[], item: QueuedPhoto): QueuedPhoto[] {
  if (!item.url || !item.job_id) return queue;
  return [...queue.filter((row) => row.id !== item.id), item];
}

export function drainPhotoQueue(queue: QueuedPhoto[], uploadedIds: string[]): QueuedPhoto[] {
  const done = new Set(uploadedIds);
  return queue.filter((row) => !done.has(row.id));
}

export function readPhotoQueue(): QueuedPhoto[] {
  return readJson<QueuedPhoto[]>(QUEUE_KEY) || [];
}

export function writePhotoQueue(queue: QueuedPhoto[]): void {
  writeJson(QUEUE_KEY, queue);
}

export function readJobCache(): JobCache | null {
  return readJson<JobCache>(CACHE_KEY);
}

export function writeJobCache(cache: JobCache): void {
  writeJson(CACHE_KEY, cache);
}

function readJson<T>(key: string): T | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or a full disk */
  }
}
