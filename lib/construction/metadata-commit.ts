/**
 * Compare-and-swap for profiles.metadata. Stop-gap until ConstructionAdvisor®
 * moves onto the stale-safe module store. Three lost races return 409.
 */

export const CONSTRUCTION_CAS_CONFLICT =
  'This changed while you were saving, please retry';

export type ConstructionMetaRow = {
  metadata: Record<string, unknown>;
  updated_at: string | null;
};

export async function commitProfileMetadata<T>(opts: {
  read: () => Promise<ConstructionMetaRow | null>;
  write: (args: {
    metadata: Record<string, unknown>;
    prevUpdatedAt: string | null;
    nextUpdatedAt: string;
  }) => Promise<'ok' | 'lost'>;
  change: (
    row: ConstructionMetaRow
  ) =>
    | { metadata: Record<string, unknown>; value: T }
    | { error: string; status: number; needsConfirm?: boolean };
  now?: () => string;
}): Promise<
  | { ok: true; value: T; metadata: Record<string, unknown> }
  | { ok: false; status: number; error: string; needsConfirm?: boolean }
> {
  const now = opts.now || (() => new Date().toISOString());
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = await opts.read();
    if (!row) return { ok: false, status: 404, error: 'Company not found' };
    const changed = opts.change(row);
    if ('error' in changed) {
      return {
        ok: false,
        status: changed.status,
        error: changed.error,
        ...(changed.needsConfirm ? { needsConfirm: true } : {}),
      };
    }
    const wrote = await opts.write({
      metadata: changed.metadata,
      prevUpdatedAt: row.updated_at,
      nextUpdatedAt: now(),
    });
    if (wrote === 'ok') {
      return { ok: true, value: changed.value, metadata: changed.metadata };
    }
  }
  return { ok: false, status: 409, error: CONSTRUCTION_CAS_CONFLICT };
}
