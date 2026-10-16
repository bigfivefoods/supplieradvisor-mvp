/**
 * Brief 118: registration and claim writes.
 * The trial update is its own statement. Optional columns (region, sub_industries,
 * coordinates) can be missing until the migration is applied; they must not block the trial.
 */
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_SUBSCRIPTION_PLAN,
  COMPANY_TRIAL_DAYS,
  addDays,
} from '../billing/company-subscription';

export type Db = { from(table: string): any };

export type DbErrorInfo = { code: string; message: string };

export const PROFILE_SUBSCRIPTION_COLUMNS = [
  'subscription_status',
  'subscription_trial_ends_at',
  'subscription_starts_at',
  'subscription_ends_at',
  'subscription_plan',
  'subscription_amount_zar',
] as const;

/**
 * Every profiles column the registration and directory-claim routes can write.
 * Subscription keys are written only by the checked trial/lifetime update.
 */
export const PROFILE_REGISTRATION_WRITE_COLUMNS = [
  'trading_name',
  'legal_name',
  'registration_number',
  'industry',
  'industries',
  'sub_industries',
  'sub_industry',
  'vat_number',
  'province',
  'region',
  'continent',
  'street',
  'address',
  'postal_code',
  'description',
  'primary_currency',
  'settings',
  'business_type',
  'org_type',
  'country',
  'city',
  'website',
  'contact_name',
  'contact_phone',
  'email',
  'short_description',
  'supplier_status',
  'relationship_type',
  'is_discoverable',
  'user_id',
  'created_at',
  'claimed_at',
  'updated_at',
  'referred_by_profile_id',
  'referred_at',
  'referral_source',
  ...PROFILE_SUBSCRIPTION_COLUMNS,
] as const;

export function registrationColumnsWithoutSubscription(): string[] {
  const subscription = new Set<string>(PROFILE_SUBSCRIPTION_COLUMNS);
  return PROFILE_REGISTRATION_WRITE_COLUMNS.filter((column) => !subscription.has(column));
}

export function trialWindow(now: string | Date = new Date()): {
  now: string;
  trialEnds: string;
} {
  const date = now instanceof Date ? now : new Date(now);
  return {
    now: date.toISOString(),
    trialEnds: addDays(date, COMPANY_TRIAL_DAYS).toISOString(),
  };
}

function errorInfo(error: unknown, fallback = 'update failed'): DbErrorInfo {
  if (!error || typeof error !== 'object') {
    return { code: 'empty', message: fallback };
  }
  const row = error as { code?: unknown; message?: unknown };
  const code = row.code != null && String(row.code) ? String(row.code) : 'unknown';
  const message =
    row.message != null && String(row.message) ? String(row.message) : fallback;
  return { code, message };
}

/**
 * PostgREST schema-cache misses and Postgres 42703 undefined-column errors.
 * Same family as lib/system/platform-company.ts.
 */
export function missingColumnFromError(err: unknown): string | null {
  if (!err) return null;
  const message =
    typeof err === 'string'
      ? err
      : typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message || '')
        : '';
  const code =
    typeof err === 'object' && err && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';

  const quotedRelation = message.match(
    /column "([^"]+)" of relation "[^"]+" does not exist/i
  );
  if (quotedRelation?.[1]) return quotedRelation[1];

  const qualified = message.match(
    /column ([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*) does not exist/i
  );
  if (qualified?.[2]) return qualified[2];

  const postgrest = message.match(/Could not find the '([^']+)' column/i);
  if (postgrest?.[1]) return postgrest[1];

  const quoted = message.match(/column "([^"]+)" does not exist/i);
  if (quoted?.[1]) return quoted[1];

  if (code === '42703' || code === 'PGRST204') {
    const loose = message.match(/['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/);
    if (loose?.[1] && loose[1] !== 'profiles') return loose[1];
  }
  return null;
}

export function buildSubscriptionPatch(input: {
  lifetimePlan: string | null;
  now: string;
  trialEnds: string;
}): Record<string, unknown> {
  if (input.lifetimePlan) {
    return {
      subscription_status: 'lifetime',
      subscription_starts_at: input.now,
      subscription_ends_at: null,
      subscription_trial_ends_at: null,
      subscription_plan: input.lifetimePlan,
      subscription_amount_zar: 0,
    };
  }
  return {
    subscription_status: 'trial',
    subscription_trial_ends_at: input.trialEnds,
    subscription_starts_at: input.now,
    subscription_plan: COMPANY_SUBSCRIPTION_PLAN,
    subscription_amount_zar: COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProtectedColumn(key: string, protect: readonly string[]): boolean {
  return protect.includes(key) || key.startsWith('subscription_');
}

/**
 * An insert that drops one of these and still reports success would persist a
 * row the app treats as created. Optional columns (region, coordinates) may
 * still be stripped; these may not.
 */
const REQUIRED_PROFILE_INSERT_COLUMNS = new Set<string>([
  'user_id',
  'trading_name',
  'email',
  'created_at',
]);

export async function writeSubscriptionChecked(
  db: Db,
  profileId: number,
  patch: Record<string, unknown>,
  opts?: { attempts?: number; sleep?: (ms: number) => Promise<void> }
): Promise<{ ok: boolean; attempts: number; error?: DbErrorInfo }> {
  const attempts = opts?.attempts ?? 3;
  const sleep = opts?.sleep ?? defaultSleep;
  let last: DbErrorInfo = { code: 'empty', message: 'no row' };

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { data, error } = await db
        .from('profiles')
        .update(patch)
        .eq('id', profileId)
        .select('id, subscription_status, subscription_trial_ends_at')
        .maybeSingle();
      if (
        !error &&
        data &&
        data.subscription_status === patch.subscription_status
      ) {
        return { ok: true, attempts: attempt };
      }
      last = error ? errorInfo(error, 'no row') : { code: 'empty', message: 'no row' };
    } catch (err) {
      last = {
        code: 'throw',
        message: err instanceof Error ? err.message : 'update failed',
      };
    }
    if (attempt < attempts) await sleep(40 * attempt);
  }

  console.error('[register-business] TRIAL_WRITE_FAILED', {
    profileId,
    code: last.code,
    message: last.message,
  });
  return { ok: false, attempts, error: last };
}

export async function updateProfileTolerant(
  db: Db,
  profileId: number,
  patch: Record<string, unknown>,
  opts?: { protect?: readonly string[] }
): Promise<{ ok: boolean; dropped: string[]; error?: DbErrorInfo }> {
  const protect = opts?.protect ?? [];
  const current: Record<string, unknown> = { ...patch };
  const dropped: string[] = [];
  const cap = Math.max(1, Object.keys(patch).length + 1);

  for (let i = 0; i < cap; i++) {
    try {
      const { error } = await db.from('profiles').update(current).eq('id', profileId);
      if (!error) return { ok: true, dropped };
      const missing = missingColumnFromError(error);
      if (
        missing &&
        Object.prototype.hasOwnProperty.call(current, missing) &&
        !isProtectedColumn(missing, protect)
      ) {
        delete current[missing];
        dropped.push(missing);
        continue;
      }
      return { ok: false, dropped, error: errorInfo(error) };
    } catch (err) {
      return {
        ok: false,
        dropped,
        error: {
          code: 'throw',
          message: err instanceof Error ? err.message : 'update failed',
        },
      };
    }
  }

  return {
    ok: false,
    dropped,
    error: { code: 'retry_cap', message: 'too many missing columns' },
  };
}

export async function insertProfileTolerant(
  db: Db,
  row: Record<string, unknown>,
  opts?: { protect?: readonly string[] }
): Promise<{
  ok: boolean;
  dropped: string[];
  data?: { id: number; trading_name?: string | null };
  error?: DbErrorInfo;
}> {
  const protect = opts?.protect ?? [];
  const current: Record<string, unknown> = { ...row };
  const dropped: string[] = [];
  const cap = Math.max(1, Object.keys(row).length + 1);

  for (let i = 0; i < cap; i++) {
    try {
      const { data, error } = await db
        .from('profiles')
        .insert(current)
        .select('id, trading_name')
        .maybeSingle();
      if (!error && data && Number.isFinite(Number(data.id))) {
        return {
          ok: true,
          dropped,
          data: {
            id: Number(data.id),
            trading_name: data.trading_name ?? null,
          },
        };
      }
      const missing = missingColumnFromError(error);
      if (
        missing &&
        Object.prototype.hasOwnProperty.call(current, missing) &&
        !REQUIRED_PROFILE_INSERT_COLUMNS.has(missing) &&
        !isProtectedColumn(missing, protect)
      ) {
        delete current[missing];
        dropped.push(missing);
        continue;
      }
      return {
        ok: false,
        dropped,
        error: error ? errorInfo(error, 'insert failed') : { code: 'empty', message: 'no row' },
      };
    } catch (err) {
      return {
        ok: false,
        dropped,
        error: {
          code: 'throw',
          message: err instanceof Error ? err.message : 'insert failed',
        },
      };
    }
  }

  return {
    ok: false,
    dropped,
    error: { code: 'retry_cap', message: 'too many missing columns' },
  };
}

function claimedUserId(value: unknown): boolean {
  return value != null && String(value).trim().length > 0;
}

/**
 * Idempotent claim-time trial. No-op unless the profile is claimed (user_id
 * set, or an active owner/admin link) and the row still has status
 * null/none/'' with both trial and end dates null. The filters are the write
 * guard: a concurrent start cannot overwrite a trial or paid row.
 */
export async function ensureTrialForClaimedProfile(
  db: Db,
  profileId: number,
  opts: { now: string; trialEnds: string }
): Promise<{ started: boolean; error?: DbErrorInfo }> {
  const patch = buildSubscriptionPatch({
    lifetimePlan: null,
    now: opts.now,
    trialEnds: opts.trialEnds,
  });
  try {
    const { data: profile, error: readError } = await db
      .from('profiles')
      .select('id, user_id')
      .eq('id', profileId)
      .maybeSingle();
    if (readError) return { started: false, error: errorInfo(readError) };

    let claimed = claimedUserId(profile?.user_id);
    if (!claimed) {
      const { data: owner, error: ownerError } = await db
        .from('business_users')
        .select('user_id')
        .eq('profile_id', profileId)
        .eq('status', 'active')
        .in('role', ['owner', 'admin'])
        .limit(1)
        .maybeSingle();
      if (ownerError) return { started: false, error: errorInfo(ownerError) };
      claimed = Boolean(owner);
    }
    if (!claimed) return { started: false };

    const { data, error } = await db
      .from('profiles')
      .update(patch)
      .eq('id', profileId)
      .or('subscription_status.is.null,subscription_status.eq.none,subscription_status.eq.')
      .is('subscription_trial_ends_at', null)
      .is('subscription_ends_at', null)
      .select('id')
      .maybeSingle();
    if (error) return { started: false, error: errorInfo(error) };
    return { started: Boolean(data?.id) };
  } catch (err) {
    return {
      started: false,
      error: {
        code: 'throw',
        message: err instanceof Error ? err.message : 'update failed',
      },
    };
  }
}

export async function writeRegistrationAfterCreate(
  db: Db,
  profileId: number,
  input: {
    subscriptionPatch: Record<string, unknown>;
    detailsPatch: Record<string, unknown>;
    attempts?: number;
    sleep?: (ms: number) => Promise<void>;
  }
): Promise<{
  persisted: boolean;
  trialPersisted: boolean;
  attempts: number;
  warnings: string[];
  dropped: string[];
}> {
  const warnings: string[] = [];
  const subscription = await writeSubscriptionChecked(db, profileId, input.subscriptionPatch, {
    attempts: input.attempts,
    sleep: input.sleep,
  });
  const details = await updateProfileTolerant(db, profileId, input.detailsPatch, {
    protect: [],
  });
  if (details.dropped.length) {
    console.warn('[register-business] profile columns skipped', {
      profileId,
      columns: details.dropped,
    });
    warnings.push(`profile_columns_skipped:${details.dropped.join(',')}`);
  }
  if (!details.ok) {
    console.error('[register-business] profile details failed', {
      profileId,
      code: details.error?.code,
      message: details.error?.message,
    });
    warnings.push('profile_details_failed');
  }
  if (!subscription.ok) warnings.push('trial_not_started');
  const isTrial = input.subscriptionPatch.subscription_status === 'trial';
  return {
    persisted: subscription.ok,
    trialPersisted: subscription.ok && isTrial,
    attempts: subscription.attempts,
    warnings,
    dropped: details.dropped,
  };
}
