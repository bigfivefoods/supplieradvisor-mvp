/**
 * Brief 64 — customer loyalty route authz regression test
 * Run: npx --yes tsx lib/customers/brief64-loyalty-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = resolve('app/api/customers/loyalty/route.ts');
const src = readFileSync(routePath, 'utf8');

function extractFn(name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `Could not find ${name} in loyalty/route.ts`);
  let depth = 0;
  let inside = false;
  let end = start;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') { depth++; inside = true; }
    else if (src[i] === '}') { depth--; }
    if (inside && depth === 0) { end = i; break; }
  }
  return src.slice(start, end + 1);
}

const getFn = extractFn('GET');
const postFn = extractFn('POST');

// --- Static string assertions ---
assert.ok(getFn.includes('requireCompanyAccess'), 'GET must call requireCompanyAccess');
assert.ok(getFn.includes('_gate.response'), 'GET must return _gate.response on !ok');
assert.ok(postFn.includes('requireCompanyAccess'), 'POST must call requireCompanyAccess');
assert.ok(postFn.includes('_gate.response'), 'POST must return _gate.response on !ok');

assert.ok(
  getFn.indexOf('requireCompanyAccess') < getFn.indexOf('getSupabaseServer'),
  'GET must call requireCompanyAccess before getSupabaseServer'
);
assert.ok(
  postFn.indexOf('requireCompanyAccess') < postFn.indexOf('getSupabaseServer'),
  'POST must call requireCompanyAccess before getSupabaseServer'
);

// POST requires positive companyId and customer_id
assert.ok(
  postFn.includes('!Number.isFinite(companyId)'),
  'POST must validate companyId'
);
assert.ok(
  postFn.includes('!Number.isFinite(customerId)'),
  'POST must validate customer_id'
);

// --- Runtime fake-gate tests ---

type JsonBody = Record<string, unknown>;
type FakeResponse = { status: number; body: JsonBody; json: () => Promise<JsonBody> };

function jsonResponse(body: JsonBody, init?: { status?: number }): FakeResponse {
  return { status: init?.status ?? 200, body, json: async () => body };
}

type Row = Record<string, unknown>;

class QueryMock {
  private readonly store: Record<string, Row[]>;
  private readonly table: string;
  private op: 'select' | 'insert' | 'update' = 'select';
  private readonly filters: Array<(row: Row) => boolean> = [];
  private updates: Row | null = null;
  private singleMode: 'none' | 'maybe' | 'single' = 'none';

  constructor(store: Record<string, Row[]>, table: string) {
    this.store = store;
    this.table = table;
  }

  select() { return this; }
  insert(value: Row | Row[]) {
    this.op = 'insert';
    const rows = Array.isArray(value) ? value : [value];
    this.store[this.table] = [...(this.store[this.table] || []), ...rows.map((r) => ({ ...r }))];
    return this;
  }
  update(value: Row) { this.op = 'update'; this.updates = value; return this; }
  eq(field: string, val: unknown) { this.filters.push((row) => row[field] === val); return this; }
  order() { return this; }
  limit() { return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }
  single() { this.singleMode = 'single'; return this; }

  then<T1 = unknown, T2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    const rows = [...(this.store[this.table] || [])].filter((row) =>
      this.filters.every((f) => f(row))
    );
    if (this.op === 'update') {
      const updated = rows.map((row) => ({ ...row, ...(this.updates || {}) }));
      this.store[this.table] = (this.store[this.table] || []).map((row) => {
        const next = updated.find((m) => m.id === row.id);
        return next || row;
      });
      if (this.singleMode === 'single') return updated.length > 0 ? { data: updated[0], error: null } : { data: null, error: { message: 'No rows' } };
      if (this.singleMode === 'maybe') return { data: updated[0] || null, error: null };
      return { data: updated, error: null };
    }
    if (this.singleMode === 'single') return rows.length > 0 ? { data: rows[0], error: null } : { data: null, error: { message: 'No rows' } };
    if (this.singleMode === 'maybe') return { data: rows[0] || null, error: null };
    return { data: rows, error: null };
  }
}

type LoadOptions = { allowCompanyId?: number | null; denyStatus?: number; rows?: Row[] };

function makeRequest(url: string, body?: Record<string, unknown>) {
  return {
    nextUrl: new URL(url),
    headers: { get: () => null },
    json: async () => body || {},
  };
}

function sanitizeFn(fn: string): string {
  return fn
    .replace(
      /export async function (\w+)\(([^)]*)\)/,
      (_match, name: string, params: string) =>
        `async function ${name}(${params.replace(/:\s*NextRequest/g, '')})`
    )
    .replace(/catch \(e: unknown\)/g, 'catch (e)')
    .replace(/\b(const|let)\s+([A-Za-z_$][\w$]*)\s*:\s*[^=;]+=/g, '$1 $2 =')
    .replace(/\s+as const/g, '')
    .replace(/\(([^()]+?)\s+as\s+[^)]+\)/g, '($1)')
    .replace(/(\w)\?:\s*[\w\s|<>[\]]+(?=[,)])/g, '$1');
}

function loadRoute(opts: LoadOptions = {}) {
  const store: Record<string, Row[]> = {
    loyalty_accounts: [...(opts.rows || [])],
    loyalty_transactions: [],
    customers: [{ id: 55, profile_id: opts.allowCompanyId ?? 110 }],
  };
  const events: string[] = [];
  const gateCalls: number[] = [];
  let supabaseCalls = 0;

  const requireCompanyAccess = async (_req: unknown, companyId: number) => {
    gateCalls.push(companyId);
    events.push(`gate:${companyId}`);
    if (opts.allowCompanyId != null && companyId === opts.allowCompanyId) {
      return { ok: true, userId: 'u-1', verified: true, emails: [], member: true };
    }
    return {
      ok: false,
      status: opts.denyStatus ?? 401,
      error: opts.denyStatus === 403 ? 'Forbidden' : 'Unauthorized',
      response: jsonResponse(
        { error: opts.denyStatus === 403 ? 'Forbidden' : 'Unauthorized' },
        { status: opts.denyStatus ?? 401 }
      ),
    };
  };

  const getSupabaseServer = () => {
    events.push('supabase');
    return {
      from: (table: string) => {
        supabaseCalls++;
        return new QueryMock(store, table);
      },
    };
  };

  const bundle = [
    sanitizeFn(getFn),
    sanitizeFn(postFn),
    'return { GET, POST };',
  ].join('\n\n');

  const runner = new Function(
    'NextResponse',
    'getSupabaseServer',
    'requireCompanyAccess',
    'legacyPrivyFrom',
    'requireVerifiedUser',
    'tierFromLifetime',
    bundle
  );

  return {
    handlers: runner(
      { json: jsonResponse },
      getSupabaseServer,
      requireCompanyAccess,
      () => null,
      async () => ({ ok: true, userId: 'u-1', verified: true, emails: [] }),
      (n: number) => (n >= 10000 ? 'gold' : n >= 1000 ? 'silver' : 'bronze'),
    ) as {
      GET: (req: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
      POST: (req: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
    },
    events,
    gateCalls,
    store,
    get supabaseCalls() { return supabaseCalls; },
  };
}

async function main() {
  // POST — unauth denied before Supabase
  {
    const env = loadRoute({ denyStatus: 401 });
    const res = await env.handlers.POST(
      makeRequest('https://x/api/customers/loyalty', { companyId: 110, customer_id: 55, action: 'enroll' })
    );
    assert.equal(res.status, 401, 'unauth POST should be denied');
    assert.equal(env.supabaseCalls, 0, 'unauth POST must not call Supabase');
    assert.deepEqual(env.gateCalls, [110]);
    assert.ok(env.events[0]?.startsWith('gate:'), 'POST must gate before Supabase');
  }

  // POST — missing companyId → 400
  {
    const env = loadRoute({ denyStatus: 401 });
    const res = await env.handlers.POST(
      makeRequest('https://x/api/customers/loyalty', { customer_id: 55, action: 'enroll' })
    );
    assert.equal(res.status, 400, 'POST without companyId should 400');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, []);
  }

  // POST — missing customer_id → 400
  {
    const env = loadRoute({ denyStatus: 401 });
    const res = await env.handlers.POST(
      makeRequest('https://x/api/customers/loyalty', { companyId: 110, action: 'enroll' })
    );
    assert.equal(res.status, 400, 'POST without customer_id should 400');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, []);
  }

  // POST — wrong company → 403, zero Supabase calls
  {
    const env = loadRoute({ allowCompanyId: 110, denyStatus: 403 });
    const res = await env.handlers.POST(
      makeRequest('https://x/api/customers/loyalty', { companyId: 102, customer_id: 55, action: 'enroll' })
    );
    assert.equal(res.status, 403, 'member of 110 must not mutate company 102 loyalty');
    assert.equal(env.supabaseCalls, 0, 'wrong-company POST must not call Supabase');
  }

  // POST — authorized enroll
  {
    const env = loadRoute({ allowCompanyId: 110 });
    const res = await env.handlers.POST(
      makeRequest('https://x/api/customers/loyalty', { companyId: 110, customer_id: 55, action: 'enroll' })
    );
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(env.supabaseCalls > 0, 'authorized POST should query Supabase');
  }

  // GET — still gated
  {
    const env = loadRoute({ denyStatus: 401 });
    const res = await env.handlers.GET(
      makeRequest('https://x/api/customers/loyalty?companyId=110')
    );
    assert.equal(res.status, 401, 'GET must remain gated');
    assert.deepEqual(env.gateCalls, [110]);
    assert.equal(env.supabaseCalls, 0);
  }

  console.log('✓ Brief 64 loyalty authz assertions passed');
}

main().catch((err) => { console.error(err); process.exit(1); });
