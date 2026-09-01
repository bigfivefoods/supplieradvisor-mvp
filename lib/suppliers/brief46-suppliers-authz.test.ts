/**
 * Brief 46 — suppliers route authz regression test
 * Run: npx --yes tsx lib/suppliers/brief46-suppliers-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = resolve('app/api/suppliers/route.ts');
const src = readFileSync(routePath, 'utf8');

function extractFn(name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `Could not find ${name} in suppliers/route.ts`);
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
const flatPatch = patchFn.replace(/\s+/g, ' ');

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
  getFn.indexOf('requireCompanyAccess') < getFn.indexOf(".from('srm_suppliers')"),
  'GET must call requireCompanyAccess before querying srm_suppliers'
);

assert.match(getFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(patchFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);

assert.match(
  patchFn,
  /const curHit = await[\s\S]*?\.select\('metadata'\)[\s\S]*?\.eq\('id', Number\(body\.id\)\)[\s\S]*?\.eq\('profile_id', companyId\)[\s\S]*?\.maybeSingle\(\)/,
  'PATCH metadata select must be scoped with profile_id'
);
assert.match(
  patchFn,
  /let q = supabase[\s\S]*?\.update\(updates\)[\s\S]*?\.eq\('id', Number\(body\.id\)\)[\s\S]*?\.eq\('profile_id', companyId\)/,
  'PATCH main update must be scoped with profile_id'
);
assert.match(
  patchFn,
  /let q2 = supabase[\s\S]*?\.update\(updates\)[\s\S]*?\.eq\('id', Number\(body\.id\)\)[\s\S]*?\.eq\('profile_id', companyId\)/,
  'PATCH retry update must be scoped with profile_id'
);

assert.ok(
  flatPatch.includes(".update(updates) .eq('id', Number(body.id)) .eq('profile_id', companyId)") ||
    flatPatch.includes(".update(updates).eq('id', Number(body.id)).eq('profile_id', companyId)"),
  'PATCH main update must be scoped by profile_id'
);
assert.doesNotMatch(
  flatPatch,
  /\.update\(updates\)\s*\.eq\('id', Number\(body\.id\)\)(?!\s*\.eq\('profile_id', companyId\))/
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
  private readonly updates: Row;
  private maxRows: number | null = null;
  private ltFilter: { field: string; value: number } | null = null;
  private orderField: string | null = null;
  private orderAscending = true;

  constructor(store: Record<string, Row[]>, table: string) {
    this.store = store;
    this.table = table;
    this.updates = {};
  }

  select() { return this; }
  delete() { this.op = 'delete'; return this; }
  update(updates: Row) { this.op = 'update'; Object.assign(this.updates, updates); return this; }
  insert() { this.op = 'insert'; return this; }

  eq(field: string, value: unknown) { this.filters.push((row) => row[field] === value); return this; }
  lt(field: string, value: number) { this.ltFilter = { field, value }; return this; }
  order(field: string, opts?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAscending = opts?.ascending !== false;
    return this;
  }
  limit(value: number) { this.maxRows = value; return this; }
  or() { return this; }
  in(field: string, values: unknown[]) { this.filters.push((row) => values.includes(row[field])); return this; }
  maybeSingle() { return this; }
  single() { return this; }

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

    if (this.op === 'update') {
      const byId = new Set(rows.map((row) => row.id));
      this.store[this.table] = (this.store[this.table] || []).map((row) => (
        byId.has(row.id) ? { ...row, ...this.updates } : row
      ));
      const out = (this.store[this.table] || []).filter((row) => byId.has(row.id));
      return { data: out[0] ?? null, error: null };
    }

    return { data: rows, error: null };
  }
}

type LoadOptions = {
  allowCompanyId?: number | null;
  denyStatus?: number;
  suppliers?: Row[];
};

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
    .replace(/\b(const|let)\s+([A-Za-z_$][\w$]*)\s*:\s*([^=;\n]+)=/g, '$1 $2 =')
    .replace(/\(([^()]+?)\s+as\s+[^)]+\)/g, '($1)')
    .replace(/\s+as\s+[A-Za-z_$][\w$<>,.\s|()[\]?]*/g, '')
    .replace(/\(\s*c\s*:\s*string\s*\)/g, '(c)');
}

function loadRoute(opts: LoadOptions = {}) {
  const store: Record<string, Row[]> = {
    srm_suppliers: [...(opts.suppliers || [])],
    business_connections: [],
    profiles: [],
    customers: [],
    trade_portal_viewers: [],
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
    'assertCompanyMember',
    'computeTrustScore',
    'requireCompanyAccess',
    'legacyPrivyFrom',
    'requireVerifiedUser',
    'bookIlikeOr',
    'parseBeforeId',
    'parseListLimit',
    'SUPPLIER_BOOK_COLUMNS',
    'SUPPLIER_LIST_COLUMNS',
    'defaultCreateBookRole',
    'filterSupplierDeskRows',
    'stripMissingUpdateColumn',
    'supplierPatchUpdates',
    'missingSelectColumn',
    'stripSelectColumn',
    'asSupplierRows',
    'bookField',
    bundle
  );

  return {
    handlers: runner(
      { json: jsonResponse },
      getSupabaseServer,
      async () => ({ ok: true }),
      () => 50,
      requireCompanyAccess,
      () => null,
      async () => ({ ok: true, userId: 'u-1', verified: true, emails: [] }),
      () => null,
      () => null,
      () => 50,
      'id, profile_id, trading_name, linked_profile_id',
      'id, profile_id, trading_name, linked_profile_id',
      () => 'supplier',
      (rows: unknown[]) => rows,
      () => null,
      (body: Record<string, unknown>) => body,
      () => null,
      (cols: string) => cols,
      (raw: unknown) => (Array.isArray(raw) ? raw : []),
      () => null
    ) as {
      GET: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
      POST: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
      PATCH: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
      DELETE: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
    },
    events,
    gateCalls,
    store,
    get supabaseCalls() {
      return supabaseCalls;
    },
  };
}

async function readBody(response: FakeResponse) {
  return response.json();
}

async function main() {
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.GET(makeRequest('https://example.test/api/suppliers?companyId=102'));
    const body = await readBody(response);
    assert.equal(response.status, 401, 'unauth GET should be denied');
    assert.equal(env.supabaseCalls, 0, 'unauth GET must not query suppliers');
    assert.deepEqual(env.gateCalls, [102], 'GET should gate on requested companyId');
    assert.ok(!('suppliers' in body), 'unauth GET must not return a supplier book');
    assert.ok(env.events[0]?.startsWith('gate:'), 'GET must gate before touching Supabase');
  }

  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/suppliers', { id: 1, trading_name: 'x' })
    );
    const body = await readBody(response);
    assert.ok([400, 401].includes(response.status), 'PATCH without companyId should 400/401');
    assert.equal(env.supabaseCalls, 0, 'PATCH without companyId must not query suppliers');
    assert.deepEqual(env.gateCalls, [], 'PATCH without companyId should fail before gate');
    assert.notEqual(body.success, true, 'PATCH without companyId must never report success');
  }

  {
    const getEnv = loadRoute({ allowCompanyId: 110, denyStatus: 403 });
    const getResponse = await getEnv.handlers.GET(
      makeRequest('https://example.test/api/suppliers?companyId=102')
    );
    assert.equal(getResponse.status, 403, 'member of 110 must not read company 102');
    assert.equal(getEnv.supabaseCalls, 0, 'wrong-company GET must stop before Supabase');
  }

  {
    const patchEnv = loadRoute({
      allowCompanyId: 110,
      denyStatus: 403,
      suppliers: [{ id: 1, profile_id: 102, trading_name: 'BFF 102' }],
    });
    const patchResponse = await patchEnv.handlers.PATCH(
      makeRequest('https://example.test/api/suppliers', { id: 1, companyId: 102, trading_name: 'x' })
    );
    assert.equal(patchResponse.status, 403, 'member of 110 must not update company 102');
    assert.equal(patchEnv.supabaseCalls, 0, 'wrong-company PATCH must stop before Supabase');
    assert.equal(
      patchEnv.store.srm_suppliers[0].trading_name,
      'BFF 102',
      'wrong-company PATCH must not change supplier'
    );
  }

  {
    const getEnv = loadRoute({ allowCompanyId: 102, denyStatus: 403 });
    const getResponse = await getEnv.handlers.GET(
      makeRequest('https://example.test/api/suppliers?companyId=110')
    );
    assert.equal(getResponse.status, 403, 'member of 102 must not read company 110');
    assert.equal(getEnv.supabaseCalls, 0, 'inverse wrong-company GET must stop before Supabase');
  }

  {
    const patchEnv = loadRoute({
      allowCompanyId: 102,
      denyStatus: 403,
      suppliers: [{ id: 1, profile_id: 110, trading_name: 'VUKA 110' }],
    });
    const patchResponse = await patchEnv.handlers.PATCH(
      makeRequest('https://example.test/api/suppliers', { id: 1, companyId: 110, trading_name: 'x' })
    );
    assert.equal(patchResponse.status, 403, 'member of 102 must not update company 110');
    assert.equal(patchEnv.supabaseCalls, 0, 'inverse wrong-company PATCH must stop before Supabase');
    assert.equal(
      patchEnv.store.srm_suppliers[0].trading_name,
      'VUKA 110',
      'inverse wrong-company PATCH must not change supplier'
    );
  }

  {
    const env = loadRoute({
      allowCompanyId: 110,
      suppliers: [
        { id: 2, profile_id: 102, trading_name: 'BFF 102', linked_profile_id: null },
        { id: 1, profile_id: 110, trading_name: 'VUKA 110', linked_profile_id: null },
      ],
    });
    const response = await env.handlers.GET(makeRequest('https://example.test/api/suppliers?companyId=110'));
    const body = await readBody(response);
    assert.equal(response.status, 200, 'happy-path GET should succeed for matching company');
    assert.equal(env.gateCalls[0], 110, 'happy-path GET should gate using companyId=110');
    assert.ok(env.events.indexOf('gate:110') < env.events.indexOf('supabase'), 'gate must run before Supabase');
    assert.equal(body.success, true);
    assert.equal(Array.isArray(body.suppliers), true, 'GET should return a supplier list');
    const suppliers = body.suppliers as Array<Record<string, unknown>>;
    assert.equal(suppliers.length, 1, 'happy-path GET should return only caller company supplier book');
    assert.deepEqual(
      {
        id: suppliers[0].id,
        profile_id: suppliers[0].profile_id,
        trading_name: suppliers[0].trading_name,
        linked_profile_id: suppliers[0].linked_profile_id,
      },
      { id: 1, profile_id: 110, trading_name: 'VUKA 110', linked_profile_id: null }
    );
  }

  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.POST(
      makeRequest('https://example.test/api/suppliers', { companyId: 110, trading_name: 'Still gated' })
    );
    assert.equal(response.status, 401, 'POST must remain gated');
    assert.deepEqual(env.gateCalls, [110], 'POST should still gate on companyId');
    assert.equal(env.supabaseCalls, 0, 'POST gate failure must happen before Supabase');
  }

  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.DELETE(
      makeRequest('https://example.test/api/suppliers?id=1&companyId=110')
    );
    assert.equal(response.status, 401, 'DELETE must remain gated');
    assert.deepEqual(env.gateCalls, [110], 'DELETE should still gate on companyId');
    assert.equal(env.supabaseCalls, 0, 'DELETE gate failure must happen before Supabase');
  }

  console.log('✓ Brief 46 suppliers authz assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
