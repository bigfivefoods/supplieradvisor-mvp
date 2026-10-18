/**
 * Brief 122 A2 — requireCompanyAccess membership is one PostgREST read.
 * Run: npx --yes tsx lib/business/brief122-membership-one-call.test.ts
 */
import assert from 'node:assert/strict';
import {
  MEMBERSHIP_EMBED_SELECT,
  getCompanyMembership,
  setMembershipClientForTests,
} from './access';

type Row = Record<string, unknown>;

type Filter = ['eq' | 'in', string, unknown];

type Call = {
  table: string;
  op: 'select' | 'update';
  select: string;
  epoch: number;
  filters: Filter[];
};

const EMBED_HINT = 'profiles!business_users_profile_id_fkey!inner(';

function isEmbedSelect(select: string): boolean {
  return select.includes('profiles!') && select.includes('!inner(');
}

function createFake(opts: {
  members: Row[];
  profiles: Row[];
  embedError?: { message: string; code: string } | null;
  membersError?: { message: string; code: string } | null;
  profileError?: { message: string; code: string } | null;
  omitEmbeddedProfile?: boolean;
}) {
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
      filters: Array<['eq' | 'in', string, unknown]>;
      limit: number | null;
      single: boolean;
    } = {
      op: 'select',
      select: '',
      filters: [],
      limit: null,
      single: false,
    };
    const builder: Record<string, unknown> = {};
    const self = () => builder;
    builder.select = (cols: string) => {
      state.op = 'select';
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
    builder.is = () => builder;
    builder.limit = (n: number) => {
      state.limit = n;
      return builder;
    };
    builder.maybeSingle = () => {
      state.single = true;
      return builder;
    };
    builder.then = (
      resolve: (value: { data: unknown; error: { message: string; code: string } | null }) => void
    ) => {
      const at = epoch;
      inflight += 1;
      calls.push({
        table,
        op: state.op,
        select: state.select,
        epoch: at,
        filters: state.filters.map((filter) => [filter[0], filter[1], filter[2]]),
      });
      queueMicrotask(() => {
        const embed = state.op === 'select' && table === 'business_users' && isEmbedSelect(state.select);
        if (embed && !state.select.includes('business_users_profile_id_fkey')) {
          finish();
          resolve({
            data: null,
            error: {
              message: 'Could not embed because more than one relationship was found',
              code: 'PGRST201',
            },
          });
          return;
        }
        if (embed && opts.embedError) {
          finish();
          resolve({ data: null, error: opts.embedError });
          return;
        }
        if (
          state.op === 'select' &&
          table === 'business_users' &&
          !embed &&
          opts.membersError
        ) {
          finish();
          resolve({ data: null, error: opts.membersError });
          return;
        }
        if (state.op === 'select' && table === 'profiles' && opts.profileError) {
          finish();
          resolve({ data: null, error: opts.profileError });
          return;
        }
        if (state.op === 'update') {
          finish();
          resolve({ data: null, error: null });
          return;
        }
        const source = table === 'profiles' ? opts.profiles : opts.members;
        let rows = source.filter((row) =>
          state.filters.every(([kind, col, val]) => {
            if (kind === 'eq') return row[col] === val;
            const list = val as unknown[];
            return list.includes(row[col]);
          })
        );
        if (embed) {
          rows = rows.flatMap((row) => {
            if (opts.omitEmbeddedProfile) return [{ ...row }];
            const prof = opts.profiles.find((p) => p.id === row.profile_id);
            if (!prof) return [];
            return [{ ...row, profiles: { deleted_at: prof.deleted_at ?? null } }];
          });
        }
        if (state.limit != null) rows = rows.slice(0, state.limit);
        finish();
        if (state.single) {
          resolve({ data: rows[0] || null, error: null });
          return;
        }
        resolve({ data: rows, error: null });
      });
      return builder;
    };
    return self();
  }

  return {
    from,
    calls,
    reads: () => calls.filter((c) => c.op === 'select'),
  };
}

const USER = 'did:privy:member-a';
const COMPANY = 42;

function member(extra: Row = {}): Row {
  return {
    id: 7,
    user_id: USER,
    profile_id: COMPANY,
    status: 'active',
    role: 'owner',
    email: 'owner@example.test',
    name: 'Owner',
    permissions: null,
    ...extra,
  };
}

async function settle() {
  await new Promise((r) => setTimeout(r, 20));
}

async function main() {
  // Active member: one embed read, not a second profiles read.
  {
    const db = createFake({
      members: [member()],
      profiles: [{ id: COMPANY, deleted_at: null }],
    });
    setMembershipClientForTests(db);
    const first = await getCompanyMembership(USER, COMPANY);
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.role, 'owner');
      assert.equal(first.memberId, 7);
      assert.equal(first.status, 'active');
    }
    const reads = db.reads();
    assert.equal(reads.length, 1, 'cache miss must be a single read');
    assert.equal(reads[0].table, 'business_users');
    assert.equal(reads[0].select, MEMBERSHIP_EMBED_SELECT);
    assert.equal(reads[0].select.includes(EMBED_HINT), true);

    const second = await getCompanyMembership(USER, COMPANY);
    assert.equal(second.ok, true);
    assert.equal(db.reads().length, 1, 'memo hit must add zero reads');
    await settle();
  }

  // Not a member.
  {
    const db = createFake({
      members: [],
      profiles: [{ id: COMPANY, deleted_at: null }],
    });
    setMembershipClientForTests(db);
    const res = await getCompanyMembership(USER, COMPANY);
    assert.deepEqual(res, {
      ok: false,
      error: 'You are not an active member of this company',
      status: 403,
    });
    assert.equal(db.reads().length, 1);
  }

  // Inactive row is not an active membership (same 403 as a non-member).
  {
    const db = createFake({
      members: [member({ status: 'invited', role: 'admin' })],
      profiles: [{ id: COMPANY, deleted_at: null }],
    });
    setMembershipClientForTests(db);
    const res = await getCompanyMembership(USER, COMPANY);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 403);
    assert.equal(db.reads().length, 1);
  }

  // Deleted company is 410 from the embedded deleted_at, still one read.
  {
    const db = createFake({
      members: [member()],
      profiles: [{ id: COMPANY, deleted_at: '2026-01-02T00:00:00.000Z' }],
    });
    setMembershipClientForTests(db);
    const res = await getCompanyMembership(USER, COMPANY);
    assert.deepEqual(res, {
      ok: false,
      error: 'This company has been deleted',
      status: 410,
    });
    assert.equal(db.reads().length, 1);
    assert.equal(
      db.calls.some((c) => c.table === 'profiles'),
      false,
      'deleted check must not be a second query'
    );
  }

  // Non-relationship failure stays a verify error and does not fall through.
  {
    const db = createFake({
      members: [member()],
      profiles: [{ id: COMPANY, deleted_at: null }],
      embedError: { message: 'connection reset', code: '08006' },
    });
    setMembershipClientForTests(db);
    const res = await getCompanyMembership(USER, COMPANY);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 500);
    assert.equal(db.reads().length, 1);
  }

  // Embed unsupported: one failed embed, then the two reads run together.
  {
    const db = createFake({
      members: [member()],
      profiles: [{ id: COMPANY, deleted_at: '2026-03-01T00:00:00.000Z' }],
      embedError: {
        message: 'Could not find a relationship between business_users and profiles',
        code: 'PGRST200',
      },
    });
    setMembershipClientForTests(db);
    const res = await getCompanyMembership(USER, COMPANY);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 410);
    const reads = db.reads();
    assert.equal(reads.length, 3);
    const fallback = reads.filter((c) => c.epoch === 1);
    assert.equal(fallback.length, 2, 'fallback reads must share one round');
    assert.equal(
      fallback.some((c) => c.table === 'profiles' && c.select === 'deleted_at'),
      true
    );
    await settle();
  }

  // Duplicate FK on production: PGRST201 is remembered, then the plain read plus profile fetch.
  {
    const otherCompany = 43;
    const db = createFake({
      members: [member(), member({ id: 8, profile_id: otherCompany })],
      profiles: [
        { id: COMPANY, deleted_at: null },
        { id: otherCompany, deleted_at: null },
      ],
      embedError: {
        message: 'Could not embed because more than one relationship was found',
        code: 'PGRST201',
      },
    });
    setMembershipClientForTests(db);
    const first = await getCompanyMembership(USER, COMPANY);
    assert.equal(first.ok, true);
    if (first.ok) assert.equal(first.memberId, 7);
    assert.equal(db.reads().length, 3);
    const secondBefore = db.reads().length;
    const second = await getCompanyMembership(USER, otherCompany);
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.memberId, 8);
    const added = db.reads().slice(secondBefore);
    assert.equal(added.length, 2, 'a later miss must not retry the ambiguous embed');
    assert.equal(
      added.some((call) => isEmbedSelect(call.select)),
      false
    );
    assert.equal(
      added.some((call) => call.table === 'profiles'),
      true
    );
    await settle();
  }

  // Another user and another company. Dropping either filter returns the wrong row.
  {
    const otherUser = 'did:privy:member-b';
    const otherCompany = 43;
    const db = createFake({
      members: [
        member({ id: 2, user_id: otherUser, profile_id: COMPANY, role: 'admin' }),
        member({ id: 3, user_id: USER, profile_id: otherCompany, role: 'finance' }),
        member({ id: 4, user_id: otherUser, profile_id: otherCompany, role: 'owner' }),
        member({ id: 5, user_id: USER, profile_id: COMPANY, status: 'invited', role: 'member' }),
        member(),
      ],
      profiles: [
        { id: COMPANY, deleted_at: null },
        { id: otherCompany, deleted_at: '2026-05-01T00:00:00.000Z' },
      ],
    });
    setMembershipClientForTests(db);
    const mine = await getCompanyMembership(USER, COMPANY);
    assert.equal(mine.ok, true);
    if (mine.ok) {
      assert.equal(mine.memberId, 7);
      assert.equal(mine.role, 'owner');
      assert.equal(mine.status, 'active');
    }
    const stranger = await getCompanyMembership(otherUser, otherCompany);
    assert.equal(stranger.ok, false);
    if (!stranger.ok) assert.equal(stranger.status, 410);
    const cross = await getCompanyMembership(otherUser, COMPANY);
    assert.equal(cross.ok, true);
    if (cross.ok) assert.equal(cross.memberId, 2);
    await settle();
  }

  // Embed row with no profile object is a verify failure, not an allow.
  {
    const db = createFake({
      members: [member()],
      profiles: [{ id: COMPANY, deleted_at: null }],
      omitEmbeddedProfile: true,
    });
    setMembershipClientForTests(db);
    const res = await getCompanyMembership(USER, COMPANY);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 500);
  }

  // Fallback membership read failure stays closed.
  {
    const db = createFake({
      members: [member()],
      profiles: [{ id: COMPANY, deleted_at: null }],
      embedError: {
        message: 'Could not embed because more than one relationship was found',
        code: 'PGRST201',
      },
      membersError: { message: 'connection reset', code: '08006' },
    });
    setMembershipClientForTests(db);
    const res = await getCompanyMembership(USER, COMPANY);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 500);
  }

  // Fallback profile read failure stays closed. A deleted company must not look active.
  {
    const db = createFake({
      members: [member()],
      profiles: [{ id: COMPANY, deleted_at: '2026-06-01T00:00:00.000Z' }],
      embedError: {
        message: 'Could not embed because more than one relationship was found',
        code: 'PGRST201',
      },
      profileError: { message: 'connection reset', code: '08006' },
    });
    setMembershipClientForTests(db);
    const res = await getCompanyMembership(USER, COMPANY);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 500);
  }

  // Fallback read must keep the caller filter and active status. Decoys are first
  // so limit(1) returns the wrong row if either filter is dropped.
  {
    const otherUser = 'did:privy:member-b';
    const db = createFake({
      members: [
        member({ id: 2, user_id: otherUser, role: 'admin' }),
        member({ id: 5, status: 'invited', role: 'member' }),
        member(),
      ],
      profiles: [{ id: COMPANY, deleted_at: null }],
      embedError: {
        message: 'Could not embed because more than one relationship was found',
        code: 'PGRST201',
      },
    });
    setMembershipClientForTests(db);
    const res = await getCompanyMembership(USER, COMPANY);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.memberId, 7);
      assert.equal(res.status, 'active');
      assert.equal(res.role, 'owner');
    }
    const memberRead = db.reads().find(
      (call) => call.table === 'business_users' && !isEmbedSelect(call.select)
    );
    assert.ok(memberRead);
    assert.equal(
      memberRead.filters.some(
        (filter) =>
          filter[0] === 'in' &&
          filter[1] === 'user_id' &&
          Array.isArray(filter[2]) &&
          filter[2].includes(USER)
      ),
      true
    );
    assert.equal(
      memberRead.filters.some(
        (filter) => filter[0] === 'eq' && filter[1] === 'status' && filter[2] === 'active'
      ),
      true
    );
    await settle();
  }

  setMembershipClientForTests(null);
  console.log('brief122-membership-one-call.test.ts ok');
}

main().catch((err) => {
  setMembershipClientForTests(null);
  console.error(err);
  process.exit(1);
});
