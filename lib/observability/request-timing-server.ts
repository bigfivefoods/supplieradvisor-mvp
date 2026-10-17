/**
 * Server-only request timing. Route handlers import this module.
 * Client components must not. It is the only place that loads node:async_hooks.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  buildTimingLog,
  formatServerTiming,
  registerRequestSlotReader,
  sampleRateFromEnv,
  shouldSample,
  type RequestTimingSlot,
  type TimingRunOptions,
} from './request-timing';

export const requestTimingStore = new AsyncLocalStorage<RequestTimingSlot>();

registerRequestSlotReader(() => requestTimingStore.getStore());

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
