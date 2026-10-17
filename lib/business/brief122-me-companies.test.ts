/**
 * Brief 122 A3 — /api/me/companies collapses independent reads.
 * Run: npx --yes tsx lib/business/brief122-me-companies.test.ts
 */
import assert from 'node:assert/strict';
import { loadMyCompanies, type MeCompaniesDb } from './me-companies';

type Row = Record<string, any>;

type Call = {
  table: string;
  op: 'select' | 'update';
  select: string;
  epoch: number;
  limit: number | null;
  filters: Array<[string, string, unknown]>;
  patch?: Row;
};

function createDb(seed: { business_users?: Row[]; profiles?: Row[] }) {
  const store: Record<string, Row[]> = {
    business_users: [...(seed.business_users || [])],
    profiles: [...(seed.profiles || [])],
  };
  const calls: Call[] = [];
  let epoch = 0;
  let inflight = 0;

  function finish() {
    inflight -= 1;
    if (inflight === 0) epoch += 1;
  }

  function from(table: string) {
    const state: {
      op: 'select' | 'update';
      select: string;
      filters: Array<[string, string, unknown]>;
      limit: number | null;
      single: boolean;
      patch: Row;
    } = {
      op: 'select',
      select: '',
      filters: [],
      limit: null,
      single: false,
      patch: {},
    };
    const builder: Record<string, unknown> = {};
    const pushFilter = (kind: string, col: string, val: unknown) => {
      state.filters.push([kind, col, val]);
    };
    builder.select = (cols: string) => {
      state.select = cols;
      return builder;
    };
    builder.update = (patch: Row) => {
      state.op = 'update';
      state.patch = patch;
      return builder;
    };
    builder.eq = (col: string, val: unknown) => {
      pushFilter('eq', col, val);
      return builder;
    };
    builder.in = (col: string, val: unknown) => {
      pushFilter('in', col, val);
      return builder;
    };
    builder.is = (col: string, val: unknown) => {
      pushFilter('is', col, val);
      return builder;
    };
    builder.not = (col: string, op: string, val: unknown) => {
      pushFilter('not', col, { op, val });
      return builder;
    };
    builder.limit = (n: number) => {
      state.limit = n;
      return builder;
    };
    builder.order = () => builder;
    builder.maybeSingle = () => {
      state.single = true;
      return builder;
    };
    builder.then = (resolve: (value: { data: unknown; error: null }) => void) => {
      const at = epoch;
      inflight += 1;
      calls.push({
        table,
        op: state.op,
        select: state.select,
        epoch: at,
        limit: state.limit,
        filters: state.filters.map((item) => [...item] as [string, string, unknown]),
        patch: state.op === 'update' ? { ...state.patch } : undefined,
      });
      queueMicrotask(() => {
        let rows = [...(store[table] || [])];
        for (const [kind, col, val] of state.filters) {
          if (kind === 'eq') rows = rows.filter((row) => row[col] === val);
          else if (kind === 'in') {
            const list = val as unknown[];
            rows = rows.filter((row) => list.includes(row[col]));
          } else if (kind === 'is') {
            rows = rows.filter((row) => (val == null ? row[col] == null : row[col] === val));
          } else if (kind === 'not') {
            const spec = val as { op: string; val: unknown };
            if (spec.op === 'is' && spec.val == null) {
              rows = rows.filter((row) => row[col] != null);
            }
          }
        }
        if (state.op === 'update') {
          const ids = new Set(rows.map((row) => row.id));
          store[table] = (store[table] || []).map((row) =>
            ids.has(row.id) ? { ...row, ...state.patch } : row
          );
          finish();
          resolve({ data: null, error: null });
          return;
        }
        if (state.select.includes('profiles!inner')) {
          rows = rows.flatMap((row) => {
            const profile = (store.profiles || []).find((item) => item.id === row.profile_id);
            if (!profile) return [];
            return [{ ...row, profiles: { ...profile } }];
          });
        }
        if (state.limit != null) rows = rows.slice(0, state.limit);
        finish();
        resolve({
          data: state.single ? rows[0] || null : rows,
          error: null,
        });
      });
    };
    return builder;
  }

  return { from, calls, store, updates: () => calls.filter((call) => call.op === 'update') };
}

const USER = 'did:privy:returning-user';

function profile(id: number, extra: Row = {}): Row {
  return {
    id,
    trading_name: 'Northwind Trading',
    legal_name: 'Northwind Trading',
    supplier_status: 'active',
    verification_status: 'verified',
    deleted_at: null,
    business_type: 'business',
    org_type: 'business',
    metadata: {},
    user_id: USER,
    email: 'owner@example.test',
    ...extra,
  };
}

function member(extra: Row = {}): Row {
  return {
    id: 7,
    role: 'owner',
    profile_id: 42,
    status: 'active',
    user_id: USER,
    email: 'owner@example.test',
    invited_email: null,
    name: 'Ada',
    permissions: null,
    ...extra,
  };
}

async function run(
  db: ReturnType<typeof createDb>,
  extra: Partial<Parameters<typeof loadMyCompanies>[0]> = {}
) {
  let ensured = 0;
  const result = await loadMyCompanies({
    supabase: db as MeCompaniesDb,
    userId: USER,
    jwtEmails: ['owner@example.test'],
    isPlatformEmail: () => false,
    ensurePlatformCompany: async () => {
      ensured += 1;
      return { company: { id: 9 }, created: true, ownersAttached: [] };
    },
    ...extra,
  });
  return { result, ensured };
}

function epochs(calls: Call[], pred: (call: Call) => boolean): number[] {
  return [...new Set(calls.filter(pred).map((call) => call.epoch))];
}

async function main() {
  // Returning member: one round, no writes, no per-company profile follow-up.
  {
    const db = createDb({
      business_users: [member()],
      profiles: [profile(42)],
    });
    const { result, ensured } = await run(db);
    assert.equal(result.status, 200);
    const companies = result.body.companies as Array<Record<string, unknown>>;
    assert.equal(companies.length, 1);
    assert.equal(companies[0].id, '42');
    assert.equal(companies[0].role, 'owner');
    assert.equal(companies[0].trading_name, 'Northwind Trading');
    assert.equal(result.body.count, 1);
    assert.equal(result.body.userId, USER);
    assert.equal(result.body.email, 'owner@example.test');
    assert.equal(result.body.platformBootstrap, null);
    assert.deepEqual(result.body.deletedCompanies, []);
    assert.equal(ensured, 0);
    assert.equal(db.updates().length, 0);

    const userRead = db.calls.find(
      (call) =>
        call.op === 'select' &&
        call.table === 'business_users' &&
        call.select.includes('profiles!inner') &&
        call.filters.some((filter) => filter[0] === 'in' && filter[1] === 'user_id')
    );
    assert.ok(userRead, 'membership read must embed the company');
    assert.equal(userRead!.limit, null, 'user membership read must not be truncated');
    const emailRead = db.calls.find(
      (call) =>
        call.table === 'business_users' &&
        call.filters.some((filter) => filter[1] === 'email' && filter[0] === 'in')
    );
    assert.ok(emailRead);
    assert.equal(userRead!.epoch, emailRead!.epoch, 'membership and email reads must share a round');
    assert.equal(
      db.calls.every((call) => call.epoch === 0),
      true,
      'returning user must finish in one round'
    );
    assert.equal(
      db.calls.some(
        (call) => call.table === 'profiles' && call.filters.some((filter) => filter[1] === 'id')
      ),
      false,
      'returning user must not follow up per company'
    );
  }

  // First login: invite row has no user_id. One parallel bind, company still returned.
  {
    const db = createDb({
      business_users: [member({ id: 8, user_id: null, email: 'owner@example.test' })],
      profiles: [profile(42)],
    });
    const { result } = await run(db);
    assert.equal(result.status, 200);
    const companies = result.body.companies as Array<{ id: string; role: string }>;
    assert.equal(companies.length, 1);
    assert.equal(companies[0].id, '42');
    const updates = db.updates();
    assert.equal(updates.length, 1);
    assert.equal(updates[0].patch?.user_id, USER);
    assert.equal(updates[0].patch?.status, 'active');
    assert.equal(
      db.store.business_users[0].user_id,
      USER,
      'empty user_id invite must be bound'
    );
    const readEpochs = epochs(db.calls, (call) => call.op === 'select');
    const writeEpochs = epochs(db.calls, (call) => call.op === 'update');
    assert.ok(Math.max(...readEpochs) < Math.min(...writeEpochs));
    assert.ok(writeEpochs.length === 1, 'invite binds must run together');
    assert.ok(Math.max(...db.calls.map((call) => call.epoch)) <= 2);
  }

  // An email that is only on an existing membership is looked up in the next round, not dropped.
  {
    const db = createDb({
      business_users: [
        member({ invited_email: 'desk@example.test' }),
        member({
          id: 12,
          user_id: null,
          email: 'desk@example.test',
          profile_id: 44,
          role: 'admin',
        }),
      ],
      profiles: [profile(42), profile(44, { trading_name: 'Desk Co', email: 'desk@example.test' })],
    });
    const { result } = await run(db);
    const companies = result.body.companies as Array<{ id: string; role: string }>;
    assert.equal(companies.some((company) => company.id === '44' && company.role === 'admin'), true);
    assert.equal(db.updates().length, 1);
    assert.equal(db.store.business_users.find((row) => row.id === 12)?.user_id, USER);
    const extraRead = db.calls.find(
      (call) =>
        call.table === 'business_users' &&
        call.filters.some(
          (filter) =>
            filter[0] === 'in' &&
            filter[1] === 'email' &&
            Array.isArray(filter[2]) &&
            (filter[2] as string[]).includes('desk@example.test')
        )
    );
    assert.ok(extraRead, 'stored email must still be queried');
    assert.equal(extraRead!.epoch, 1);
    assert.ok(Math.max(...db.calls.map((call) => call.epoch)) <= 2);
  }

  // Email match owned by someone else is listed and not rewritten.
  {
    const db = createDb({
      business_users: [member({ id: 8, user_id: 'did:privy:someone-else' })],
      profiles: [profile(42, { user_id: 'did:privy:someone-else' })],
    });
    const { result } = await run(db, { jwtEmails: ['owner@example.test'] });
    assert.equal(result.status, 200);
    const companies = result.body.companies as Array<{ id: string }>;
    assert.equal(companies.length, 1);
    assert.equal(db.updates().length, 0);
    assert.equal(db.store.business_users[0].user_id, 'did:privy:someone-else');
  }

  // Platform owner who already has the company: no ensure write.
  {
    const db = createDb({
      business_users: [
        member({
          id: 11,
          profile_id: 9,
          email: 'ops@example.test',
          role: 'owner',
        }),
      ],
      profiles: [
        profile(9, {
          trading_name: 'SupplierAdvisor',
          legal_name: 'SupplierAdvisor (Pty) Ltd',
          business_type: 'platform',
          org_type: 'platform',
          email: 'ops@example.test',
          metadata: { is_platform_company: true },
        }),
      ],
    });
    let ensured = 0;
    const result = await loadMyCompanies({
      supabase: db,
      userId: USER,
      jwtEmails: ['ops@example.test'],
      isPlatformEmail: (email) => email === 'ops@example.test',
      ensurePlatformCompany: async () => {
        ensured += 1;
        return { company: { id: 9 }, created: false, ownersAttached: ['ops@example.test'] };
      },
    });
    assert.equal(ensured, 0);
    assert.equal(db.updates().length, 0);
    const bootstrap = result.body.platformBootstrap as {
      companyId: number;
      created: boolean;
      attached: string[];
    };
    assert.equal(bootstrap.companyId, 9);
    assert.equal(bootstrap.created, false);
    assert.deepEqual(bootstrap.attached, []);
    const companies = result.body.companies as Array<{ id: string; entity_kind: string }>;
    assert.equal(companies.some((company) => company.id === '9'), true);
    assert.equal(companies.find((company) => company.id === '9')?.entity_kind, 'platform');
  }

  // Platform company missing: ensure runs once, then the new membership is visible.
  {
    const db = createDb({
      business_users: [],
      profiles: [
        profile(9, {
          trading_name: 'SupplierAdvisor',
          legal_name: 'SupplierAdvisor (Pty) Ltd',
          business_type: 'platform',
          org_type: 'platform',
          metadata: { is_platform_company: true },
          email: 'ops@example.test',
        }),
      ],
    });
    let ensured = 0;
    const result = await loadMyCompanies({
      supabase: db,
      userId: USER,
      jwtEmails: ['ops@example.test'],
      isPlatformEmail: (email) => email === 'ops@example.test',
      ensurePlatformCompany: async () => {
        ensured += 1;
        db.store.business_users.push(
          member({
            id: 15,
            profile_id: 9,
            user_id: USER,
            email: 'ops@example.test',
            role: 'owner',
          })
        );
        return { company: { id: 9 }, created: true, ownersAttached: ['ops@example.test'] };
      },
    });
    assert.equal(ensured, 1);
    const companies = result.body.companies as Array<{ id: string; role: string }>;
    assert.equal(companies.some((company) => company.id === '9' && company.role === 'owner'), true);
    const bootstrap = result.body.platformBootstrap as { created: boolean; attached: string[] };
    assert.equal(bootstrap.created, true);
    assert.deepEqual(bootstrap.attached, ['ops@example.test']);
  }

  // Deleted companies stay on the same round as the membership read.
  {
    const db = createDb({
      business_users: [member()],
      profiles: [
        profile(42),
        profile(43, {
          trading_name: 'Old Co',
          deleted_at: '2026-02-01T00:00:00.000Z',
          deleted_by: USER,
          deletion_reason: JSON.stringify({
            original_trading_name: 'Old Co',
            restore_until: '2026-03-01T00:00:00.000Z',
          }),
        }),
      ],
    });
    const { result } = await run(db, { includeDeleted: true });
    const deleted = result.body.deletedCompanies as Array<{ id: string; trading_name: string }>;
    assert.equal(deleted.length, 1);
    assert.equal(deleted[0].id, '43');
    assert.equal(deleted[0].trading_name, 'Old Co');
    const membership = db.calls.find(
      (call) => call.table === 'business_users' && call.filters.some((filter) => filter[1] === 'user_id')
    );
    const deletedRead = db.calls.find(
      (call) => call.table === 'profiles' && call.select.includes('deletion_reason')
    );
    assert.ok(membership && deletedRead);
    assert.equal(membership!.epoch, deletedRead!.epoch);
  }

  // A role that cannot appear in the switcher is omitted. No truncation of the read.
  {
    const db = createDb({
      business_users: [member({ role: 'member' })],
      profiles: [profile(42)],
    });
    const { result } = await run(db);
    assert.deepEqual(result.body.companies, []);
    assert.equal(result.body.count, 0);
    assert.equal(result.body.success, true);
  }

  // No memberships: same empty envelope as before, and no platform write.
  {
    const db = createDb({ business_users: [], profiles: [] });
    const { result, ensured } = await run(db, { jwtEmails: [] });
    assert.equal(ensured, 0);
    assert.deepEqual(result.body, {
      success: true,
      companies: [],
      userId: USER,
      email: null,
      debug: {
        matchedByUser: 0,
        variants: result.body.debug && (result.body.debug as { variants: string[] }).variants,
      },
    });
    assert.ok(Array.isArray((result.body.debug as { variants: string[] }).variants));
    assert.equal('deletedCompanies' in result.body, false);
    assert.equal(db.updates().length, 0);
  }

  console.log('brief122-me-companies.test.ts ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
