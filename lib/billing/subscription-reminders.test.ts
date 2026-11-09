/**
 * Subscription cron reminders: due-window queries, idempotent claims, auth.
 * In-memory only. Does not open a database connection.
 * Run: npx --yes tsx lib/billing/subscription-reminders.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';
import { assertCronSecret } from '../auth/api-auth';
import {
  choosePrimaryCompanyEmail,
  daysUntilUtc,
  reminderHorizon,
  reminderOffset,
  sendSubscriptionLifecycleEmails,
  skippedSubscriptionPlan,
  type ReminderMember,
  type ReminderProfile,
} from './subscription-reminders';

const NOW = new Date('2026-11-09T07:00:00.000Z');

function isoDaysFromNow(days: number): string {
  return new Date(Date.UTC(2026, 10, 9 + days, 15, 0, 0)).toISOString();
}

assert.equal(daysUntilUtc(isoDaysFromNow(7), NOW), 7);
assert.equal(daysUntilUtc(isoDaysFromNow(1), NOW), 1);
assert.equal(daysUntilUtc(isoDaysFromNow(3), NOW), 3);
assert.equal(daysUntilUtc(isoDaysFromNow(0), NOW), 0);
assert.equal(reminderOffset(1), 1);
assert.equal(reminderOffset(7), 7);
assert.equal(reminderOffset(3), 7);
assert.equal(reminderOffset(8), null);
assert.equal(reminderOffset(0), null);
assert.equal(skippedSubscriptionPlan('trial', 'founding-yearly'), true);
assert.equal(skippedSubscriptionPlan('trial', 'monthly'), false);

const horizon = reminderHorizon(NOW);
assert.equal(horizon.start, '2026-11-10T00:00:00.000Z');
assert.equal(horizon.end, '2026-11-17T00:00:00.000Z');
assert.equal(
  choosePrimaryCompanyEmail(null, [
    { role: 'viewer', email: 'viewer@example.com' },
    { role: 'owner', invited_email: 'owner@example.com' },
  ]),
  'owner@example.com'
);

type Filter =
  | { type: 'in'; column: string; values: readonly unknown[] }
  | { type: 'gte'; column: string; value: string }
  | { type: 'lt'; column: string; value: string }
  | { type: 'not-null'; column: string }
  | { type: 'eq'; column: string; value: unknown }
  | { type: 'is-null'; column: string }
  | { type: 'json-is-null'; column: string }
  | { type: 'json-eq'; column: string; value: unknown };

type Call = { table: string; op: 'select' | 'update'; range: [number, number] | null };

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left == null || right == null) return left == null && right == null;
  if (typeof left !== 'object' || typeof right !== 'object') return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

function readColumn(row: Record<string, unknown>, column: string): unknown {
  const arrow = column.split('->>');
  if (arrow.length !== 2) return row[column];
  const parent = row[arrow[0]];
  if (!parent || typeof parent !== 'object' || Array.isArray(parent)) return null;
  const value = (parent as Record<string, unknown>)[arrow[1]];
  return value == null ? null : value;
}

function matches(row: Record<string, unknown>, filters: Filter[]): boolean {
  return filters.every((filter) => {
    if (filter.type === 'json-is-null') return readColumn(row, filter.column) == null;
    if (filter.type === 'json-eq') return String(readColumn(row, filter.column)) === String(filter.value);
    const value = row[filter.column];
    if (filter.type === 'in') {
      return filter.values.some((item) => item === value || String(item) === String(value));
    }
    if (filter.type === 'gte') return String(value || '') >= filter.value;
    if (filter.type === 'lt') return String(value || '') < filter.value;
    if (filter.type === 'not-null') return value != null;
    if (filter.type === 'is-null') return value == null;
    return sameJson(value, filter.value);
  });
}

function createDb(opts: {
  profiles: ReminderProfile[];
  members?: ReminderMember[];
  delayMs?: number;
}) {
  const profiles = opts.profiles.map((row) => ({
    ...row,
    subscription_reminder_meta: row.subscription_reminder_meta ?? {},
  }));
  const members = opts.members || [];
  const calls: Call[] = [];
  const delayMs = opts.delayMs ?? 0;

  function run(
    table: string,
    state: {
      op: 'select' | 'update';
      filters: Filter[];
      range: [number, number] | null;
      patch: Record<string, unknown>;
      single: boolean;
    }
  ) {
    calls.push({ table, op: state.op, range: state.range });
    const finish = () => {
      if (table === 'business_users') {
        const idFilter = state.filters.find(
          (filter): filter is Extract<Filter, { type: 'in' }> =>
            filter.type === 'in' && filter.column === 'profile_id'
        );
        const ids = new Set((idFilter?.values || []).map((id) => String(id)));
        const rows = members.filter(
          (member) =>
            ids.has(String(member.profile_id)) &&
            String(member.status || 'active') === 'active'
        );
        return { data: rows, error: null };
      }
      const matched = profiles.filter((row) =>
        matches(row as unknown as Record<string, unknown>, state.filters)
      );
      if (state.op === 'update') {
        const updated = matched.map((row) => {
          Object.assign(row, state.patch);
          return { id: row.id };
        });
        return { data: state.single ? updated[0] || null : updated, error: null };
      }
      const ordered = [...matched].sort((a, b) => Number(a.id) - Number(b.id));
      const window = state.range
        ? ordered.slice(state.range[0], state.range[1] + 1)
        : ordered;
      const copies = window.map((row) => ({ ...row }));
      return { data: state.single ? copies[0] || null : copies, error: null };
    };
    return new Promise<{ data: unknown; error: null }>((resolve) => {
      setTimeout(() => resolve(finish()), delayMs);
    });
  }

  function from(table: string) {
    const state = {
      op: 'select' as 'select' | 'update',
      filters: [] as Filter[],
      range: null as [number, number] | null,
      patch: {} as Record<string, unknown>,
      single: false,
    };
    const api = {
      select() {
        return api;
      },
      update(patch: Record<string, unknown>) {
        state.op = 'update';
        state.patch = patch;
        return api;
      },
      in(column: string, values: readonly unknown[]) {
        state.filters.push({ type: 'in', column, values });
        return api;
      },
      gte(column: string, value: string) {
        state.filters.push({ type: 'gte', column, value });
        return api;
      },
      lt(column: string, value: string) {
        state.filters.push({ type: 'lt', column, value });
        return api;
      },
      not(column: string, op: string, value: null) {
        if (op === 'is' && value === null) state.filters.push({ type: 'not-null', column });
        return api;
      },
      eq(column: string, value: unknown) {
        state.filters.push({ type: 'eq', column, value });
        return api;
      },
      filter(column: string, op: string, value: unknown) {
        if (op === 'is' && value === null) state.filters.push({ type: 'json-is-null', column });
        else if (op === 'eq') state.filters.push({ type: 'json-eq', column, value });
        return api;
      },
      is(column: string, value: null) {
        if (value === null) state.filters.push({ type: 'is-null', column });
        return api;
      },
      order() {
        return api;
      },
      range(start: number, end: number) {
        state.range = [start, end];
        return api;
      },
      limit() {
        return api;
      },
      maybeSingle() {
        state.single = true;
        return run(table, state);
      },
      then(
        resolve: (value: { data: unknown; error: null }) => unknown,
        reject?: (reason: unknown) => unknown
      ) {
        return run(table, state).then(resolve, reject);
      },
    };
    return api;
  }

  return { from, calls, profiles };
}

function profile(partial: Partial<ReminderProfile> & { id: number }): ReminderProfile {
  return {
    trading_name: `Company ${partial.id}`,
    email: `company${partial.id}@example.com`,
    subscription_status: 'none',
    subscription_plan: 'monthly',
    subscription_reminder_meta: {},
    ...partial,
  };
}

function legacyLookupCount(rows: ReminderProfile[]): number {
  const scanned = rows.filter((row) => row.trading_name).slice(0, 450);
  const missingEmail = scanned.filter((row) => !String(row.email || '').includes('@')).length;
  return 1 + missingEmail * 2;
}

async function main() {
  const noise: ReminderProfile[] = [];
  for (let id = 1; id <= 440; id += 1) {
    noise.push(
      profile({
        id,
        subscription_status: 'none',
        email: null,
        subscription_trial_ends_at: isoDaysFromNow(3),
      })
    );
  }
  const due = profile({
    id: 500,
    subscription_status: 'trial',
    email: 'due@example.com',
    subscription_trial_ends_at: isoDaysFromNow(3),
  });
  const already = profile({
    id: 501,
    subscription_status: 'trial',
    subscription_trial_ends_at: isoDaysFromNow(3),
    subscription_reminder_meta: { trial_7d: '2026-11-08T07:00:00.000Z' },
  });
  const tomorrow = profile({
    id: 502,
    subscription_status: 'active',
    subscription_ends_at: isoDaysFromNow(1),
    email: 'renew@example.com',
  });
  const founding = profile({
    id: 503,
    subscription_status: 'trial',
    subscription_plan: 'founding',
    subscription_trial_ends_at: isoDaysFromNow(2),
  });
  const vuka = profile({
    id: 110,
    trading_name: 'VUKA Fitness',
    subscription_status: 'trial',
    subscription_trial_ends_at: isoDaysFromNow(4),
    email: 'vuka@example.com',
  });
  const outside = profile({
    id: 504,
    subscription_status: 'trial',
    subscription_trial_ends_at: isoDaysFromNow(8),
  });
  const noProfileEmail = profile({
    id: 505,
    subscription_status: 'trial',
    email: null,
    subscription_trial_ends_at: isoDaysFromNow(5),
  });

  const sent: string[] = [];
  const db = createDb({
    delayMs: 15,
    profiles: [due, already, tomorrow, founding, vuka, outside, noProfileEmail, ...noise],
    members: [
      { profile_id: 505, role: 'owner', email: 'owner505@example.com', status: 'active' },
      { profile_id: 505, role: 'viewer', email: 'viewer505@example.com', status: 'active' },
    ],
  });

  const started = Date.now();
  const first = await sendSubscriptionLifecycleEmails({
    now: NOW,
    limit: 150,
    resendConfigured: true,
    supabase: db,
    sendEmail: async (message) => {
      sent.push(`${message.to}|${message.subject}`);
      assert.match(message.html, /#00b4d8|#0077b6/);
    },
  });
  const elapsed = Date.now() - started;
  const profileSelects = db.calls.filter((call) => call.table === 'profiles' && call.op === 'select').length;
  const memberSelects = db.calls.filter((call) => call.table === 'business_users').length;
  const legacyQueries = legacyLookupCount(db.profiles);
  const assumedRoundTripMs = 28;
  const projectedLegacyMs = legacyQueries * assumedRoundTripMs;

  assert.equal(first.ok, true);
  assert.equal(first.trialEmails, 2);
  assert.equal(first.expiryEmails, 1);
  assert.deepEqual(sent.sort(), [
    'due@example.com|Your SupplierAdvisor trial ends in 3 days',
    'owner505@example.com|Your SupplierAdvisor trial ends in 5 days',
    'renew@example.com|Your SupplierAdvisor subscription renews/ends tomorrow',
  ]);
  assert.equal(memberSelects, 1);
  assert.ok(profileSelects < 30, `profile selects ${profileSelects}`);
  assert.ok(legacyQueries >= 1 + 440 * 2, `legacy queries ${legacyQueries}`);
  assert.ok(elapsed < projectedLegacyMs / 10, `new ${elapsed}ms vs legacy projection ${projectedLegacyMs}ms`);

  const second = await sendSubscriptionLifecycleEmails({
    now: NOW,
    limit: 150,
    resendConfigured: true,
    supabase: db,
    sendEmail: async (message) => {
      sent.push(`again|${message.to}`);
    },
  });
  assert.equal(second.trialEmails, 0);
  assert.equal(second.expiryEmails, 0);
  assert.equal(sent.some((line) => line.startsWith('again|')), false);

  const flaky = createDb({
    profiles: [
      profile({
        id: 700,
        subscription_status: 'trial',
        email: 'flaky@example.com',
        subscription_trial_ends_at: isoDaysFromNow(7),
      }),
    ],
  });
  let failuresLeft = 1;
  const flakySent: string[] = [];
  const failed = await sendSubscriptionLifecycleEmails({
    now: NOW,
    resendConfigured: true,
    supabase: flaky,
    sendEmail: async () => {
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        throw new Error('mailbox down');
      }
      flakySent.push('sent');
    },
  });
  assert.equal(failed.trialEmails, 0);
  assert.equal(
    (flaky.profiles[0].subscription_reminder_meta as Record<string, unknown>).trial_7d,
    undefined
  );
  const retried = await sendSubscriptionLifecycleEmails({
    now: NOW,
    resendConfigured: true,
    supabase: flaky,
    sendEmail: async () => {
      flakySent.push('sent');
    },
  });
  assert.equal(retried.trialEmails, 1);
  assert.equal(flakySent.length, 1);

  const raced: string[] = [];
  const raceDb = createDb({
    profiles: [
      profile({
        id: 800,
        subscription_status: 'trial',
        email: 'race@example.com',
        subscription_trial_ends_at: isoDaysFromNow(6),
      }),
    ],
  });
  const [left, right] = await Promise.all([
    sendSubscriptionLifecycleEmails({
      now: NOW,
      resendConfigured: true,
      supabase: raceDb,
      sendEmail: async () => {
        raced.push('left');
      },
    }),
    sendSubscriptionLifecycleEmails({
      now: NOW,
      resendConfigured: true,
      supabase: raceDb,
      sendEmail: async () => {
        raced.push('right');
      },
    }),
  ]);
  assert.equal(left.trialEmails + right.trialEmails, 1);
  assert.equal(raced.length, 1);

  const many = createDb({
    profiles: Array.from({ length: 201 }, (_, index) =>
      profile({
        id: 1000 + index,
        subscription_status: 'trial',
        subscription_trial_ends_at: isoDaysFromNow(2),
        email: `page${index}@example.com`,
      })
    ),
  });
  let pageSends = 0;
  await sendSubscriptionLifecycleEmails({
    now: NOW,
    limit: 1,
    resendConfigured: true,
    supabase: many,
    sendEmail: async () => {
      pageSends += 1;
    },
  });
  const pagedSelects = many.calls.filter(
    (call) => call.table === 'profiles' && call.op === 'select'
  ).length;
  assert.equal(pageSends, 1);
  assert.ok(
    many.calls.some((call) => call.table === 'profiles' && call.range?.[0] === 200),
    `expected a second page, saw ${pagedSelects} profile selects`
  );

  const route = readFileSync('app/api/business/subscription/cron/route.ts', 'utf8');
  const handler = route.slice(route.indexOf('export async function GET'));
  assert.match(route, /export const maxDuration = 60/);
  assert.match(route, /export const dynamic = 'force-dynamic'/);
  assert.ok(handler.indexOf('assertCronSecret') < handler.indexOf('sendSubscriptionLifecycleEmails'));
  assert.match(handler, /Cache-Control': 'no-store'/);
  const reminders = readFileSync('lib/billing/subscription-reminders.ts', 'utf8');
  assert.match(reminders, /#00b4d8/);
  assert.doesNotMatch(reminders, /\.not\('trading_name', 'is', null\)\s*\.limit\(/);

  const previousSecret = process.env.CRON_SECRET;
  const previousInvite = process.env.CUSTOMER_INVITE_EXPIRE_SECRET;
  const previousNode = process.env.NODE_ENV;
  const previousVercel = process.env.VERCEL_ENV;
  process.env.CRON_SECRET = 'scheduled-cron-secret';
  delete process.env.CUSTOMER_INVITE_EXPIRE_SECRET;
  process.env.NODE_ENV = 'production';
  process.env.VERCEL_ENV = 'production';
  try {
    const secret = 'scheduled-cron-secret';
    const authed = middleware(
      new NextRequest('http://localhost/api/business/subscription/cron', {
        headers: { authorization: `Bearer ${secret}` },
      })
    );
    assert.equal(authed.status, 200);
    const routeOk = assertCronSecret(
      new NextRequest('http://localhost/api/business/subscription/cron', {
        headers: { authorization: `Bearer ${secret}` },
      })
    );
    assert.equal(routeOk.ok, true);

    const anonMiddleware = middleware(
      new NextRequest('http://localhost/api/business/subscription/cron')
    );
    assert.equal(anonMiddleware.status, 200);
    const anonRoute = assertCronSecret(
      new NextRequest('http://localhost/api/business/subscription/cron')
    );
    assert.equal(anonRoute.ok, false);
    assert.equal(anonRoute.response.status, 401);

    const wrong = middleware(
      new NextRequest('http://localhost/api/business/subscription/cron', {
        headers: { authorization: 'Bearer not-the-secret' },
      })
    );
    assert.equal(wrong.status, 401);

    delete process.env.CRON_SECRET;
    const unconfigured = assertCronSecret(
      new NextRequest('http://localhost/api/business/subscription/cron', {
        headers: { authorization: 'Bearer not-the-secret' },
      })
    );
    assert.equal(unconfigured.ok, false);
    assert.equal(unconfigured.response.status, 503);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
    if (previousInvite === undefined) delete process.env.CUSTOMER_INVITE_EXPIRE_SECRET;
    else process.env.CUSTOMER_INVITE_EXPIRE_SECRET = previousInvite;
    if (previousNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNode;
    if (previousVercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercel;
  }

  console.log(
    JSON.stringify({
      newPathMs: elapsed,
      profileSelects,
      memberSelects,
      legacyQueries,
      projectedLegacyMs,
      sent: first.trialEmails + first.expiryEmails,
    })
  );
  console.log('subscription-reminders.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
