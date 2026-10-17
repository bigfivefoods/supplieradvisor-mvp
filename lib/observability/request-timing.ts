/**
 * Per-request timing and Supabase call counter.
 *
 * Sampling uses REQUEST_TIMING_SAMPLE_RATE when it is set (0 to 1).
 * The default is 0.05, so merging does not need a new environment variable.
 * Requests slower than 1s and HTTP 5xx are always logged.
 * The logger never throws.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';

export const SLOW_REQUEST_MS = 1000;
export const DEFAULT_SAMPLE_RATE = 0.05;

export type RequestTimingSlot = {
  dbCalls: number;
  dbMs: number;
};

export const requestTimingStore = new AsyncLocalStorage<RequestTimingSlot>();

export type TimingLog = {
  kind: 'request_timing';
  route: string;
  ms: number;
  dbMs: number;
  dbCalls: number;
  status: number;
  company?: string;
};

type Clock = () => number;

export type TimingRunOptions = {
  now?: Clock;
  random?: () => number;
  sampleRate?: number;
  log?: (line: string) => void;
};

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

export function hashCompanyId(raw: string): string {
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

/** Drop query strings, addresses, and numeric path ids before anything is logged. */
export function safeRoutePattern(pattern: string): string {
  const cut = String(pattern || '').split('?')[0].split('#')[0];
  if (!cut || cut.includes('@') || cut.includes('://')) return 'redacted-route';
  return cut.replace(/\/\d+/g, '/:id');
}

export function companyIdFromRequest(request: Request | undefined): string | null {
  if (!request) return null;
  let params: URLSearchParams;
  try {
    params = new URL(request.url).searchParams;
  } catch {
    return null;
  }
  for (const key of ['companyId', 'company_id', 'profileId']) {
    const value = params.get(key);
    if (value && /^\d{1,12}$/.test(value)) return value;
  }
  return null;
}

export function buildTimingLog(input: {
  routePattern: string;
  totalMs: number;
  dbMs: number;
  dbCalls: number;
  status: number;
  companyId: string | null;
}): TimingLog {
  const line: TimingLog = {
    kind: 'request_timing',
    route: safeRoutePattern(input.routePattern),
    ms: roundMs(input.totalMs),
    dbMs: roundMs(input.dbMs),
    dbCalls: Math.max(0, Math.round(input.dbCalls)),
    status: input.status,
  };
  if (input.companyId) line.company = hashCompanyId(input.companyId);
  return line;
}

/**
 * Wrap the fetch handed to a singleton Supabase client.
 * The keep-alive agent stays inside `base`. Calls outside a timed request are not counted.
 */
export function countedFetch(base: typeof fetch): typeof fetch {
  const wrapped: typeof fetch = (input, init) => {
    const slot = requestTimingStore.getStore();
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

export async function withRequestTiming(
  routePattern: string,
  request: Request,
  run: () => Promise<Response>,
  opts?: TimingRunOptions
): Promise<Response> {
  const slot: RequestTimingSlot = { dbCalls: 0, dbMs: 0 };
  const now = opts?.now ?? (() => performance.now());
  const started = now();
  let status = 500;
  let response: Response | undefined;
  try {
    response = await requestTimingStore.run(slot, run);
    status = response?.status ?? 500;
    return response;
  } catch (err) {
    status = 500;
    throw err;
  } finally {
    const totalMs = now() - started;
    try {
      const rate = opts?.sampleRate ?? sampleRateFromEnv(process.env.REQUEST_TIMING_SAMPLE_RATE);
      const random = opts?.random ? opts.random() : Math.random();
      if (shouldSample({ totalMs, status, rate, random })) {
        const line = buildTimingLog({
          routePattern,
          totalMs,
          dbMs: slot.dbMs,
          dbCalls: slot.dbCalls,
          status,
          companyId: companyIdFromRequest(request),
        });
        const write = opts?.log ?? ((text: string) => console.log(text));
        try {
          write(JSON.stringify(line));
        } catch {
          /* a broken log sink must not drop the header or the response */
        }
      }
    } catch {
      /* building the line must not change the handler result */
    }
    try {
      if (response) {
        response.headers.append(
          'Server-Timing',
          formatServerTiming(totalMs, slot.dbMs, slot.dbCalls)
        );
      }
    } catch {
      /* an immutable header must not change the handler result */
    }
  }
}

function fmtMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0.0';
  return ms.toFixed(1);
}

function roundMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.round(ms * 10) / 10;
}
