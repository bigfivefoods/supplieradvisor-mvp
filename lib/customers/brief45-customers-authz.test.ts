/**
 * Brief 45 — customers route authz regression test
 * Run: npx --yes tsx lib/customers/brief45-customers-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = resolve('app/api/customers/route.ts');
const src = readFileSync(routePath, 'utf8');

function extractFn(name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `Could not find ${name} in customers/route.ts`);
  let depth = 0;
  let inside = false;
  let end = start;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') {
      depth++;
      inside = true;
    } else if (src[i] === '}') {
      depth--;
    }
    if (inside && depth === 0) {
      end = i;
      break;
    }
  }
  return src.slice(start, end + 1);
}

const getFn = extractFn('GET');
const postFn = extractFn('POST');
const patchFn = extractFn('PATCH');
const deleteFn = extractFn('DELETE');
const flatDelete = deleteFn.replace(/\s+/g, ' ');

assert.ok(getFn.includes('requireCompanyAccess'), 'GET must call requireCompanyAccess');
assert.ok(getFn.includes('_gate.response'), 'GET must return _gate.response on !ok');
assert.ok(postFn.includes('requireCompanyAccess'), 'POST must keep requireCompanyAccess');
assert.ok(postFn.includes('_gate.response'), 'POST must keep returning _gate.response on !ok');
assert.ok(patchFn.includes('requireCompanyAccess'), 'PATCH must call requireCompanyAccess');
assert.ok(patchFn.includes('_gate.response'), 'PATCH must return _gate.response on !ok');
assert.ok(deleteFn.includes('requireCompanyAccess'), 'DELETE must call requireCompanyAccess');
assert.ok(deleteFn.includes('_gate.response'), 'DELETE must return _gate.response on !ok');

assert.ok(
  getFn.indexOf('requireCompanyAccess') < getFn.indexOf('if (privyUserId)'),
  'GET must not hide requireCompanyAccess inside the privyUserId branch'
);
assert.ok(
  getFn.indexOf('requireCompanyAccess') < getFn.indexOf(".from('customers')"),
  'GET must call requireCompanyAccess before querying customers'
);

assert.match(getFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(patchFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(deleteFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.ok(deleteFn.includes("searchParams.get('companyId')"), 'DELETE must read companyId from search params');

const patchProfileScopes =
  patchFn.match(/\.eq\((['"])profile_id\1,\s*companyId\)/g)?.length || 0;
// PATCH has 7 tenant-scoped customer paths:
// set_credit_hold select/update/retry, clear_credit_hold select/update, plus the main update and schema-retry update.
assert.ok(
  patchProfileScopes >= 7,
  'PATCH must scope every customer read/write path with profile_id'
);
assert.match(
  flatDelete,
  /\.delete\(\)\.eq\('id', id\)\.eq\('profile_id', companyId\)/
);
assert.doesNotMatch(
  flatDelete,
  /\.delete\(\)\.eq\('id', id\)(?!\.eq\('profile_id', companyId\))/
);

type JsonBody = Record<string, unknown>;
type FakeResponse = {
  status: number;
  body: JsonBody;
  json: () => Promise<JsonBody>;
};

function jsonResponse(body: JsonBody, init?: { status?: number }): FakeResponse {
  return {
    status: init?.status ?? 200,
    body,
    json: async () => body,
  };
}

type Row = Record<string, unknown>;

class QueryMock {
  private readonly store: Record<string, Row[]>;
  private readonly table: string;
  private op: 'select' | 'delete' | 'update' | 'insert' = 'select';
  private readonly filters: Array<(row: Row) => boolean> = [];
  private maxRows: number | null = null;
  private ltFilter: { field: string; value: number } | null = null;
  private orderField: string | null = null;
  private orderAscending = true;

  constructor(store: Record<string, Row[]>, table: string) {
    this.store = store;
    this.table = table;
  }

  select() {
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  update() {
    this.op = 'update';
    return this;
  }

  insert() {
    this.op = 'insert';
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  lt(field: string, value: number) {
    this.ltFilter = { field, value };
    return this;
  }

  order(field: string, opts?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAscending = opts?.ascending !== false;
    return this;
  }

  limit(value: number) {
    this.maxRows = value;
    return this;
  }

  or() {
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }

  maybeSingle() {
    return this;
  }

  single() {
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private async execute() {
    let rows = [...(this.store[this.table] || [])];
    for (const filter of this.filters) rows = rows.filter(filter);
    if (this.ltFilter) {
      rows = rows.filter((row) => Number(row[this.ltFilter!.field]) < this.ltFilter!.value);
    }
    if (this.orderField) {
      rows.sort((a, b) => {
        const left = Number(a[this.orderField!]);
        const right = Number(b[this.orderField!]);
        return this.orderAscending ? left - right : right - left;
      });
    }
    if (this.maxRows != null) rows = rows.slice(0, this.maxRows);
    if (this.op === 'delete') {
      this.store[this.table] = (this.store[this.table] || []).filter(
        (row) => !rows.some((match) => match.id === row.id)
      );
      return { data: null, error: null };
    }
    return { data: rows, error: null };
  }
}

type LoadOptions = {
  allowCompanyId?: number | null;
  denyStatus?: number;
  customers?: Row[];
};

function makeRequest(url: string, body?: Record<string, unknown>) {
  return {
    nextUrl: new URL(url),
    headers: {
      get: () => null,
    },
    json: async () => body || {},
  };
}

function loadRoute(opts: LoadOptions = {}) {
  const store: Record<string, Row[]> = {
    customers: [...(opts.customers || [])],
    profiles: [],
    srm_suppliers: [],
  };
  const events: string[] = [];
  const gateCalls: number[] = [];
  let supabaseCalls = 0;
  const requireCompanyAccess = async (_request: unknown, companyId: number) => {
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
    sanitizeFn(patchFn),
    sanitizeFn(deleteFn),
    'return { GET, POST, PATCH, DELETE };',
  ].join('\n\n');
  const runner = new Function(
    'NextResponse',
    'getSupabaseServer',
    'assertCustomersAccess',
    'requireCompanyAccess',
    'legacyPrivyFrom',
    'requireVerifiedUser',
    'bookIlikeOr',
    'CUSTOMER_LIST_COLUMNS',
    'parseBeforeId',
    'parseListLimit',
    'defaultCreateBookRole',
    'filterCustomerDeskRows',
    bundle
  );

  return {
    handlers: runner(
      { json: jsonResponse },
      getSupabaseServer,
      async () => ({ ok: true }),
      requireCompanyAccess,
      () => null,
      async () => ({ ok: true, userId: 'u-1', verified: true, emails: [] }),
      () => null,
      'id, profile_id, trading_name, linked_profile_id',
      () => null,
      () => 50,
      () => 'customer',
      (rows: unknown[]) => rows
    ) as {
      GET: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
      POST: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
      PATCH: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
      DELETE: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
    },
    events,
    gateCalls,
    get supabaseCalls() {
      return supabaseCalls;
    },
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
    .replace(/\(([^()]+?)\s+as\s+[^)]+\)/g, '($1)');
}

async function readBody(response: FakeResponse) {
  return response.json();
}

async function main() {
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.GET(makeRequest('https://example.test/api/customers?companyId=102'));
    const body = await readBody(response);
    assert.equal(response.status, 401, 'unauth GET should be denied');
    assert.equal(env.supabaseCalls, 0, 'unauth GET must not query customers');
    assert.deepEqual(env.gateCalls, [102], 'GET should gate on requested companyId');
    assert.ok(!('customers' in body), 'unauth GET must not return a customer book');
    assert.ok(env.events[0]?.startsWith('gate:'), 'GET must gate before touching Supabase');
  }

  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.DELETE(makeRequest('https://example.test/api/customers?id=1'));
    const body = await readBody(response);
    assert.equal(response.status, 400, 'DELETE without companyId should 400');
    assert.equal(env.supabaseCalls, 0, 'DELETE without companyId must not query customers');
    assert.deepEqual(env.gateCalls, [], 'DELETE without companyId should fail before gate');
    assert.notEqual(body.success, true, 'DELETE without companyId must never report success');
  }

  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/customers', { id: 1, trading_name: 'x' })
    );
    const body = await readBody(response);
    assert.equal(response.status, 400, 'PATCH without companyId should 400');
    assert.equal(env.supabaseCalls, 0, 'PATCH without companyId must not query customers');
    assert.deepEqual(env.gateCalls, [], 'PATCH without companyId should fail before gate');
    assert.notEqual(body.success, true, 'PATCH without companyId must never report success');
  }

  {
    const env = loadRoute({ allowCompanyId: 110, denyStatus: 403 });
    const getResponse = await env.handlers.GET(makeRequest('https://example.test/api/customers?companyId=102'));
    const patchResponse = await env.handlers.PATCH(
      makeRequest('https://example.test/api/customers', { id: 1, companyId: 102, trading_name: 'x' })
    );
    const deleteResponse = await env.handlers.DELETE(
      makeRequest('https://example.test/api/customers?id=1&companyId=102')
    );
    assert.equal(getResponse.status, 403, 'member of 110 must not read company 102');
    assert.equal(patchResponse.status, 403, 'member of 110 must not update company 102');
    assert.equal(deleteResponse.status, 403, 'member of 110 must not delete company 102');
    assert.equal(env.supabaseCalls, 0, 'wrong-company requests must stop before Supabase');
  }

  {
    const env = loadRoute({ allowCompanyId: 102, denyStatus: 403 });
    const getResponse = await env.handlers.GET(makeRequest('https://example.test/api/customers?companyId=110'));
    const patchResponse = await env.handlers.PATCH(
      makeRequest('https://example.test/api/customers', { id: 1, companyId: 110, trading_name: 'x' })
    );
    const deleteResponse = await env.handlers.DELETE(
      makeRequest('https://example.test/api/customers?id=1&companyId=110')
    );
    assert.equal(getResponse.status, 403, 'member of 102 must not read company 110');
    assert.equal(patchResponse.status, 403, 'member of 102 must not update company 110');
    assert.equal(deleteResponse.status, 403, 'member of 102 must not delete company 110');
    assert.equal(env.supabaseCalls, 0, 'inverse wrong-company requests must stop before Supabase');
  }

  {
    const env = loadRoute({
      allowCompanyId: 110,
      customers: [
        { id: 2, profile_id: 102, trading_name: 'BFF 102', linked_profile_id: null },
        { id: 1, profile_id: 110, trading_name: 'VUKA 110', linked_profile_id: null },
      ],
    });
    const response = await env.handlers.GET(makeRequest('https://example.test/api/customers?companyId=110'));
    const body = await readBody(response);
    assert.equal(response.status, 200, 'happy-path GET should succeed for matching company');
    assert.equal(env.gateCalls[0], 110, 'happy-path GET should gate using companyId=110');
    assert.ok(env.events.indexOf('gate:110') < env.events.indexOf('supabase'), 'gate must run before Supabase');
    assert.equal(body.success, true);
    assert.deepEqual(
      body.customers,
      [{ id: 1, profile_id: 110, trading_name: 'VUKA 110', linked_profile_id: null }],
      'happy-path GET should return only the caller company book'
    );
  }

  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.POST(
      makeRequest('https://example.test/api/customers', { companyId: 110, trading_name: 'Still gated' })
    );
    assert.equal(response.status, 401, 'POST must remain gated');
    assert.deepEqual(env.gateCalls, [110], 'POST should still gate on companyId');
    assert.equal(env.supabaseCalls, 0, 'POST gate failure must happen before Supabase');
  }

  console.log('✓ Brief 45 customers authz assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
