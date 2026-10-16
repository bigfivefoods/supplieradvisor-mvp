/**
 * Brief 118: onboarding write order. Fake Db, no network.
 * Run: npx --yes tsx lib/onboarding/brief118-write-order.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMPANY_TRIAL_DAYS,
  addDays,
} from '../billing/company-subscription';
import {
  PROFILE_SUBSCRIPTION_COLUMNS,
  buildSubscriptionPatch,
  ensureTrialForClaimedProfile,
  insertProfileTolerant,
  missingColumnFromError,
  trialWindow,
  updateProfileTolerant,
  writeRegistrationAfterCreate,
  type Db,
} from './profile-writes';

assert.equal(COMPANY_TRIAL_DAYS, 30);
assert.equal(
  missingColumnFromError({
    code: 'PGRST204',
    message: "Could not find the 'region' column of 'profiles' in the schema cache",
  }),
  'region'
);
assert.equal(
  missingColumnFromError({
    code: '42703',
    message: 'column "sub_industries" of relation "profiles" does not exist',
  }),
  'sub_industries'
);
assert.equal(
  missingColumnFromError({
    code: '42703',
    message: 'column profiles.lat does not exist',
  }),
  'lat'
);
assert.equal(missingColumnFromError({ code: '23505', message: 'duplicate key' }), null);

const NOW = '2026-10-16T00:00:00.000Z';
const TRIAL_ENDS = addDays(NOW, COMPANY_TRIAL_DAYS).toISOString();
assert.equal(TRIAL_ENDS, '2026-11-15T00:00:00.000Z');
const opened = trialWindow(NOW);
assert.equal(opened.now, NOW);
assert.equal(opened.trialEnds, '2026-11-15T00:00:00.000Z');

const TRIAL_STATUS_OR =
  'subscription_status.is.null,subscription_status.eq.none,subscription_status.eq.';

type Row = Record<string, unknown> & { id: number };
type Filter =
  | { type: 'eq'; col: string; val: unknown }
  | { type: 'is'; col: string; val: unknown }
  | { type: 'in'; col: string; val: readonly unknown[] }
  | { type: 'or'; expr: string };

function matches(row: Record<string, unknown>, filters: Filter[]): boolean {
  for (const filter of filters) {
    if (filter.type === 'eq' && row[filter.col] !== filter.val) return false;
    if (filter.type === 'is') {
      if (filter.val === null) {
        if (row[filter.col] != null) return false;
      } else if (row[filter.col] !== filter.val) return false;
    }
    if (filter.type === 'in' && !filter.val.includes(row[filter.col])) return false;
    if (filter.type === 'or') {
      if (filter.expr !== TRIAL_STATUS_OR) return false;
      const status = row.subscription_status;
      if (!(status == null || status === 'none' || status === '')) return false;
    }
  }
  return true;
}

function createDb(
  initial: Row[],
  behavior?: {
    subscriptionFailures?: number;
    detailsMode?: 'ok' | 'missing-optional' | 'other';
    rejectColumn?: string;
    memberships?: Record<string, unknown>[];
  }
) {
  const rows = initial.map((row) => ({ ...row }));
  const memberships = (behavior?.memberships ?? []).map((row) => ({ ...row }));
  const calls: { op: string; payload: Record<string, unknown> }[] = [];
  let subscriptionFailures = behavior?.subscriptionFailures ?? 0;

  function resultFor(
    op: string,
    payload: Record<string, unknown>,
    filters: Filter[]
  ) {
    calls.push({ op, payload: { ...payload } });
    if (
      behavior?.rejectColumn &&
      Object.prototype.hasOwnProperty.call(payload, behavior.rejectColumn)
    ) {
      const column = behavior.rejectColumn;
      return {
        data: null,
        error: {
          code: '42703',
          message: `column "${column}" of relation "profiles" does not exist`,
        },
      };
    }
    const subscriptionOnly =
      Object.keys(payload).length > 0 &&
      Object.keys(payload).every((key) => key.startsWith('subscription_'));
    if (subscriptionOnly && subscriptionFailures > 0) {
      subscriptionFailures -= 1;
      return {
        data: null,
        error: { code: '08006', message: 'connection failure' },
      };
    }
    if (!subscriptionOnly && behavior?.detailsMode === 'missing-optional') {
      if (Object.prototype.hasOwnProperty.call(payload, 'region')) {
        return {
          data: null,
          error: {
            code: 'PGRST204',
            message: "Could not find the 'region' column of 'profiles' in the schema cache",
          },
        };
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'sub_industries')) {
        return {
          data: null,
          error: {
            code: 'PGRST204',
            message:
              "Could not find the 'sub_industries' column of 'profiles' in the schema cache",
          },
        };
      }
    }
    if (!subscriptionOnly && behavior?.detailsMode === 'other') {
      return {
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      };
    }
    if (op === 'insert') {
      const row = { id: rows.length + 1, ...payload } as Row;
      rows.push(row);
      return { data: { ...row }, error: null };
    }
    const matched = rows.filter((row) => matches(row, filters));
    if (!matched.length) return { data: null, error: null };
    for (const row of matched) Object.assign(row, payload);
    return { data: { ...matched[0] }, error: null };
  }

  function read(table: string, filters: Filter[], limit: number | null) {
    const source = table === 'business_users' ? memberships : rows;
    const matched = source.filter((row) => matches(row, filters));
    const limited = limit == null ? matched : matched.slice(0, limit);
    return { data: limited[0] ? { ...limited[0] } : null, error: null };
  }

  const db: Db = {
    from(table: string) {
      if (table !== 'profiles' && table !== 'business_users') {
        throw new Error(`unexpected table ${table}`);
      }
      let op = 'select';
      let payload: Record<string, unknown> = {};
      const filters: Filter[] = [];
      let limit: number | null = null;
      const chain = {
        update(next: Record<string, unknown>) {
          op = 'update';
          payload = { ...next };
          return chain;
        },
        insert(next: Record<string, unknown>) {
          op = 'insert';
          payload = { ...next };
          return chain;
        },
        eq(col: string, val: unknown) {
          filters.push({ type: 'eq', col, val });
          return chain;
        },
        in(col: string, val: readonly unknown[]) {
          filters.push({ type: 'in', col, val });
          return chain;
        },
        or(expr: string) {
          filters.push({ type: 'or', expr });
          return chain;
        },
        is(col: string, val: unknown) {
          filters.push({ type: 'is', col, val });
          return chain;
        },
        limit(n: number) {
          limit = n;
          return chain;
        },
        select() {
          return chain;
        },
        maybeSingle() {
          const value =
            op === 'select' ? read(table, filters, limit) : resultFor(op, payload, filters);
          return Promise.resolve(value);
        },
        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          const value =
            op === 'select' ? read(table, filters, limit) : resultFor(op, payload, filters);
          return Promise.resolve(value).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
  };
  return { db, rows, calls };
}

function invocationCount(source: string, name: string): number {
  return source.match(new RegExp(`\\b${name}\\s*\\(`, 'g'))?.length ?? 0;
}

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing ${end} after ${start}`);
  return source.slice(from, to);
}

function silence() {
  const errors: unknown[][] = [];
  const warns: unknown[][] = [];
  const origErr = console.error;
  const origWarn = console.warn;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  console.warn = (...args: unknown[]) => {
    warns.push(args);
  };
  return {
    errors,
    warns,
    restore() {
      console.error = origErr;
      console.warn = origWarn;
    },
  };
}

const trialPatch = buildSubscriptionPatch({
  lifetimePlan: null,
  now: NOW,
  trialEnds: TRIAL_ENDS,
});
const detailsPatch = {
  trading_name: 'Example Co',
  region: 'Western Cape',
  sub_industries: ['Bakery'],
  province: 'Western Cape',
};

async function main() {
  const quiet = silence();
  try {
    const memory = createDb(
      [{ id: 42, subscription_status: 'none' }],
      { detailsMode: 'missing-optional' }
    );
    const sleeps: number[] = [];
    const written = await writeRegistrationAfterCreate(memory.db, 42, {
      subscriptionPatch: trialPatch,
      detailsPatch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    assert.equal(memory.calls[0].op, 'update');
    assert.ok(
      Object.keys(memory.calls[0].payload).every((key) => key.startsWith('subscription_'))
    );
    assert.ok(memory.calls.slice(1).every((call) => !('subscription_status' in call.payload)));
    assert.ok(
      memory.calls.findIndex((call) => 'region' in call.payload) >
        memory.calls.findIndex((call) => call.payload.subscription_status === 'trial')
    );
    assert.equal(written.trialPersisted, true);
    assert.equal(written.attempts, 1);
    assert.equal(sleeps.length, 0);
    assert.deepEqual(written.dropped, ['region', 'sub_industries']);
    assert.ok(written.warnings.includes('profile_columns_skipped:region,sub_industries'));
    assert.equal(memory.rows[0].subscription_status, 'trial');
    assert.equal(memory.rows[0].subscription_trial_ends_at, TRIAL_ENDS);
    assert.equal(memory.rows[0].subscription_starts_at, NOW);
    assert.equal(memory.rows[0].subscription_plan, 'company_monthly');
    assert.equal(memory.rows[0].subscription_amount_zar, 299);
    assert.equal(memory.rows[0].trading_name, 'Example Co');
    assert.equal(memory.rows[0].province, 'Western Cape');
    assert.equal(memory.rows[0].region, undefined);
    assert.equal(
      quiet.errors.some((args) => String(args[0]).includes('TRIAL_WRITE_FAILED')),
      false
    );

    const other = createDb([{ id: 7, subscription_status: 'none', trading_name: 'Kept' }], {
      detailsMode: 'other',
    });
    const otherWrite = await writeRegistrationAfterCreate(other.db, 7, {
      subscriptionPatch: trialPatch,
      detailsPatch: { trading_name: 'Should not land', city: 'Durban' },
      sleep: async () => {},
    });
    assert.equal(otherWrite.trialPersisted, true);
    assert.ok(otherWrite.warnings.includes('profile_details_failed'));
    assert.equal(other.rows[0].subscription_status, 'trial');
    assert.equal(other.rows[0].subscription_trial_ends_at, TRIAL_ENDS);
    assert.equal(other.rows[0].trading_name, 'Kept');

    const retry = createDb([{ id: 8, subscription_status: 'none' }], {
      subscriptionFailures: 2,
    });
    const retrySleeps: number[] = [];
    const retryWrite = await writeRegistrationAfterCreate(retry.db, 8, {
      subscriptionPatch: trialPatch,
      detailsPatch: { city: 'Durban' },
      sleep: async (ms) => {
        retrySleeps.push(ms);
      },
    });
    assert.equal(retryWrite.trialPersisted, true);
    assert.equal(retryWrite.attempts, 3);
    assert.equal(retrySleeps.length, 2);
    assert.equal(retry.rows[0].subscription_status, 'trial');
    const subscriptionCalls = retry.calls.filter((call) =>
      Object.keys(call.payload).every((key) => key.startsWith('subscription_'))
    );
    assert.equal(subscriptionCalls.length, 3);

    const failed = createDb([{ id: 9, subscription_status: 'none', trading_name: 'Created' }], {
      subscriptionFailures: 5,
    });
    const beforeErrors = quiet.errors.length;
    const failedWrite = await writeRegistrationAfterCreate(failed.db, 9, {
      subscriptionPatch: trialPatch,
      detailsPatch: { city: 'Durban' },
      sleep: async () => {},
    });
    assert.equal(failedWrite.trialPersisted, false);
    assert.equal(failedWrite.persisted, false);
    assert.equal(failedWrite.attempts, 3);
    assert.ok(failedWrite.warnings.includes('trial_not_started'));
    assert.equal(failed.rows.length, 1);
    assert.equal(failed.rows[0].id, 9);
    assert.equal(failed.rows[0].trading_name, 'Created');
    assert.equal(failed.rows[0].subscription_status, 'none');
    const trialLogs = quiet.errors
      .slice(beforeErrors)
      .filter((args) => String(args[0]).includes('TRIAL_WRITE_FAILED'));
    assert.equal(trialLogs.length, 1);
    assert.equal((trialLogs[0][1] as { profileId: number }).profileId, 9);

    const lifetimePatch = buildSubscriptionPatch({
      lifetimePlan: 'founder_lifetime',
      now: NOW,
      trialEnds: TRIAL_ENDS,
    });
    assert.equal(lifetimePatch.subscription_status, 'lifetime');
    assert.equal(lifetimePatch.subscription_trial_ends_at, null);
    assert.equal(lifetimePatch.subscription_ends_at, null);
    assert.equal(lifetimePatch.subscription_amount_zar, 0);
    assert.equal(lifetimePatch.subscription_starts_at, NOW);
    const life = createDb([{ id: 10, subscription_status: 'none' }]);
    const lifeWrite = await writeRegistrationAfterCreate(life.db, 10, {
      subscriptionPatch: lifetimePatch,
      detailsPatch: { city: 'Cape Town' },
      sleep: async () => {},
    });
    assert.equal(lifeWrite.trialPersisted, false);
    assert.equal(lifeWrite.persisted, true);
    assert.equal(life.rows[0].subscription_status, 'lifetime');
    assert.equal(life.rows[0].subscription_trial_ends_at, null);
    assert.equal(life.rows[0].subscription_ends_at, null);
    assert.equal(life.calls[0].payload.subscription_plan, 'founder_lifetime');

    const protectedWrite = createDb([{ id: 11, subscription_status: 'none' }], {
      rejectColumn: 'subscription_status',
    });
    const protectedResult = await updateProfileTolerant(
      protectedWrite.db,
      11,
      { region: 'x', subscription_status: 'trial', subscription_plan: 'company_monthly' },
      { protect: [] }
    );
    assert.equal(protectedResult.ok, false);
    assert.deepEqual(protectedResult.dropped, []);
    assert.ok(protectedWrite.calls.every((call) => call.payload.subscription_status === 'trial'));

    const stripRegion = createDb([{ id: 12, subscription_status: 'none' }], {
      detailsMode: 'missing-optional',
    });
    const stripped = await updateProfileTolerant(
      stripRegion.db,
      12,
      { region: 'x', subscription_status: 'trial', city: 'Durban' },
      { protect: [] }
    );
    assert.equal(stripped.ok, true);
    assert.deepEqual(stripped.dropped, ['region']);
    assert.ok(stripRegion.calls.every((call) => call.payload.subscription_status === 'trial'));
    assert.equal(stripRegion.rows[0].subscription_status, 'trial');
    assert.equal(stripRegion.rows[0].city, 'Durban');

    const insertDb = createDb([], { detailsMode: 'missing-optional' });
    const inserted = await insertProfileTolerant(
      insertDb.db,
      { trading_name: 'Example Co', region: 'x', subscription_status: 'trial' },
      { protect: ['subscription_status'] }
    );
    assert.equal(inserted.ok, true);
    assert.deepEqual(inserted.dropped, ['region']);
    assert.equal(insertDb.rows[0].subscription_status, 'trial');
    assert.equal(insertDb.rows[0].region, undefined);
    assert.ok(insertDb.calls.every((call) => call.payload.subscription_status === 'trial'));

    const blockedInsert = createDb([], { detailsMode: 'other' });
    const blocked = await insertProfileTolerant(
      blockedInsert.db,
      { trading_name: 'Example Co', subscription_status: 'trial' },
      { protect: ['subscription_status'] }
    );
    assert.equal(blocked.ok, false);
    assert.deepEqual(blocked.dropped, []);
    assert.equal(blockedInsert.rows.length, 0);
    assert.equal(blockedInsert.calls[0].payload.subscription_status, 'trial');

    for (const column of ['user_id', 'trading_name', 'email', 'created_at'] as const) {
      const required = createDb([], { rejectColumn: column });
      const payload = {
        user_id: 'user-1',
        trading_name: 'Example Co',
        email: 'a@b.co',
        created_at: NOW,
      };
      const failedRequired = await insertProfileTolerant(required.db, payload, {
        protect: [],
      });
      assert.equal(failedRequired.ok, false, column);
      assert.deepEqual(failedRequired.dropped, [], column);
      assert.equal(required.rows.length, 0, column);
      assert.equal(required.calls.at(-1)?.payload[column], payload[column], column);
    }

    const helperSource = readFileSync('lib/onboarding/profile-writes.ts', 'utf8');
    const trialSource = helperSource.slice(
      helperSource.indexOf('export async function ensureTrialForClaimedProfile'),
      helperSource.indexOf('export async function writeRegistrationAfterCreate')
    );
    const orCall = `.or('${TRIAL_STATUS_OR}')`;
    assert.ok(trialSource.includes(orCall), `missing ${orCall}`);
    assert.ok(
      trialSource.includes(".is('subscription_trial_ends_at', null)"),
      'missing trial_ends_at guard'
    );
    assert.ok(
      trialSource.includes(".is('subscription_ends_at', null)"),
      'missing subscription_ends_at guard'
    );

    async function claim(
      row: Row,
      memberships?: Record<string, unknown>[]
    ) {
      const db = createDb([row], { memberships });
      const result = await ensureTrialForClaimedProfile(db.db, row.id, {
        now: NOW,
        trialEnds: TRIAL_ENDS,
      });
      return { result, row: db.rows[0] };
    }
    for (const status of ['trial', 'active', 'lifetime']) {
      const existing = await claim({
        id: 20,
        user_id: 'owner-1',
        subscription_status: status,
        subscription_trial_ends_at: null,
        subscription_ends_at: null,
      });
      assert.equal(existing.result.started, false, status);
      assert.equal(existing.row.subscription_status, status);
    }
    const withEnd = await claim({
      id: 21,
      user_id: 'owner-1',
      subscription_status: 'none',
      subscription_trial_ends_at: null,
      subscription_ends_at: '2027-01-01T00:00:00.000Z',
    });
    assert.equal(withEnd.result.started, false);
    assert.equal(withEnd.row.subscription_ends_at, '2027-01-01T00:00:00.000Z');
    assert.equal(withEnd.row.subscription_status, 'none');
    const withTrialEnd = await claim({
      id: 24,
      user_id: 'owner-1',
      subscription_status: 'none',
      subscription_trial_ends_at: '2026-12-01T00:00:00.000Z',
      subscription_ends_at: null,
    });
    assert.equal(withTrialEnd.result.started, false, 'trial_ends_at guard');
    assert.equal(withTrialEnd.row.subscription_trial_ends_at, '2026-12-01T00:00:00.000Z');
    assert.equal(withTrialEnd.row.subscription_status, 'none');

    const unclaimed = await claim({
      id: 25,
      subscription_status: 'none',
      subscription_trial_ends_at: null,
      subscription_ends_at: null,
    });
    assert.equal(unclaimed.result.started, false);
    assert.equal(unclaimed.result.error, undefined);
    assert.equal(unclaimed.row.subscription_status, 'none');
    const viewer = await claim(
      {
        id: 26,
        subscription_status: 'none',
        subscription_trial_ends_at: null,
        subscription_ends_at: null,
      },
      [{ profile_id: 26, user_id: 'viewer-1', role: 'viewer', status: 'active' }]
    );
    assert.equal(viewer.result.started, false);
    assert.equal(viewer.row.subscription_status, 'none');
    const inactiveOwner = await claim(
      {
        id: 27,
        subscription_status: 'none',
        subscription_trial_ends_at: null,
        subscription_ends_at: null,
      },
      [{ profile_id: 27, user_id: 'owner-old', role: 'owner', status: 'removed' }]
    );
    assert.equal(inactiveOwner.result.started, false);
    assert.equal(inactiveOwner.row.subscription_status, 'none');
    const ownerLink = await claim(
      {
        id: 28,
        subscription_status: 'none',
        subscription_trial_ends_at: null,
        subscription_ends_at: null,
      },
      [{ profile_id: 28, user_id: 'owner-2', role: 'owner', status: 'active' }]
    );
    assert.equal(ownerLink.result.started, true);
    assert.equal(ownerLink.row.subscription_status, 'trial');
    assert.equal(ownerLink.row.subscription_trial_ends_at, TRIAL_ENDS);

    const fresh = createDb([
      {
        id: 22,
        user_id: 'owner-1',
        subscription_status: 'none',
        subscription_trial_ends_at: null,
        subscription_ends_at: null,
      },
    ]);
    const started = await ensureTrialForClaimedProfile(fresh.db, 22, {
      now: NOW,
      trialEnds: TRIAL_ENDS,
    });
    assert.equal(started.started, true);
    assert.equal(fresh.rows[0].subscription_status, 'trial');
    assert.equal(fresh.rows[0].subscription_trial_ends_at, TRIAL_ENDS);
    assert.equal(fresh.rows[0].subscription_amount_zar, 299);
    const again = await ensureTrialForClaimedProfile(fresh.db, 22, {
      now: NOW,
      trialEnds: '2030-01-01T00:00:00.000Z',
    });
    assert.equal(again.started, false);
    assert.equal(fresh.rows[0].subscription_trial_ends_at, TRIAL_ENDS);

    const route = readFileSync('app/api/onboarding/register-business/route.ts', 'utf8');
    assert.equal(route.includes('withoutSub'), false);
    const rpcAt = route.indexOf('sa_register_company_with_owner');
    const writeAt = route.indexOf('writeRegistrationAfterCreate', rpcAt);
    assert.ok(writeAt > rpcAt);
    const claimAt = route.indexOf('const claimPatch');
    const claimUpdate = route.indexOf('updateProfileTolerant', claimAt);
    const claimTrial = route.indexOf('ensureTrialForClaimedProfile', claimUpdate);
    assert.ok(claimUpdate > claimAt && claimTrial > claimUpdate);
    assert.match(
      route,
      /if\s*\(\s*claimWrite\.ok\s*\)\s*\{[\s\S]*?ensureTrialForClaimedProfile\s*\(/
    );
    const claimBranch = route.slice(
      route.indexOf('Claim existing directory listing'),
      route.indexOf('if (!trading_name')
    );
    const linkedAt = claimBranch.indexOf('existing.user_id');
    const membershipInsertAt = claimBranch.indexOf('profile_id: claimId');
    assert.ok(linkedAt > 0);
    assert.ok(membershipInsertAt > linkedAt);
    assert.ok(claimBranch.includes('This company is linked to another account.'));
    const detailsBlock = between(route, 'const detailsPatch', 'let profile');
    assert.match(
      detailsBlock,
      /for\s*\(\s*const key of PROFILE_SUBSCRIPTION_COLUMNS\s*\)\s*delete detailsPatch\[key\]/
    );
    assert.equal(/detailsPatch\.subscription_/.test(detailsBlock), false);
    const coreBlock = between(route, 'const coreInsert', 'insertProfileTolerant');
    assert.match(
      coreBlock,
      /for\s*\(\s*const key of PROFILE_SUBSCRIPTION_COLUMNS\s*\)\s*delete coreInsert\[key\]/
    );
    assert.equal(/coreInsert\.subscription_/.test(coreBlock), false);
    assert.equal(/insertProfileTolerant\(\s*supabase\s*,\s*baseInsert\b/.test(route), false);
    for (const column of PROFILE_SUBSCRIPTION_COLUMNS) {
      assert.equal(column.startsWith('subscription_'), true, column);
    }
    const helper = readFileSync('lib/onboarding/profile-writes.ts', 'utf8');
    const fn = helper.slice(helper.indexOf('export async function writeRegistrationAfterCreate'));
    assert.ok(fn.indexOf('writeSubscriptionChecked') < fn.indexOf('updateProfileTolerant'));
    const listing = readFileSync('app/api/onboarding/claim-listing/route.ts', 'utf8');
    assert.equal(listing.includes('Minimal patch'), false);
    assert.equal(/\/column\|schema\//.test(listing), false);
    assert.ok(listing.includes('trialPersisted'));
    assert.equal(
      invocationCount(listing, 'ensureTrialForClaimedProfile'),
      1,
      'claim-listing ensureTrialForClaimedProfile'
    );
    assert.match(listing, /if\s*\(\s*!upErr\s*\)\s*\{[\s\S]*?ensureTrialForClaimedProfile\s*\(/);
    const invites = readFileSync('app/api/invites/claim/route.ts', 'utf8');
    assert.equal(
      invocationCount(invites, 'ensureTrialForClaimedProfile'),
      2,
      'invites ensureTrialForClaimedProfile'
    );
  } finally {
    quiet.restore();
  }
  console.log('onboarding/brief118-write-order.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
