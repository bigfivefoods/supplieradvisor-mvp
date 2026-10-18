/**
 * Per-request timing helpers that stay free of Node builtins.
 *
 * lib/supabase/server-client.ts and admin.ts import countedFetch from here,
 * and client components reach those modules. This file must not import a
 * Node builtin. Async local storage is bound from the server timing module,
 * which only route handlers load.
 *
 * Sampling uses REQUEST_TIMING_SAMPLE_RATE when it is set (0 to 1).
 * The default is 0.05, so merging does not need a new environment variable.
 * Requests slower than 1s and HTTP 5xx are always logged.
 * db duration is the sum of each call's time, so overlapping calls can make
 * db greater than total. The counter stops when response headers arrive.
 */
export const SLOW_REQUEST_MS = 1000;
export const DEFAULT_SAMPLE_RATE = 0.05;

export type RequestTimingSlot = {
  dbCalls: number;
  dbMs: number;
};

export type TimingLog = {
  kind: 'request_timing';
  route: string;
  ms: number;
  dbMs: number;
  dbCalls: number;
  status: number;
};

type Clock = () => number;

export type TimingRunOptions = {
  now?: Clock;
  random?: () => number;
  sampleRate?: number;
  log?: (line: string) => void;
};

let readSlot: () => RequestTimingSlot | undefined = () => undefined;

/** Called once from the server-only module. Client bundles never call this. */
export function registerRequestSlotReader(reader: () => RequestTimingSlot | undefined) {
  readSlot = reader;
}

export function sampleRateFromEnv(raw: string | undefined): number {
  if (raw == null || raw.trim() === '') return DEFAULT_SAMPLE_RATE;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_SAMPLE_RATE;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

export function shouldSample(input: {
  totalMs: number;
  status: number;
  rate: number;
  random: number;
}): boolean {
  if (input.status >= 500) return true;
  if (input.totalMs >= SLOW_REQUEST_MS) return true;
  if (input.rate >= 1) return true;
  if (input.rate <= 0) return false;
  return input.random < input.rate;
}

export function formatServerTiming(totalMs: number, dbMs: number, dbCalls: number): string {
  return `total;dur=${fmtMs(totalMs)}, db;dur=${fmtMs(dbMs)}, dbcalls;desc=${Math.max(0, Math.round(dbCalls))}`;
}

/** Drop query strings, addresses, and numeric path ids before anything is logged. */
export function safeRoutePattern(pattern: string): string {
  const cut = String(pattern || '').split('?')[0].split('#')[0];
  if (!cut || cut.includes('@') || cut.includes('://')) return 'redacted-route';
  return cut.replace(/\/\d+/g, '/:id');
}

export function buildTimingLog(input: {
  routePattern: string;
  totalMs: number;
  dbMs: number;
  dbCalls: number;
  status: number;
}): TimingLog {
  return {
    kind: 'request_timing',
    route: safeRoutePattern(input.routePattern),
    ms: roundMs(input.totalMs),
    dbMs: roundMs(input.dbMs),
    dbCalls: Math.max(0, Math.round(input.dbCalls)),
    status: input.status,
  };
}

/**
 * Wrap the fetch handed to a singleton Supabase client.
 * The keep-alive agent stays inside `base`. Calls outside a timed request are not counted.
 */
export function countedFetch(base: typeof fetch): typeof fetch {
  const wrapped: typeof fetch = (input, init) => {
    const slot = readSlot();
    const started = performance.now();
    const finish = () => {
      if (!slot) return;
      slot.dbCalls += 1;
      slot.dbMs += performance.now() - started;
    };
    try {
      const pending = base(input, init);
      return Promise.resolve(pending).then(
        (res) => {
          finish();
          return res;
        },
        (err: unknown) => {
          finish();
          throw err;
        }
      );
    } catch (err) {
      finish();
      throw err;
    }
  };
  return wrapped;
}

function fmtMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0.0';
  return ms.toFixed(1);
}

function roundMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.round(ms * 10) / 10;
}
