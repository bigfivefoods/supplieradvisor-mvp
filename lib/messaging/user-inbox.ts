/**
 * Platform user inbox — system-wide personal messages keyed by user id.
 * Complements company_inbox so delivery works from any module / company.
 *
 * Storage:
 *  1) public.platform_user_inboxes (preferred, when migrated)
 *  2) Fallback: business_users.metadata.user_inbox on any active membership row
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

const BU_META_KEY = 'user_inbox';

export type UserInboxStore = {
  user_id: string;
  threads: CompanyThread[];
  updated_at?: string;
  storage?: 'table' | 'business_users' | 'none';
};

export function normalizePlatformUserId(
  raw: string | null | undefined
): string | null {
  return getCanonicalUserId(raw);
}

let tableAvailable: boolean | null = null;

async function hasUserInboxTable(): Promise<boolean> {
  if (tableAvailable != null) return tableAvailable;
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('platform_user_inboxes')
    .select('user_id')
    .limit(1);
  // 42P01 undefined_table / PGRST205 schema cache miss
  if (
    error &&
    (error.message?.includes('platform_user_inboxes') ||
      error.code === '42P01' ||
      error.code === 'PGRST205')
  ) {
    tableAvailable = false;
    return false;
  }
  tableAvailable = true;
  return true;
}

async function readFromBusinessUsers(
  uid: string
): Promise<UserInboxStore | null> {
  const supabase = getSupabaseServer();
  const variants = userIdMatchVariants(uid);
  const { data: rows } = await supabase
    .from('business_users')
    .select('id, user_id, metadata')
    .eq('status', 'active')
    .in('user_id', variants)
    .limit(50);

  const byId = new Map<string, CompanyThread>();
  for (const row of rows || []) {
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    const raw = meta[BU_META_KEY];
    const threads =
      raw && typeof raw === 'object' && Array.isArray((raw as { threads?: unknown }).threads)
        ? normalizeThreads((raw as { threads: unknown }).threads)
        : normalizeThreads(raw);
    for (const t of threads) {
      const prev = byId.get(t.id);
      if (!prev || prev.updated_at < t.updated_at) byId.set(t.id, t);
    }
  }

  return {
    user_id: uid,
    threads: [...byId.values()].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at)
    ),
    storage: 'business_users',
  };
}

async function writeToBusinessUsers(
  uid: string,
  threads: CompanyThread[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServer();
  const variants = userIdMatchVariants(uid);
  const { data: rows, error: findErr } = await supabase
    .from('business_users')
    .select('id, metadata')
    .eq('status', 'active')
    .in('user_id', variants)
    .limit(50);
  if (findErr) return { ok: false, error: findErr.message };
  if (!rows?.length) {
    return { ok: false, error: 'No business_users row for user' };
  }

  const payload = {
    threads: normalizeThreads(threads),
    updated_at: new Date().toISOString(),
  };

  for (const row of rows) {
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? { ...(row.metadata as Record<string, unknown>) }
        : {};
    meta[BU_META_KEY] = payload;
    const { error } = await supabase
      .from('business_users')
      .update({
        metadata: meta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (error) {
      console.warn('[user-inbox] bu write', row.id, error.message);
    }
  }
  return { ok: true };
}

/**
 * Load personal inbox for a platform user (tries id variants).
 */
export async function readUserInbox(
  userId: string | null | undefined
): Promise<UserInboxStore | null> {
  const uid = normalizePlatformUserId(userId);
  if (!uid) return null;

  if (await hasUserInboxTable()) {
    const supabase = getSupabaseServer();
    const variants = userIdMatchVariants(uid);
    const { data, error } = await supabase
      .from('platform_user_inboxes')
      .select('user_id, threads, updated_at')
      .in('user_id', variants)
      .limit(5);

    if (!error && data) {
      const byId = new Map<string, CompanyThread>();
      for (const row of data) {
        for (const t of normalizeThreads(row.threads)) {
          const prev = byId.get(t.id);
          if (!prev || prev.updated_at < t.updated_at) byId.set(t.id, t);
        }
      }
      // Merge fallback membership copy as well (covers pre-table writes)
      const fb = await readFromBusinessUsers(uid);
      for (const t of fb?.threads || []) {
        const prev = byId.get(t.id);
        if (!prev || prev.updated_at < t.updated_at) byId.set(t.id, t);
      }
      return {
        user_id: uid,
        threads: [...byId.values()].sort((a, b) =>
          b.updated_at.localeCompare(a.updated_at)
        ),
        updated_at: data[0]?.updated_at
          ? String(data[0].updated_at)
          : undefined,
        storage: 'table',
      };
    }
  }

  return readFromBusinessUsers(uid);
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

  const existing = await readUserInbox(uid);
  const threads = upsertThread(existing?.threads || [], thread);
  return writeUserInboxThreads(uid, threads);
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
  const normalized = normalizeThreads(threads);

  let tableOk = false;
  if (await hasUserInboxTable()) {
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('platform_user_inboxes').upsert(
      {
        user_id: uid,
        threads: normalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (!error) tableOk = true;
    else console.warn('[user-inbox] table upsert', error.message);
  }

  const bu = await writeToBusinessUsers(uid, normalized);
  if (tableOk || bu.ok) return { ok: true };
  return { ok: false, error: bu.error || 'Could not save user inbox' };
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

/**
 * Emails known for a platform user (from memberships + owned profiles).
 */
export async function resolveEmailsForPlatformUser(
  userId: string
): Promise<string[]> {
  const uid = normalizePlatformUserId(userId);
  if (!uid) return [];
  const supabase = getSupabaseServer();
  const variants = userIdMatchVariants(uid);
  const emails = new Set<string>();

  const { data: members } = await supabase
    .from('business_users')
    .select('email, invited_email')
    .eq('status', 'active')
    .in('user_id', variants)
    .limit(100);
  for (const m of members || []) {
    for (const e of [m.email, m.invited_email]) {
      const n = String(e || '')
        .toLowerCase()
        .trim();
      if (n.includes('@')) emails.add(n);
    }
  }

  const { data: profs } = await supabase
    .from('profiles')
    .select('email')
    .in('user_id', variants)
    .limit(50);
  for (const p of profs || []) {
    const n = String(p.email || '')
      .toLowerCase()
      .trim();
    if (n.includes('@')) emails.add(n);
  }

  return [...emails];
}
