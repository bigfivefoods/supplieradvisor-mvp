/**
 * Platform user inbox — system-wide personal messages keyed by user id.
 * Complements company_inbox so delivery works from any module / company.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  getCanonicalUserId,
  userIdMatchVariants,
} from '@/lib/auth/identity';
import {
  normalizeThreads,
  upsertThread,
  type CompanyThread,
} from '@/lib/messaging/company-inbox';

export type UserInboxStore = {
  user_id: string;
  threads: CompanyThread[];
  updated_at?: string;
};

export function normalizePlatformUserId(
  raw: string | null | undefined
): string | null {
  return getCanonicalUserId(raw);
}

/**
 * Load personal inbox for a platform user (tries id variants).
 */
export async function readUserInbox(
  userId: string | null | undefined
): Promise<UserInboxStore | null> {
  const uid = normalizePlatformUserId(userId);
  if (!uid) return null;
  const supabase = getSupabaseServer();
  const variants = userIdMatchVariants(uid);

  const { data, error } = await supabase
    .from('platform_user_inboxes')
    .select('user_id, threads, updated_at')
    .in('user_id', variants)
    .limit(5);

  if (error) {
    // Table may not exist yet in some envs — soft fail
    console.warn('[user-inbox] read', error.message);
    return { user_id: uid, threads: [] };
  }

  if (!data?.length) {
    return { user_id: uid, threads: [] };
  }

  // Merge threads from any variant rows (prefer canonical uid for write)
  const byId = new Map<string, CompanyThread>();
  for (const row of data) {
    for (const t of normalizeThreads(row.threads)) {
      const prev = byId.get(t.id);
      if (!prev || prev.updated_at < t.updated_at) {
        byId.set(t.id, t);
      }
    }
  }
  return {
    user_id: uid,
    threads: [...byId.values()].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at)
    ),
    updated_at: data[0]?.updated_at
      ? String(data[0].updated_at)
      : undefined,
  };
}

/**
 * Upsert a thread into the user's personal inbox (create row if needed).
 */
export async function upsertUserInboxThread(
  userId: string | null | undefined,
  thread: CompanyThread
): Promise<{ ok: boolean; error?: string }> {
  const uid = normalizePlatformUserId(userId);
  if (!uid) return { ok: false, error: 'user_id required' };

  const supabase = getSupabaseServer();
  const existing = await readUserInbox(uid);
  const threads = upsertThread(existing?.threads || [], thread);

  const { error } = await supabase.from('platform_user_inboxes').upsert(
    {
      user_id: uid,
      threads,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.warn('[user-inbox] upsert', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Replace full personal inbox threads for a user (e.g. after mark-read).
 */
export async function writeUserInboxThreads(
  userId: string | null | undefined,
  threads: CompanyThread[]
): Promise<{ ok: boolean; error?: string }> {
  const uid = normalizePlatformUserId(userId);
  if (!uid) return { ok: false, error: 'user_id required' };
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('platform_user_inboxes').upsert(
    {
      user_id: uid,
      threads: normalizeThreads(threads),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    console.warn('[user-inbox] write', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Merge company + personal threads for display (dedupe by id, newest wins).
 */
export function mergeInboxThreads(
  companyThreads: CompanyThread[],
  personalThreads: CompanyThread[]
): CompanyThread[] {
  const byId = new Map<string, CompanyThread>();
  for (const t of [
    ...normalizeThreads(companyThreads),
    ...normalizeThreads(personalThreads),
  ]) {
    if (t.archived) continue;
    const prev = byId.get(t.id);
    if (!prev || prev.updated_at < t.updated_at) {
      byId.set(t.id, t);
    }
  }
  return [...byId.values()].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  );
}

/**
 * Collect platform user ids that should receive a company thread copy.
 * - Explicit colleague user participants
 * - Optional extra ids (e.g. all active members of peer company)
 */
export function targetUserIdsFromThread(
  thread: CompanyThread,
  extraUserIds?: string[]
): string[] {
  const out = new Set<string>();
  for (const p of thread.participants || []) {
    if (p.kind === 'user' && p.ref_id) {
      const id = normalizePlatformUserId(p.ref_id);
      if (id) out.add(id);
    }
  }
  for (const raw of extraUserIds || []) {
    const id = normalizePlatformUserId(raw);
    if (id) out.add(id);
  }
  return [...out];
}
