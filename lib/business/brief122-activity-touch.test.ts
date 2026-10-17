/**
 * Brief 122 A4 — last-active writes are throttled and not dropped.
 * Run: npx --yes tsx lib/business/brief122-activity-touch.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  clearActivityTouchMemoForTests,
  getCompanyMembership,
  setActivityScheduler,
  setActivityTouchRuntimeForTests,
  setMembershipClientForTests,
} from './access';
import { scheduleWithAfter } from './schedule-after';
import {
  MEMBER_ACTIVITY_TOUCH_MS,
  activityTouchDecision,
} from './activity-touch';

type Row = Record<string, unknown>;

type Call = {
  table: string;
  op: string;
  select: string;
  filters: Array<['eq' | 'in', string, unknown]>;
};

function createFake(opts: { members: Row[]; profiles: Row[]; dropActivityColumn?: boolean }) {
  const calls: Call[] = [];

  function from(table: string) {
    const state = {
      op: 'select',
      select: '',
      filters: [] as Array<['eq' | 'in', string, unknown]>,
      limit: null as number | null,
      single: false,
    };
    const builder: Record<string, unknown> = {};
    builder.select = (cols: string) => {
      state.select = cols;
      return builder;
    };
    builder.update = () => {
      state.op = 'update';
      return builder;
    };
    builder.eq = (col: string, val: unknown) => {
      state.filters.push(['eq', col, val]);
      return builder;
    };
    builder.in = (col: string, val: unknown) => {
      state.filters.push(['in', col, val]);
      return builder;
    };
    builder.limit = (n: number) => {
      state.limit = n;
      return builder;
    };
    builder.maybeSingle = () => {
      state.single = true;
      return builder;
    };
    builder.then = (resolve: (value: { data: unknown; error: { message: string } | null }) => void) => {
      calls.push({ table, op: state.op, select: state.select, filters: [...state.filters] });
      queueMicrotask(() => {
        if (
          opts.dropActivityColumn &&
          state.op === 'select' &&
          state.select.includes('last_active_at')
        ) {
          resolve({
            data: null,
            error: { message: "Could not find the 'last_active_at' column of 'business_users'" },
          });
          return;
        }
        if (state.op === 'update') {
          resolve({ data: null, error: null });
          return;
        }
        const source = table === 'profiles' ? opts.profiles : opts.members;
        let rows = source.filter((row) =>
          state.filters.every(([kind, col, val]) => {
            if (kind === 'eq') return row[col] === val;
            return (val as unknown[]).includes(row[col]);
          })
        );
        if (state.op === 'select' && state.select.includes('profiles!')) {
          rows = rows.flatMap((row) => {
            const prof = opts.profiles.find((item) => item.id === row.profile_id);
            if (!prof) return [];
            return [{ ...row, profiles: { deleted_at: prof.deleted_at ?? null } }];
          });
        }
        if (state.op === 'select' && !state.select.includes('last_active_at')) {
          rows = rows.map((row) => {
            const copy = { ...row };
            delete copy.last_active_at;
            return copy;
          });
        }
        if (state.limit != null) rows = rows.slice(0, state.limit);
        resolve({ data: state.single ? rows[0] || null : rows, error: null });
      });
    };
    return builder;
  }

  return {
    from,
    calls,
    reads: () => calls.filter((call) => call.op === 'select'),
  };
}

const USER = 'did:privy:member-a';
const COMPANY = 42;
const T0 = 1_700_000_000_000;

function member(lastActiveAt: string | null): Row {
  return {
    id: 7,
    user_id: USER,
    profile_id: COMPANY,
    status: 'active',
    role: 'owner',
    email: 'owner@example.test',
    name: 'Ada',
    permissions: null,
    last_active_at: lastActiveAt,
  };
}

function harness(lastActiveAt: string | null, extra?: { dropActivityColumn?: boolean }) {
  let now = T0;
  const scheduled: Array<() => Promise<void>> = [];
  const updates: Array<{ memberId: number; stamp: string }> = [];
  let updateStarted = false;
  let releaseUpdate: () => void = () => undefined;
  const updateGate = new Promise<void>((resolve) => {
    releaseUpdate = resolve;
  });
  const db = createFake({
    members: [member(lastActiveAt)],
    profiles: [{ id: COMPANY, deleted_at: null }],
    dropActivityColumn: extra?.dropActivityColumn,
  });
  setMembershipClientForTests(db);
  setActivityTouchRuntimeForTests({
    now: () => now,
    schedule: (task) => {
      scheduled.push(task);
    },
    update: async (memberId, stamp) => {
      updateStarted = true;
      updates.push({ memberId, stamp });
      await updateGate;
    },
  });
  return {
    db,
    scheduled,
    updates,
    releaseUpdate,
    advance(ms: number) {
      now += ms;
    },
    get updateStarted() {
      return updateStarted;
    },
  };
}

const FIVE_MINUTES = 5 * 60 * 1000;

function reset() {
  setActivityTouchRuntimeForTests(null);
  setActivityScheduler(null);
  setMembershipClientForTests(null);
}

async function main() {
  assert.equal(
    activityTouchDecision({
      memberId: 7,
      lastActiveAt: new Date(T0 - 60_000).toISOString(),
      now: T0,
      lastScheduledAt: 0,
    }).write,
    false
  );
  assert.equal(
    activityTouchDecision({
      memberId: 7,
      lastActiveAt: new Date(T0 - 20 * 60 * 1000).toISOString(),
      now: T0,
      lastScheduledAt: 0,
    }).reason,
    'due'
  );
  assert.equal(
    activityTouchDecision({
      memberId: 7,
      lastActiveAt: null,
      now: T0,
      lastScheduledAt: T0 - 60_000,
    }).reason,
    'memo'
  );

  // Stored stamp is already inside the five-minute floor: no write, one read pair.
  {
    const h = harness(new Date(T0 - 60_000).toISOString());
    const res = await getCompanyMembership(USER, COMPANY);
    assert.equal(res.ok, true);
    assert.equal(h.scheduled.length, 0);
    assert.equal(h.updateStarted, false);
    assert.equal(h.db.reads().some((call) => call.select.includes('last_active_at')), true);
    reset();
  }

  // Stale stamp schedules one write and does not block the membership result.
  {
    const h = harness(new Date(T0 - 20 * 60 * 1000).toISOString());
    const pending = getCompanyMembership(USER, COMPANY);
    const res = await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('activity write blocked the response')), 50);
      }),
    ]);
    assert.equal(res.ok, true);
    assert.equal(h.updateStarted, false, 'update must not start before the scheduler runs');
    assert.equal(h.scheduled.length, 1);
    const readsAfterFirst = h.db.reads().length;
    clearActivityTouchMemoForTests();
    const again = await getCompanyMembership(USER, COMPANY);
    assert.equal(again.ok, true);
    assert.equal(h.scheduled.length, 1, 'membership memo hit must not schedule another write');
    assert.equal(h.db.reads().length, readsAfterFirst, 'membership memo hit must not read again');

    const running = h.scheduled[0]();
    await Promise.resolve();
    assert.equal(h.updateStarted, true);
    h.releaseUpdate();
    await running;
    assert.equal(h.updates.length, 1);
    assert.equal(h.updates[0].memberId, 7);
    assert.equal(h.updates[0].stamp, new Date(T0).toISOString());
    reset();
  }

  // Fake clock: a second miss inside the floor does not write; after the floor it does.
  {
    const h = harness(null);
    const first = await getCompanyMembership(USER, COMPANY);
    assert.equal(first.ok, true);
    assert.equal(h.scheduled.length, 1);
    h.advance(FIVE_MINUTES - 1);
    // Re-installing the fake drops the membership memo so this is a real miss.
    setMembershipClientForTests(h.db);
    const mid = await getCompanyMembership(USER, COMPANY);
    assert.equal(mid.ok, true);
    assert.equal(h.scheduled.length, 1);
    h.advance(1);
    setMembershipClientForTests(h.db);
    const later = await getCompanyMembership(USER, COMPANY);
    assert.equal(later.ok, true);
    assert.equal(h.scheduled.length, 2);
    reset();
  }

  // Missing column falls back and still returns the member.
  {
    const h = harness(null, { dropActivityColumn: true });
    const res = await getCompanyMembership(USER, COMPANY);
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.memberId, 7);
    assert.equal(
      h.db.reads().filter((call) => call.table === 'business_users').length,
      2
    );
    reset();
  }

  // Deleted company does not stamp activity.
  {
    const db = createFake({
      members: [member(null)],
      profiles: [{ id: COMPANY, deleted_at: '2026-04-01T00:00:00.000Z' }],
    });
    const scheduled: unknown[] = [];
    setMembershipClientForTests(db);
    setActivityTouchRuntimeForTests({
      now: () => T0,
      schedule: (task) => {
        scheduled.push(task);
      },
      update: async () => undefined,
    });
    const res = await getCompanyMembership(USER, COMPANY);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 410);
    assert.equal(scheduled.length, 0);
    reset();
  }

  assert.equal(MEMBER_ACTIVITY_TOUCH_MS, FIVE_MINUTES);

  // The server scheduler holds the write until after() runs it.
  {
    let ran = false;
    const queued: Array<() => void> = [];
    scheduleWithAfter(
      async () => {
        ran = true;
      },
      (cb) => {
        queued.push(cb);
      }
    );
    assert.equal(ran, false);
    assert.equal(queued.length, 1);
    queued[0]();
    await Promise.resolve();
    assert.equal(ran, true);

    let fallbackRan = false;
    scheduleWithAfter(
      async () => {
        fallbackRan = true;
      },
      () => {
        throw new Error('no request scope');
      }
    );
    await Promise.resolve();
    assert.equal(fallbackRan, true);
  }

  // Default update stamps only the member id. A missing id filter would stamp every row.
  {
    const queued: Array<() => Promise<void>> = [];
    const rows = [
      member(null),
      {
        ...member(null),
        id: 8,
        user_id: 'did:privy:member-b',
      },
    ];
    const db = createFake({
      members: rows,
      profiles: [{ id: COMPANY, deleted_at: null }],
    });
    setMembershipClientForTests(db);
    setActivityScheduler((task) => {
      queued.push(task);
    });
    const res = await getCompanyMembership(USER, COMPANY);
    assert.equal(res.ok, true);
    await Promise.resolve();
    assert.equal(queued.length, 1);
    assert.equal(
      db.calls.some((call) => call.op === 'update'),
      false,
      'the stamp must wait for the scheduler'
    );
    await queued[0]();
    await Promise.resolve();
    const updates = db.calls.filter((call) => call.op === 'update');
    assert.equal(updates.length, 1);
    assert.equal(
      updates[0].filters.some(
        (filter) => filter[0] === 'eq' && filter[1] === 'id' && filter[2] === 7
      ),
      true
    );
    reset();
  }

  const accessSrc = readFileSync('lib/business/access.ts', 'utf8');
  assert.equal(/from\s+['"]next\/server['"]/.test(accessSrc), false);
  assert.equal(/import\(\s*['"]next\/server['"]\s*\)/.test(accessSrc), false);
  const instrumentation = readFileSync('instrumentation.ts', 'utf8');
  assert.equal(instrumentation.includes('installActivityAfter('), true);

  const seen = new Set<string>();
  function walk(file: string) {
    const full = file.startsWith('/') ? file : join(process.cwd(), file);
    if (seen.has(full) || !statSafe(full)) return;
    seen.add(full);
    const text = readFileSync(full, 'utf8');
    assert.equal(
      /import\s*\{[^}]*\bafter\b[^}]*\}\s*from\s*['"]next\/server['"]/.test(text),
      false,
      full
    );
    assert.equal(text.includes('schedule-after'), false, full);
    const specs = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
    for (const spec of specs) {
      const next = resolveSpec(full, spec);
      if (next) walk(next);
    }
  }
  walk('components/Sidebar.tsx');
  assert.equal([...seen].some((file) => file.endsWith('lib/business/access.ts')), true);

  reset();
  console.log('brief122-activity-touch.test.ts ok');
}

function statSafe(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function resolveSpec(fromFile: string, spec: string): string | null {
  if (spec === 'next/server' || spec.startsWith('next/') || !spec.startsWith('.') && !spec.startsWith('@/')) {
    return null;
  }
  const base = spec.startsWith('@/')
    ? join(process.cwd(), spec.slice(2))
    : join(dirname(fromFile), spec);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  for (const candidate of candidates) {
    if (statSafe(candidate)) return candidate;
  }
  return null;
}

main().catch((err) => {
  reset();
  console.error(err);
  process.exit(1);
});
