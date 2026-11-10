/**
 * HMAC signing for the shop sync (contract v1.0, sections 2.2 and 7).
 *
 *   signed_string = prefix + timestamp + "." + RAW_BODY
 *   signature     = "v1=" + hex(HMAC_SHA256(secret, signed_string))
 *
 * The request direction uses "bfg-shop-sync.v1.", the flow-back uses
 * "bfg-sa-callback.v1." so a request cannot be replayed across directions.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { TIMESTAMP_WINDOW_SECONDS } from './config';

export const REQUEST_SIGNING_PREFIX = 'bfg-shop-sync.v1.';
export const CALLBACK_SIGNING_PREFIX = 'bfg-sa-callback.v1.';

export function signBfgPayload(
  prefix: string,
  secret: string,
  timestamp: string,
  rawBody: string
): string {
  const digest = createHmac('sha256', secret)
    .update(`${prefix}${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
  return `v1=${digest}`;
}

/**
 * Constant-time check of an X-BFG-Signature header against the raw body.
 * Anything malformed (missing header, no "v1=" prefix, wrong length,
 * non-hex) is simply false: the caller must not say which check failed.
 */
export function verifyBfgSyncSignature(opts: {
  secret: string;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
  rawBody: string;
  prefix?: string;
}): boolean {
  const ts = String(opts.timestamp ?? '');
  const sig = String(opts.signature ?? '');
  if (!opts.secret || !/^\d{1,12}$/.test(ts)) return false;
  if (!/^v1=[0-9a-f]{64}$/.test(sig)) return false;
  const expected = signBfgPayload(
    opts.prefix ?? REQUEST_SIGNING_PREFIX,
    opts.secret,
    ts,
    opts.rawBody
  );
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(sig, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** |now - timestamp| <= 300 s (timestamp is Unix seconds). */
export function timestampInWindow(
  timestamp: string,
  nowMs: number,
  windowSeconds = TIMESTAMP_WINDOW_SECONDS
): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowMs / 1000 - ts) <= windowSeconds;
}
