import { timingSafeEqual } from 'node:crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  TRADE_MAGIC_DAYS,
  TRADE_OTP_MINUTES,
  TRADE_SESSION_DAYS,
  hashSecret,
  newOtp,
  newSecret,
} from './customer-session';
import { isMissingTradeSchema, TradeSchemaMissingError } from './tradegraph-db';

/** Codes a customer may request for one email in an hour. */
export const OTP_HOURLY_CAP = 5;
/** Wrong guesses that burn one invite. */
export const OTP_FAILS_PER_CODE = 5;
/** Failed verifies for one email inside the window. The next one is refused. */
export const OTP_FAILS_PER_EMAIL = 10;
/** Failed verifies for one book inside the window. The next one is refused. */
export const OTP_FAILS_PER_BOOK = 50;
export const OTP_FAIL_WINDOW_MS = 15 * 60 * 1000;

export const OTP_DENIAL_MESSAGE = 'That code has expired or does not match';
export const OTP_TOO_MANY_MESSAGE =
  'Too many tries, request a new code in a few minutes';

export const TRADE_INVITE_GENERIC = {
  ok: true as const,
  message: 'If this email is on the book, a code is on its way.',
};

export type OpenCustomerSessionResult =
  | { ok: true; token: string; customerId: string }
  | { ok: false; status: 401 | 429 };

export type LiveInvite = {
  id: string;
  customer_id: string;
  email: string;
  otp_hash: string | null;
  magic_hash: string | null;
  created_at: string;
  failed_attempts: number;
};

export type CustomerAuthStore = {
  listLiveInvites(opts: {
    companyId: number;
    email?: string;
    now: number;
  }): Promise<{ invites: LiveInvite[]; attemptsReady: boolean }>;
  failureWindow(opts: {
    companyId: number;
    email: string;
    now: number;
  }): Promise<{ emailCount: number; bookCount: number; ready: boolean }>;
  noteFailure(opts: { companyId: number; email: string; now: number }): Promise<void>;
  markUsed(id: string, usedAt: string): Promise<void>;
  insertSession(opts: {
    id: string;
    companyId: number;
    customerId: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<void>;
};

export type RecentInviteRead = (
  companyId: number,
  email: string,
  sinceIso: string
) => Promise<{ count: number | null; error: { code?: string; message?: string } | null }>;

type DbError = { code?: string; message?: string } | null;

let warnedOtpMigration = false;

export function warnOtpMigration(): void {
  if (warnedOtpMigration) return;
  warnedOtpMigration = true;
  console.warn(
    'TradeAdvisor® customer sign-in is missing failed_attempts. Email is still required and the per-IP limit still applies. Apply the trade OTP migration before the durable guess counter takes effect.'
  );
}

/** Reset the one-time migration warning. Tests only. */
export function resetOtpMigrationWarning(): void {
  warnedOtpMigration = false;
}

export function customerAuthFailure(status: 401 | 429): { error: string } {
  return {
    error: status === 429 ? OTP_TOO_MANY_MESSAGE : OTP_DENIAL_MESSAGE,
  };
}

/** Timing-safe compare of two SHA-256 hex digests. */
export function digestsMatch(left: string, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  try {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    if (a.length === 0 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isMissingAttemptsColumn(error: DbError): boolean {
  if (!error) return false;
  const message = String(error.message || '');
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /failed_attempts/i.test(message)
  );
}

function isMissingFailureLog(error: DbError): boolean {
  if (!error) return false;
  const message = String(error.message || '');
  return (
    error.code === '42P01' ||
    error.code === 'PGRST202' ||
    error.code === 'PGRST205' ||
    /trade_otp_failures|trade_otp_note_failure/i.test(message)
  );
}

const INVITE_COLUMNS =
  'id, customer_id, otp_hash, magic_hash, expires_at, used_at, email, created_at';

function supabaseAuthStore(): CustomerAuthStore {
  const supabase = getSupabaseServer();
  return {
    async listLiveInvites(opts) {
      const run = (columns: string) => {
        let query = supabase
          .from('trade_customer_invites')
          .select(columns)
          .eq('company_id', opts.companyId)
          .is('used_at', null)
          .gt('expires_at', new Date(opts.now).toISOString())
          .order('created_at', { ascending: false })
          .limit(8);
        if (opts.email) query = query.eq('email', opts.email);
        return query;
      };
      let found = await run(`${INVITE_COLUMNS}, failed_attempts`);
      let attemptsReady = true;
      if (isMissingAttemptsColumn(found.error)) {
        attemptsReady = false;
        found = await run(INVITE_COLUMNS);
      }
      if (isMissingTradeSchema(found.error)) throw new TradeSchemaMissingError();
      if (found.error) throw new Error(found.error.message);
      const invites = ((found.data || []) as unknown as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        customer_id: String(row.customer_id),
        email: String(row.email || ''),
        otp_hash: row.otp_hash == null ? null : String(row.otp_hash),
        magic_hash: row.magic_hash == null ? null : String(row.magic_hash),
        created_at: String(row.created_at || ''),
        failed_attempts: attemptsReady ? Number(row.failed_attempts) || 0 : 0,
      }));
      return { invites, attemptsReady };
    },
    async failureWindow(opts) {
      const since = new Date(opts.now - OTP_FAIL_WINDOW_MS).toISOString();
      const emailCount = await supabase
        .from('trade_otp_failures')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', opts.companyId)
        .eq('email', opts.email)
        .gte('created_at', since);
      if (isMissingFailureLog(emailCount.error)) {
        return { emailCount: 0, bookCount: 0, ready: false };
      }
      if (emailCount.error) throw new Error(emailCount.error.message);
      const bookCount = await supabase
        .from('trade_otp_failures')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', opts.companyId)
        .gte('created_at', since);
      if (isMissingFailureLog(bookCount.error)) {
        return { emailCount: 0, bookCount: 0, ready: false };
      }
      if (bookCount.error) throw new Error(bookCount.error.message);
      return {
        emailCount: emailCount.count || 0,
        bookCount: bookCount.count || 0,
        ready: true,
      };
    },
    async noteFailure(opts) {
      const noted = await supabase.rpc('trade_otp_note_failure', {
        p_company_id: opts.companyId,
        p_email: opts.email,
      });
      if (isMissingFailureLog(noted.error) || isMissingAttemptsColumn(noted.error)) return;
      if (noted.error) throw new Error(noted.error.message);
    },
    async markUsed(id, usedAt) {
      const updated = await supabase
        .from('trade_customer_invites')
        .update({ used_at: usedAt })
        .eq('id', id);
      if (updated.error) throw new Error(updated.error.message);
    },
    async insertSession(opts) {
      const session = await supabase.from('trade_customer_sessions').insert({
        id: opts.id,
        company_id: opts.companyId,
        customer_id: opts.customerId,
        token_hash: opts.tokenHash,
        expires_at: opts.expiresAt,
      });
      if (session.error) throw new Error(session.error.message);
    },
  };
}

export async function issueCustomerInvite(opts: {
  companyId: number;
  customerId: string;
  email: string;
}): Promise<{ otp: string; magic: string; expiresAt: string }> {
  const supabase = getSupabaseServer();
  const otp = newOtp();
  const magic = newSecret();
  const expiresAt = new Date(Date.now() + TRADE_MAGIC_DAYS * 864e5).toISOString();
  const inserted = await supabase.from('trade_customer_invites').insert({
    id: `ti_${newSecret(8)}`,
    company_id: opts.companyId,
    customer_id: opts.customerId,
    email: opts.email.trim().toLowerCase(),
    otp_hash: hashSecret(otp),
    magic_hash: hashSecret(magic),
    expires_at: expiresAt,
  });
  if (isMissingTradeSchema(inserted.error)) throw new TradeSchemaMissingError();
  if (inserted.error) throw new Error(inserted.error.message);
  return { otp, magic, expiresAt };
}

export async function openCustomerSession(opts: {
  companyId: number;
  email?: string;
  otp?: string;
  magic?: string;
  now?: number;
  store?: CustomerAuthStore;
}): Promise<OpenCustomerSessionResult> {
  const now = opts.now ?? Date.now();
  const magic = String(opts.magic || '').trim();
  const email = String(opts.email || '').trim().toLowerCase();
  const magicMode = magic.length > 0;
  if (!magicMode && !email) return { ok: false, status: 401 };

  const store = opts.store ?? supabaseAuthStore();
  let durable = !magicMode;
  if (!magicMode) {
    const window = await store.failureWindow({ companyId: opts.companyId, email, now });
    if (!window.ready) {
      durable = false;
      warnOtpMigration();
    } else if (
      window.emailCount >= OTP_FAILS_PER_EMAIL ||
      window.bookCount >= OTP_FAILS_PER_BOOK
    ) {
      return { ok: false, status: 429 };
    }
  }

  const listed = await store.listLiveInvites({
    companyId: opts.companyId,
    email: magicMode ? undefined : email,
    now,
  });
  if (!listed.attemptsReady) {
    durable = false;
    warnOtpMigration();
  }

  const otpDigest = opts.otp ? hashSecret(String(opts.otp).trim()) : '';
  const magicDigest = magic ? hashSecret(magic) : '';
  let match: LiveInvite | null = null;
  for (const row of listed.invites) {
    if (!magicMode && row.failed_attempts >= OTP_FAILS_PER_CODE) {
      try {
        await store.markUsed(row.id, new Date(now).toISOString());
      } catch {
        console.warn('TradeAdvisor® could not burn a sign-in code after too many tries.');
      }
      continue;
    }
    if (magicMode) {
      if (digestsMatch(magicDigest, row.magic_hash)) {
        match = row;
        break;
      }
      continue;
    }
    if (!digestsMatch(otpDigest, row.otp_hash)) continue;
    const created = Date.parse(String(row.created_at || ''));
    const fresh =
      Number.isFinite(created) && now - created <= TRADE_OTP_MINUTES * 60 * 1000;
    if (fresh && row.email.trim().toLowerCase() === email) {
      match = row;
      break;
    }
  }

  if (!match) {
    if (!magicMode && durable) {
      try {
        await store.noteFailure({ companyId: opts.companyId, email, now });
      } catch {
        console.warn('TradeAdvisor® could not record a failed sign-in code attempt.');
      }
    }
    return { ok: false, status: 401 };
  }

  const token = newSecret();
  await store.insertSession({
    id: `ts_${newSecret(8)}`,
    companyId: opts.companyId,
    customerId: match.customer_id,
    tokenHash: hashSecret(token),
    expiresAt: new Date(now + TRADE_SESSION_DAYS * 864e5).toISOString(),
  });
  try {
    await store.markUsed(match.id, new Date(now).toISOString());
  } catch {
    console.warn('TradeAdvisor® could not mark a used sign-in code.');
  }
  return { ok: true, token, customerId: match.customer_id };
}

export async function customerFromSession(
  token: string
): Promise<{ companyId: number; customerId: string } | null> {
  if (!token || token.length < 20) return null;
  const supabase = getSupabaseServer();
  const found = await supabase
    .from('trade_customer_sessions')
    .select('company_id, customer_id, expires_at, revoked_at')
    .eq('token_hash', hashSecret(token))
    .maybeSingle();
  if (found.error || !found.data) return null;
  const row = found.data as {
    company_id: number;
    customer_id: string;
    expires_at: string;
    revoked_at: string | null;
  };
  if (row.revoked_at) return null;
  if (Date.parse(row.expires_at) < Date.now()) return null;
  return { companyId: Number(row.company_id), customerId: String(row.customer_id) };
}

async function readRecentInviteCount(
  companyId: number,
  email: string,
  sinceIso: string
): Promise<{ count: number | null; error: DbError }> {
  const supabase = getSupabaseServer();
  const found = await supabase
    .from('trade_customer_invites')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('email', email.trim().toLowerCase())
    .gte('created_at', sinceIso);
  return { count: found.count, error: found.error };
}

export async function recentInviteCount(
  companyId: number,
  email: string,
  read: RecentInviteRead = readRecentInviteCount
): Promise<number> {
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  try {
    const found = await read(companyId, email, sinceIso);
    if (found.error) return OTP_HOURLY_CAP;
    return found.count || 0;
  } catch {
    return OTP_HOURLY_CAP;
  }
}

/**
 * Sends a code only when the address is on the book and under the hourly cap.
 * A database error is over the cap: nothing is sent, and the caller still
 * returns the generic receipt.
 */
export async function respondToOtpRequest(opts: {
  companyId: number;
  email: string;
  hasCustomer: boolean;
  send: () => Promise<void>;
  read?: RecentInviteRead;
}): Promise<typeof TRADE_INVITE_GENERIC> {
  if (!opts.hasCustomer) return TRADE_INVITE_GENERIC;
  const count = await recentInviteCount(opts.companyId, opts.email, opts.read);
  if (count >= OTP_HOURLY_CAP) return TRADE_INVITE_GENERIC;
  await opts.send();
  return TRADE_INVITE_GENERIC;
}

export async function customerPushSubs(customerId: string): Promise<
  Array<{ endpoint: string; p256dh: string; auth: string }>
> {
  const supabase = getSupabaseServer();
  const found = await supabase
    .from('trade_customer_push')
    .select('endpoint, p256dh, auth')
    .eq('customer_id', customerId);
  if (found.error || !found.data) return [];
  return found.data.map((row) => ({
    endpoint: String(row.endpoint),
    p256dh: String(row.p256dh),
    auth: String(row.auth),
  }));
}
