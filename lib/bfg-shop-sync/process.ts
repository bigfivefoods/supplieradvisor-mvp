/**
 * Request pipeline for POST /api/webhooks/bfg-shop-sync (contract v1.0, section 2).
 *
 * Order of checks: configuration -> body size -> signature (constant time) ->
 * timestamp window -> JSON -> envelope -> profile allow-list -> idempotency ->
 * domain logic. The signature is always checked BEFORE the timestamp window.
 * No personal data is logged: ids, event, result and error code only.
 */
import {
  ALLOWED_PROFILE_ID,
  MAX_BODY_BYTES,
  readSyncConfig,
  type SyncConfig,
} from './config';
import { SyncError, errorBody } from './errors';
import { runEvent, successBody, type HandlerCtx } from './handlers';
import type { Row, SyncPorts } from './ports';
import { totalsFingerprint } from './money';
import { timestampInWindow, verifyBfgSyncSignature } from './signature';
import { parseEnvelope, parseEventData } from './validate';

export type SyncHttpRequest = {
  rawBody: string;
  headers: {
    timestamp: string | null;
    signature: string | null;
    idempotencyKey: string | null;
    event: string | null;
    contentLength: string | null;
  };
};

export type SyncHttpResponse = { status: number; body: Row };

function fail(err: SyncError): SyncHttpResponse {
  return { status: err.status, body: errorBody(err) as unknown as Row };
}

export async function processSyncRequest(
  req: SyncHttpRequest,
  deps: { ports: SyncPorts; config?: SyncConfig; env?: Record<string, string | undefined> }
): Promise<SyncHttpResponse> {
  const config = deps.config ?? readSyncConfig(deps.env ?? process.env);
  // Default OFF. A missing secret or a profile id other than 102 also refuses.
  if (config.state !== 'ok') {
    return fail(new SyncError('unavailable', 'The sync endpoint is not available.'));
  }

  const declared = Number(req.headers.contentLength);
  if (
    (Number.isFinite(declared) && declared > MAX_BODY_BYTES) ||
    Buffer.byteLength(req.rawBody, 'utf8') > MAX_BODY_BYTES
  ) {
    return fail(new SyncError('bad_request', 'Body is larger than 256 KB.'));
  }

  // 1. Signature first (constant time), then the replay window.
  if (
    !verifyBfgSyncSignature({
      secret: config.secret,
      timestamp: req.headers.timestamp,
      signature: req.headers.signature,
      rawBody: req.rawBody,
    })
  ) {
    return fail(new SyncError('bad_signature', 'Signature check failed.'));
  }
  if (!timestampInWindow(String(req.headers.timestamp), deps.ports.nowMs())) {
    return fail(new SyncError('stale_timestamp', 'Timestamp is outside the allowed window.'));
  }

  let claimedKey: string | null = null;
  try {
    // 2. Parse only after the signature is verified on the raw bytes.
    let json: unknown;
    try {
      json = JSON.parse(req.rawBody);
    } catch {
      throw new SyncError('bad_request', 'Body is not valid JSON.');
    }
    const { envelope, data } = parseEnvelope(json, {
      event: req.headers.event,
      idempotencyKey: req.headers.idempotencyKey,
    });
    if (envelope.profile_id !== config.profileId || envelope.profile_id !== ALLOWED_PROFILE_ID) {
      throw new SyncError('profile_not_allowed', 'profile_id is not allowed.');
    }
    if (data.origin === 'supplieradvisor' && envelope.event === 'customer.upsert') {
      throw new SyncError('origin_not_allowed', 'origin "supplieradvisor" cannot create records.');
    }
    const parsed = parseEventData(envelope.event, data);
    const ctx: HandlerCtx = {
      ports: deps.ports,
      profileId: config.profileId,
      bankAccountId: config.bankAccountId,
      envelope,
    };

    // 3. dry_run: validate and plan, write nothing (no claim, no numbering).
    if (envelope.dry_run) {
      const out = await runEvent(ctx, parsed);
      return { status: 200, body: successBody(ctx, out, false) };
    }

    // 4. Idempotency: replaying a processed key returns the stored response.
    const { store } = deps.ports;
    const fingerprintOfRequest =
      parsed.event === 'order.placed'
        ? totalsFingerprint(parsed.data.totals)
        : null;
    const claim = await store.claimKey({
      profileId: config.profileId,
      key: envelope.idempotency_key,
      event: envelope.event,
      fingerprint: fingerprintOfRequest,
    });
    if (claim.kind === 'replay') {
      if (fingerprintOfRequest && claim.fingerprint && claim.fingerprint !== fingerprintOfRequest) {
        throw new SyncError('totals_changed', 'Same reference arrived with different totals.');
      }
      return { status: 200, body: { ...claim.response, idempotent_replay: true } };
    }
    if (claim.kind === 'in_progress') {
      throw new SyncError('conflict_in_progress', 'This key is being processed.');
    }
    claimedKey = envelope.idempotency_key;

    const out = await runEvent(ctx, parsed);
    const body = successBody(ctx, out, false);
    await store.completeKey({
      profileId: config.profileId,
      key: envelope.idempotency_key,
      response: { ...body, idempotent_replay: false },
    });
    claimedKey = null;
    return { status: 200, body };
  } catch (e) {
    if (claimedKey) {
      // Failures are not stored: the shop retries, or dead-letters a permanent error.
      await deps.ports.store
        .releaseKey({ profileId: config.profileId, key: claimedKey })
        .catch(() => undefined);
    }
    if (e instanceof SyncError) return fail(e);
    // Unexpected: log the error name only (no message, no payload) and ask for a retry.
    console.error('[bfg-shop-sync] unexpected error', {
      name: e instanceof Error ? e.name : typeof e,
    });
    return fail(new SyncError('internal_error', 'Unexpected error.'));
  }
}
